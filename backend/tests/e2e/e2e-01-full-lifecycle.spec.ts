import supertest from 'supertest';
import {
  getTestDb,
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  connectTestRedis,
  cleanRedis,
  closeTestRedis,
  createTestUser,
  createTestSupplier,
  getAccessToken,
  app,
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

/**
 * E2E-01: Full RFQ Lifecycle Test
 *
 * Steps:
 * 1.  Admin login
 * 2.  Buyer creates RFQ with 3 items
 * 3.  Buyer assigns 5 suppliers and publishes
 * 4.  Suppliers 1-3 accept, supplier 4 declines, supplier 5 ignores
 * 5.  Commercial lock: buyer edit attempt → 409
 * 6.  Transition to ACTIVE; suppliers 1-3 submit bids
 * 7.  Buyer views rankings
 * 8.  Supplier 1 revises bid
 * 9.  (Cooling time check skipped — cooling_time_minutes=0)
 * 10. Supplier 1 revises in anti-snipe window → deadline extends
 * 11. Manually close RFQ
 * 12. Bid after close → 409
 * 13. Buyer views rankings post-close
 * 14. Buyer runs simulation → zero-write, no audit entry
 * 15. Buyer finalizes award → AWARD_FINALIZED
 * 16. Buyer downloads Excel + PDF exports
 * 17. Admin views audit log
 */
describe('E2E-01: Full RFQ Lifecycle', () => {
  let adminUser: { id: string; email: string; role: string };
  let adminToken: string;
  let buyerUser: { id: string; email: string; role: string };
  let buyerToken: string;

  const suppliers: Array<{
    userId: string;
    supplierId: string;
    email: string;
    uniqueCode: string;
    password: string;
    token: string;
  }> = [];

  let rfqId: string;
  let itemIds: string[] = [];

  beforeAll(async () => {
    await setupTestDatabase();
    await connectTestRedis();
    await cleanDatabase();
    await cleanRedis();

    // Step 1: Create admin + buyer
    adminUser = await createTestUser({ role: 'ADMIN' });
    adminToken = getAccessToken(adminUser.id, UserRole.ADMIN);

    buyerUser = await createTestUser({ role: 'BUYER' });
    buyerToken = getAccessToken(buyerUser.id, UserRole.BUYER);

    // Create 5 suppliers
    for (let i = 0; i < 5; i++) {
      const s = await createTestSupplier({ company_name: `Supplier ${i + 1}` });
      suppliers.push({
        ...s,
        token: getAccessToken(s.userId, UserRole.SUPPLIER),
      });
    }
  });

  afterAll(async () => {
    await teardownTestDatabase();
    await closeTestRedis();
  });

  it('Step 2: Buyer creates RFQ with 3 items', async () => {
    const res = await supertest(app)
      .post('/api/buyer/rfqs')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        title: 'E2E Lifecycle RFQ',
        payment_terms: 'Net 30',
        freight_terms: 'FOB Destination',
        delivery_lead_time_days: 14,
        offer_validity_days: 30,
        max_revisions: 3,
        min_change_percent: 1,
        cooling_time_minutes: 0,
        bid_open_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        bid_close_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        weight_price: 100,
        weight_delivery: 0,
        weight_payment: 0,
        items: [
          { sl_no: 1, description: 'Widget A', uom: 'PCS', quantity: 100 },
          { sl_no: 2, description: 'Widget B', uom: 'KG', quantity: 200 },
          { sl_no: 3, description: 'Widget C', uom: 'LTR', quantity: 50 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    rfqId = res.body.data.id;

    // Get item IDs
    const db = getTestDb();
    const items = await db('rfq_items').where('rfq_id', rfqId).orderBy('sl_no');
    itemIds = items.map((i: { id: string }) => i.id);
    expect(itemIds).toHaveLength(3);
  });

  it('Step 3: Buyer assigns 5 suppliers and publishes RFQ', async () => {
    // Assign suppliers
    const assignRes = await supertest(app)
      .post(`/api/buyer/rfqs/${rfqId}/suppliers`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        supplier_ids: suppliers.map((s) => s.supplierId),
      });

    expect(assignRes.status).toBe(201);

    // Publish
    const pubRes = await supertest(app)
      .post(`/api/buyer/rfqs/${rfqId}/publish`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(pubRes.status).toBe(200);
    expect(pubRes.body.data.status).toBe('PUBLISHED');
  });

  it('Step 4: Suppliers 1-3 accept, supplier 4 declines, supplier 5 ignores', async () => {
    // Suppliers 1-3 accept
    for (let i = 0; i < 3; i++) {
      const res = await supertest(app)
        .post(`/api/supplier/rfqs/${rfqId}/accept`)
        .set('Authorization', `Bearer ${suppliers[i].token}`)
        .send({
          declaration_rfq_terms: true,
          declaration_no_collusion: true,
          declaration_confidentiality: true,
        });

      expect(res.status).toBe(200);
    }

    // Supplier 4 declines
    const declineRes = await supertest(app)
      .post(`/api/supplier/rfqs/${rfqId}/decline`)
      .set('Authorization', `Bearer ${suppliers[3].token}`)
      .send({
        reason: 'Unable to meet delivery requirements at this time',
      });

    expect(declineRes.status).toBe(200);
    // Supplier 5 doesn't respond — remains PENDING
  });

  it('Step 5: Commercial lock — buyer edit attempt → 409', async () => {
    const res = await supertest(app)
      .put(`/api/buyer/rfqs/${rfqId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        payment_terms: 'Net 60',
      });

    expect(res.status).toBe(409);
  });

  it('Step 6: Transition to ACTIVE and suppliers 1-3 submit initial bids', async () => {
    // Set bid_open_at to past so auto-transition to ACTIVE happens
    const db = getTestDb();
    await db('rfqs').where('id', rfqId).update({
      bid_open_at: new Date(Date.now() - 60 * 60 * 1000),
      bid_close_at: new Date(Date.now() + 60 * 60 * 1000),
    });

    // Supplier 1 bids: cheapest on item 1+2, not on 3
    const bid1Res = await supertest(app)
      .post(`/api/supplier/rfqs/${rfqId}/bids`)
      .set('Authorization', `Bearer ${suppliers[0].token}`)
      .send({
        items: [
          { rfq_item_id: itemIds[0], unit_price: 10 },
          { rfq_item_id: itemIds[1], unit_price: 15 },
          { rfq_item_id: itemIds[2], unit_price: 30 },
        ],
      });
    expect(bid1Res.status).toBe(201);

    // Supplier 2 bids: lowest total
    const bid2Res = await supertest(app)
      .post(`/api/supplier/rfqs/${rfqId}/bids`)
      .set('Authorization', `Bearer ${suppliers[1].token}`)
      .send({
        items: [
          { rfq_item_id: itemIds[0], unit_price: 8 },
          { rfq_item_id: itemIds[1], unit_price: 12 },
          { rfq_item_id: itemIds[2], unit_price: 20 },
        ],
      });
    expect(bid2Res.status).toBe(201);

    // Supplier 3 bids: highest
    const bid3Res = await supertest(app)
      .post(`/api/supplier/rfqs/${rfqId}/bids`)
      .set('Authorization', `Bearer ${suppliers[2].token}`)
      .send({
        items: [
          { rfq_item_id: itemIds[0], unit_price: 12 },
          { rfq_item_id: itemIds[1], unit_price: 18 },
          { rfq_item_id: itemIds[2], unit_price: 35 },
        ],
      });
    expect(bid3Res.status).toBe(201);
  });

  it('Step 7: Buyer views rankings — correct L1/L2/L3', async () => {
    const res = await supertest(app)
      .get(`/api/buyer/rfqs/${rfqId}/rankings`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total_rankings).toBeDefined();
    expect(res.body.data.total_rankings).toHaveLength(3);

    // Supplier 2 should be L1 (total: 8*100 + 12*200 + 20*50 = 800 + 2400 + 1000 = 4200)
    const l1 = res.body.data.total_rankings.find((r: { rank: number }) => r.rank === 1);
    expect(l1.supplier_code).toBe(suppliers[1].uniqueCode);
  });

  it('Step 8: Supplier 1 revises bid — rank may update', async () => {
    const res = await supertest(app)
      .put(`/api/supplier/rfqs/${rfqId}/bids`)
      .set('Authorization', `Bearer ${suppliers[0].token}`)
      .send({
        items: [
          { rfq_item_id: itemIds[0], unit_price: 7 },
          { rfq_item_id: itemIds[1], unit_price: 11 },
          { rfq_item_id: itemIds[2], unit_price: 19 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.revision_number).toBe(1);
  });

  it('Step 10: Supplier 1 revises in anti-snipe window → deadline extends', async () => {
    const db = getTestDb();
    const now = Date.now();
    const closeAt = new Date(now + 3 * 60 * 1000); // 3 min from now

    await db('rfqs').where('id', rfqId).update({
      bid_close_at: closeAt,
      anti_snipe_window_minutes: 5,
      anti_snipe_extension_minutes: 10,
    });

    const res = await supertest(app)
      .put(`/api/supplier/rfqs/${rfqId}/bids`)
      .set('Authorization', `Bearer ${suppliers[0].token}`)
      .send({
        items: [
          { rfq_item_id: itemIds[0], unit_price: 6 },
          { rfq_item_id: itemIds[1], unit_price: 10 },
          { rfq_item_id: itemIds[2], unit_price: 18 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.revision_number).toBe(2);

    // Verify deadline extended
    const updatedRfq = await db('rfqs').where('id', rfqId).first();
    const newCloseAt = new Date(updatedRfq.bid_close_at).getTime();
    const expectedCloseAt = closeAt.getTime() + 10 * 60 * 1000;
    expect(Math.abs(newCloseAt - expectedCloseAt)).toBeLessThan(5000);

    // Verify DEADLINE_EXTENDED audit entry
    const auditEntry = await db('audit_log')
      .where({ rfq_id: rfqId, event_type: 'DEADLINE_EXTENDED' })
      .first();
    expect(auditEntry).toBeDefined();
  });

  it('Step 11: Manually close RFQ', async () => {
    const res = await supertest(app)
      .post(`/api/buyer/rfqs/${rfqId}/close`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ confirm: true });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CLOSED');
  });

  it('Step 12: Bid after close → 409', async () => {
    const res = await supertest(app)
      .put(`/api/supplier/rfqs/${rfqId}/bids`)
      .set('Authorization', `Bearer ${suppliers[2].token}`)
      .send({
        items: [
          { rfq_item_id: itemIds[0], unit_price: 5 },
          { rfq_item_id: itemIds[1], unit_price: 9 },
          { rfq_item_id: itemIds[2], unit_price: 16 },
        ],
      });

    expect(res.status).toBe(409);
  });

  it('Step 13: Buyer views rankings post-close', async () => {
    const res = await supertest(app)
      .get(`/api/buyer/rfqs/${rfqId}/rankings`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total_rankings).toHaveLength(3);
  });

  it('Step 14: Buyer runs simulation → zero-write, no audit entry', async () => {
    const res = await supertest(app)
      .post(`/api/buyer/rfqs/${rfqId}/simulation`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        mode: 'single_supplier',
        supplier_id: suppliers[0].supplierId,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('single_supplier');
    expect(res.body.data.total_procurement_cost).toBeGreaterThan(0);

    const db = getTestDb();

    // Zero-write: no AWARD_SIMULATED audit entry
    const simulated = await db('audit_log')
      .where({ rfq_id: rfqId, event_type: 'AWARD_SIMULATED' })
      .first();
    expect(simulated).toBeUndefined();

    // RFQ still CLOSED — no AWARD_FINALIZED yet
    const finalized = await db('audit_log')
      .where({ rfq_id: rfqId, event_type: 'AWARD_FINALIZED' })
      .first();
    expect(finalized).toBeUndefined();
  });

  it('Step 15: Buyer finalizes award → AWARD_FINALIZED', async () => {
    const res = await supertest(app)
      .post(`/api/buyer/rfqs/${rfqId}/award`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        type: 'single',
        allocations: [{ supplier_id: suppliers[0].supplierId }],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('AWARDED');

    const db = getTestDb();
    const finalized = await db('audit_log')
      .where({ rfq_id: rfqId, event_type: 'AWARD_FINALIZED' })
      .first();
    expect(finalized).toBeDefined();
  });

  it('Step 16: Buyer downloads Excel and PDF exports', async () => {
    const excelRes = await supertest(app)
      .get(`/api/buyer/rfqs/${rfqId}/export/excel`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .responseType('blob');

    expect(excelRes.status).toBe(200);
    expect(excelRes.headers['content-type']).toMatch(/spreadsheetml|octet-stream/);

    const pdfRes = await supertest(app)
      .get(`/api/buyer/rfqs/${rfqId}/export/pdf`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .responseType('blob');

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toMatch(/pdf|octet-stream/);
  });

  it('Step 17: Admin views audit log — all event types present', async () => {
    const res = await supertest(app)
      .get('/api/admin/audit-log?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);

    const eventTypes = new Set(
      res.body.data.map((e: { event_type: string }) => e.event_type),
    );

    // Verify critical event types are present
    expect(eventTypes.has('RFQ_CREATED')).toBe(true);
    expect(eventTypes.has('RFQ_PUBLISHED')).toBe(true);
    expect(eventTypes.has('BID_SUBMITTED')).toBe(true);
    expect(eventTypes.has('BID_REVISED')).toBe(true);
    expect(eventTypes.has('DEADLINE_EXTENDED')).toBe(true);
    expect(eventTypes.has('RFQ_CLOSED')).toBe(true);
    expect(eventTypes.has('AWARD_FINALIZED')).toBe(true);
  });
});
