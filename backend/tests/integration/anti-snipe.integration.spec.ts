import supertest from 'supertest';
import {
  app,
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  connectTestRedis,
  cleanRedis,
  closeTestRedis,
  createTestUser,
  createTestSupplier,
  createTestRfq,
  createTestRfqItem,
  assignTestSupplier,
  createTestBid,
  getAccessToken,
  getTestDb,
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

const request = supertest(app);

let buyerUser: { id: string; email: string; role: string; password: string };
let supplier1: { userId: string; supplierId: string; email: string; uniqueCode: string; password: string };
let supplier1Token: string;

beforeAll(async () => {
  await setupTestDatabase();
  await connectTestRedis();
});

afterAll(async () => {
  await teardownTestDatabase();
  await closeTestRedis();
});

beforeEach(async () => {
  await cleanDatabase();
  await cleanRedis();

  buyerUser = await createTestUser({ email: 'buyer@test.com', role: 'BUYER' });
  getAccessToken(buyerUser.id, UserRole.BUYER);

  supplier1 = await createTestSupplier({ email: 's1@test.com', company_name: 'Supplier 1 Co' });
  supplier1Token = getAccessToken(supplier1.userId, UserRole.SUPPLIER);
});

/**
 * Helper: create an ACTIVE RFQ with anti-snipe columns configured.
 *
 * @param bidCloseFromNowMs - milliseconds from now for bid_close_at (e.g. 3 * 60 * 1000 for 3 minutes)
 * @returns rfqId and item IDs
 */
async function createAntiSnipeScenario(bidCloseFromNowMs: number): Promise<{
  rfqId: string;
  itemId: string;
  originalCloseAt: Date;
}> {
  const db = getTestDb();
  const closeAt = new Date(Date.now() + bidCloseFromNowMs);

  const rfq = await createTestRfq({
    buyer_id: buyerUser.id,
    title: 'Anti-Snipe Test RFQ',
    status: 'ACTIVE',
    bid_open_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    bid_close_at: closeAt.toISOString(),
    max_revisions: 5,
    min_change_percent: 1.0,
    cooling_time_minutes: 0, // no cooling time so revisions are immediate
  });

  // Set anti-snipe columns directly (not supported by createTestRfq helper)
  await db('rfqs').where('id', rfq.id).update({
    anti_snipe_window_minutes: 5,
    anti_snipe_extension_minutes: 10,
  });

  const item = await createTestRfqItem(rfq.id, {
    sl_no: 1,
    description: 'Anti-Snipe Widget',
    uom: 'PCS',
    quantity: 100,
  });

  await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });

  return { rfqId: rfq.id, itemId: item.id, originalCloseAt: closeAt };
}

