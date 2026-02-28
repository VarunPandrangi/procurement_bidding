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
 * E2E-03: Anti-Snipe (Time-Compressed)
 *
 * bid_close_at = NOW() + 90s, anti_snipe_window = 2 min (120s)
 * Since 90s < 120s window, any bid submission triggers extension.
 * anti_snipe_extension = 5 min → bid_close_at should extend by 5 min.
 * Verify DEADLINE_EXTENDED audit log entry.
 */
describe('E2E-03: Anti-Snipe (Time-Compressed)', () => {
  let buyerToken: string;
  let supplierToken: string;
  let rfqId: string;
  let itemIds: string[] = [];

  beforeAll(async () => {
    await setupTestDatabase();
    await connectTestRedis();
    await cleanDatabase();
    await cleanRedis();

    const buyerUser = await createTestUser({ role: 'BUYER' });
    buyerToken = getAccessToken(buyerUser.id, UserRole.BUYER);

    // Need at least 2 suppliers assigned for publishing
    const s1 = await createTestSupplier({ company_name: 'Snipe Supplier 1' });
    const s2 = await createTestSupplier({ company_name: 'Snipe Supplier 2' });
    supplierToken = getAccessToken(s1.userId, UserRole.SUPPLIER);

    // Create RFQ with tight close window: 90 seconds from now
    const closeAt = new Date(Date.now() + 90 * 1000);
    const rfqRes = await supertest(app)
      .post('/api/buyer/rfqs')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        title: 'Anti-Snipe Test RFQ',
        payment_terms: 'Net 30',
        freight_terms: 'FOB',
        delivery_lead_time_days: 7,
        offer_validity_days: 30,
        max_revisions: 5,
        min_change_percent: 1,
        cooling_time_minutes: 0,
        bid_open_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        bid_close_at: closeAt.toISOString(),
        anti_snipe_window_minutes: 2,
        anti_snipe_extension_minutes: 5,
        weight_price: 100,
        weight_delivery: 0,
        weight_payment: 0,
        items: [
          { sl_no: 1, description: 'Snipe Item A', uom: 'PCS', quantity: 100 },
          { sl_no: 2, description: 'Snipe Item B', uom: 'KG', quantity: 50 },
        ],
      });

    expect(rfqRes.status).toBe(201);
    rfqId = rfqRes.body.data.id;

    // Get item IDs
    const db = getTestDb();
    const items = await db('rfq_items').where('rfq_id', rfqId).orderBy('sl_no');
    itemIds = items.map((i: { id: string }) => i.id);

    // Assign both suppliers and publish
    const assignRes = await supertest(app)
      .post(`/api/buyer/rfqs/${rfqId}/suppliers`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ supplier_ids: [s1.supplierId, s2.supplierId] });
    expect(assignRes.status).toBe(201);

    const pubRes = await supertest(app)
      .post(`/api/buyer/rfqs/${rfqId}/publish`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(pubRes.status).toBe(200);

    // Supplier 1 accepts
    const acceptRes = await supertest(app)
      .post(`/api/supplier/rfqs/${rfqId}/accept`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        declaration_rfq_terms: true,
        declaration_no_collusion: true,
        declaration_confidentiality: true,
      });
    expect(acceptRes.status).toBe(200);

    // Set bid window: open now, close in 90 seconds, anti_snipe_window=2min (120s)
    // Since we're within 120s of close, any bid triggers extension
    await db('rfqs').where('id', rfqId).update({
      bid_open_at: new Date(Date.now() - 60 * 60 * 1000),
      bid_close_at: new Date(Date.now() + 90 * 1000),
      anti_snipe_window_minutes: 2,
      anti_snipe_extension_minutes: 5,
    });
  });

  afterAll(async () => {
    await teardownTestDatabase();
    await closeTestRedis();
  });

  it('Bid within anti-snipe window extends deadline', async () => {
    const db = getTestDb();

    // Record original close time
    const rfqBefore = await db('rfqs').where('id', rfqId).first();
    const originalCloseAt = new Date(rfqBefore.bid_close_at).getTime();

    // Submit bid — should trigger anti-snipe extension
    const bidRes = await supertest(app)
      .post(`/api/supplier/rfqs/${rfqId}/bids`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        items: itemIds.map((itemId) => ({
          rfq_item_id: itemId,
          unit_price: 50.00,
        })),
      });

    expect(bidRes.status).toBe(201);

    // Verify bid_close_at was extended by 5 minutes (300,000ms)
    const rfqAfter = await db('rfqs').where('id', rfqId).first();
    const newCloseAt = new Date(rfqAfter.bid_close_at).getTime();
    const expectedCloseAt = originalCloseAt + 5 * 60 * 1000;

    // Allow 5-second tolerance for test execution time
    expect(Math.abs(newCloseAt - expectedCloseAt)).toBeLessThan(5000);
    expect(newCloseAt).toBeGreaterThan(originalCloseAt);
  });

  it('DEADLINE_EXTENDED audit entry exists with correct data', async () => {
    const db = getTestDb();

    const auditEntry = await db('audit_log')
      .where({ rfq_id: rfqId, event_type: 'DEADLINE_EXTENDED' })
      .first();

    expect(auditEntry).toBeDefined();

    const eventData = typeof auditEntry.event_data === 'string'
      ? JSON.parse(auditEntry.event_data)
      : auditEntry.event_data;

    expect(eventData.trigger).toBe('anti_snipe');
    expect(eventData.previousCloseAt).toBeDefined();
    expect(eventData.newCloseAt).toBeDefined();

    // New close should be after old close
    const oldTime = new Date(eventData.previousCloseAt).getTime();
    const newTime = new Date(eventData.newCloseAt).getTime();
    expect(newTime).toBeGreaterThan(oldTime);
  });
});
