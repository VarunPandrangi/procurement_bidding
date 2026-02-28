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
import { verifyAuditChain } from '../../src/modules/audit/audit.service';

/**
 * E2E-04: Hash Integrity Verification
 *
 * Complete a full lifecycle producing multiple audit entries.
 * Verify the audit chain is valid (verifyAuditChain returns valid=true).
 * Tamper with one event_data field directly in the test DB.
 * Verify the chain is now invalid (valid=false).
 */
describe('E2E-04: Hash Integrity', () => {
  let buyerToken: string;
  let rfqId: string;
  let itemIds: string[] = [];

  const suppliers: Array<{
    userId: string;
    supplierId: string;
    uniqueCode: string;
    token: string;
  }> = [];

  beforeAll(async () => {
    await setupTestDatabase();
    await connectTestRedis();
    await cleanDatabase();
    await cleanRedis();

    const buyerUser = await createTestUser({ role: 'BUYER' });
    buyerToken = getAccessToken(buyerUser.id, UserRole.BUYER);

    // Create 2 suppliers (minimum needed)
    for (let i = 0; i < 2; i++) {
      const s = await createTestSupplier({ company_name: `Hash Supplier ${i + 1}` });
      suppliers.push({
        userId: s.userId,
        supplierId: s.supplierId,
        uniqueCode: s.uniqueCode,
        token: getAccessToken(s.userId, UserRole.SUPPLIER),
      });
    }
  });

  afterAll(async () => {
    await teardownTestDatabase();
    await closeTestRedis();
  });

  it('Setup: Complete lifecycle with multiple audit events', async () => {
    // Create RFQ
    const rfqRes = await supertest(app)
      .post('/api/buyer/rfqs')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        title: 'Hash Integrity RFQ',
        payment_terms: 'Net 30',
        freight_terms: 'FOB',
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
          { sl_no: 1, description: 'Hash Item A', uom: 'PCS', quantity: 100 },
          { sl_no: 2, description: 'Hash Item B', uom: 'KG', quantity: 50 },
        ],
      });

    expect(rfqRes.status).toBe(201);
    rfqId = rfqRes.body.data.id;

    const db = getTestDb();
    const items = await db('rfq_items').where('rfq_id', rfqId).orderBy('sl_no');
    itemIds = items.map((i: { id: string }) => i.id);

    // Assign suppliers and publish
    await supertest(app)
      .post(`/api/buyer/rfqs/${rfqId}/suppliers`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ supplier_ids: suppliers.map((s) => s.supplierId) });

    const pubRes = await supertest(app)
      .post(`/api/buyer/rfqs/${rfqId}/publish`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(pubRes.status).toBe(200);

    // Both suppliers accept
    for (const s of suppliers) {
      await supertest(app)
        .post(`/api/supplier/rfqs/${rfqId}/accept`)
        .set('Authorization', `Bearer ${s.token}`)
        .send({
          declaration_rfq_terms: true,
          declaration_no_collusion: true,
          declaration_confidentiality: true,
        });
    }

    // Ensure bid window is open
    await db('rfqs').where('id', rfqId).update({
      bid_open_at: new Date(Date.now() - 60 * 60 * 1000),
      bid_close_at: new Date(Date.now() + 60 * 60 * 1000),
    });

    // Supplier 1 submits bid
    const bid1Res = await supertest(app)
      .post(`/api/supplier/rfqs/${rfqId}/bids`)
      .set('Authorization', `Bearer ${suppliers[0].token}`)
      .send({
        items: [
          { rfq_item_id: itemIds[0], unit_price: 10 },
          { rfq_item_id: itemIds[1], unit_price: 20 },
        ],
      });
    expect(bid1Res.status).toBe(201);

    // Supplier 2 submits bid
    const bid2Res = await supertest(app)
      .post(`/api/supplier/rfqs/${rfqId}/bids`)
      .set('Authorization', `Bearer ${suppliers[1].token}`)
      .send({
        items: [
          { rfq_item_id: itemIds[0], unit_price: 12 },
          { rfq_item_id: itemIds[1], unit_price: 22 },
        ],
      });
    expect(bid2Res.status).toBe(201);

    // Supplier 1 revises bid (creates BID_REVISED audit entry)
    const reviseRes = await supertest(app)
      .put(`/api/supplier/rfqs/${rfqId}/bids`)
      .set('Authorization', `Bearer ${suppliers[0].token}`)
      .send({
        items: [
          { rfq_item_id: itemIds[0], unit_price: 9 },
          { rfq_item_id: itemIds[1], unit_price: 18 },
        ],
      });
    expect(reviseRes.status).toBe(200);

    // Close RFQ
    const closeRes = await supertest(app)
      .post(`/api/buyer/rfqs/${rfqId}/close`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ confirm: true });
    expect(closeRes.status).toBe(200);
  });

  it('Verify audit chain is valid before tampering', async () => {
    const result = await verifyAuditChain(rfqId);

    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBeGreaterThanOrEqual(5);
  });

  it('Tamper with event_data → chain becomes invalid', async () => {
    const db = getTestDb();

    // Find a BID_SUBMITTED audit entry to tamper with
    const entries = await db('audit_log')
      .where({ rfq_id: rfqId })
      .orderBy('created_at', 'asc');

    expect(entries.length).toBeGreaterThanOrEqual(5);

    // Pick an entry in the middle (not first, not last) for maximum chain disruption
    const targetIndex = Math.floor(entries.length / 2);
    const targetEntry = entries[targetIndex];

    // Directly UPDATE the event_data — this breaks the hash chain
    await db('audit_log')
      .where('id', targetEntry.id)
      .update({
        event_data: JSON.stringify({ tampered: true, original_id: targetEntry.id }),
      });

    // Verify chain is now broken
    const result = await verifyAuditChain(rfqId);

    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(targetIndex);
    expect(result.totalEntries).toBe(entries.length);
  });
});