describe('Anti-Snipe Integration Tests', () => {
  describe('POST /api/supplier/rfqs/:id/bids — Initial bid triggers anti-snipe', () => {
    it('should extend deadline when bid is submitted within the anti-snipe window', async () => {
      // bid_close_at is 3 minutes from now, which is inside the 5-minute anti-snipe window
      const { rfqId, itemId, originalCloseAt } = await createAntiSnipeScenario(3 * 60 * 1000);

      const res = await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [{ rfq_item_id: itemId, unit_price: 50.00 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify the deadline was extended in the database
      const db = getTestDb();
      const updatedRfq = await db('rfqs').where('id', rfqId).first();
      const updatedCloseAt = new Date(updatedRfq.bid_close_at);

      // The new close time should be approximately originalCloseAt + 10 minutes
      const expectedCloseAt = new Date(originalCloseAt.getTime() + 10 * 60 * 1000);
      const diffMs = Math.abs(updatedCloseAt.getTime() - expectedCloseAt.getTime());
      // Allow 5 seconds tolerance for test execution time
      expect(diffMs).toBeLessThan(5000);

      // Verify the deadline was actually pushed forward (not unchanged)
      expect(updatedCloseAt.getTime()).toBeGreaterThan(originalCloseAt.getTime());

      // Verify DEADLINE_EXTENDED audit log entry was created
      const auditEntry = await db('audit_log')
        .where({ rfq_id: rfqId, event_type: 'DEADLINE_EXTENDED' })
        .first();

      expect(auditEntry).toBeDefined();
      expect(auditEntry.actor_type).toBe('SYSTEM');

      const eventData = typeof auditEntry.event_data === 'string'
        ? JSON.parse(auditEntry.event_data)
        : auditEntry.event_data;

      expect(eventData.trigger).toBe('anti_snipe');
      expect(eventData.extensionMinutes).toBe(10);
      expect(eventData.triggeredBySupplierCode).toBe(supplier1.uniqueCode);
      expect(eventData.previousCloseAt).toBeDefined();
      expect(eventData.newCloseAt).toBeDefined();
    });

    it('should NOT extend deadline when bid is submitted outside the anti-snipe window', async () => {
      // bid_close_at is 30 minutes from now, well outside the 5-minute anti-snipe window
      const { rfqId, itemId, originalCloseAt } = await createAntiSnipeScenario(30 * 60 * 1000);

      const res = await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [{ rfq_item_id: itemId, unit_price: 50.00 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify the deadline was NOT changed
      const db = getTestDb();
      const updatedRfq = await db('rfqs').where('id', rfqId).first();
      const updatedCloseAt = new Date(updatedRfq.bid_close_at);

      // The close time should remain the same (within 2 second tolerance for DB precision)
      const diffMs = Math.abs(updatedCloseAt.getTime() - originalCloseAt.getTime());
      expect(diffMs).toBeLessThan(2000);

      // Verify NO DEADLINE_EXTENDED audit log entry exists
      const auditEntry = await db('audit_log')
        .where({ rfq_id: rfqId, event_type: 'DEADLINE_EXTENDED' })
        .first();

      expect(auditEntry).toBeUndefined();
    });
  });

  describe('PUT /api/supplier/rfqs/:id/bids — Bid revision triggers anti-snipe', () => {
    it('should extend deadline when a bid revision is submitted within the anti-snipe window', async () => {
      const db = getTestDb();

      // Create RFQ with bid_close_at far in the future so the initial bid does not trigger anti-snipe
      const rfq = await createTestRfq({
        buyer_id: buyerUser.id,
        title: 'Anti-Snipe Revision RFQ',
        status: 'ACTIVE',
        bid_open_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        bid_close_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        max_revisions: 5,
        min_change_percent: 1.0,
        cooling_time_minutes: 0,
      });

      const item = await createTestRfqItem(rfq.id, {
        sl_no: 1,
        description: 'Revision Widget',
        uom: 'PCS',
        quantity: 100,
      });

      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });

      // Insert initial bid directly via helper (with submitted_at in the past to avoid cooling time)
      await createTestBid({
        rfq_id: rfq.id,
        supplier_id: supplier1.supplierId,
        supplier_code: supplier1.uniqueCode,
        revision_number: 0,
        is_latest: true,
        submitted_at: new Date(Date.now() - 600000), // 10 minutes ago
        items: [{ rfq_item_id: item.id, unit_price: 50.00, quantity: 100 }],
      });

      // Now move bid_close_at to 3 minutes from now (inside the 5-minute window)
      // and enable anti-snipe
      const newCloseAt = new Date(Date.now() + 3 * 60 * 1000);
      await db('rfqs').where('id', rfq.id).update({
        bid_close_at: newCloseAt,
        anti_snipe_window_minutes: 5,
        anti_snipe_extension_minutes: 10,
      });

      // Submit a revision with >1% price change
      const res = await request
        .put(`/api/supplier/rfqs/${rfq.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [{ rfq_item_id: item.id, unit_price: 40.00 }], // 20% change from 50
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.revision_number).toBe(1);

      // Verify the deadline was extended
      const updatedRfq = await db('rfqs').where('id', rfq.id).first();
      const updatedCloseAt = new Date(updatedRfq.bid_close_at);

      // The new close time should be approximately newCloseAt + 10 minutes
      const expectedCloseAt = new Date(newCloseAt.getTime() + 10 * 60 * 1000);
      const diffMs = Math.abs(updatedCloseAt.getTime() - expectedCloseAt.getTime());
      // Allow 5 seconds tolerance
      expect(diffMs).toBeLessThan(5000);

      // Verify the deadline was pushed beyond the original close
      expect(updatedCloseAt.getTime()).toBeGreaterThan(newCloseAt.getTime());

      // Verify DEADLINE_EXTENDED audit log entry
      const auditEntry = await db('audit_log')
        .where({ rfq_id: rfq.id, event_type: 'DEADLINE_EXTENDED' })
        .first();

      expect(auditEntry).toBeDefined();
      expect(auditEntry.actor_type).toBe('SYSTEM');

      const eventData = typeof auditEntry.event_data === 'string'
        ? JSON.parse(auditEntry.event_data)
        : auditEntry.event_data;

      expect(eventData.trigger).toBe('anti_snipe');
      expect(eventData.extensionMinutes).toBe(10);
    });
  });
});
