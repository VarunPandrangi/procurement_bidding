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
  getAccessToken,
  getTestDb,
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

const request = supertest(app);

let buyerUser: { id: string; email: string; role: string; password: string };
let buyerToken: string;
let supplier1: { userId: string; supplierId: string; email: string; uniqueCode: string; password: string };
let supplier1Token: string;
let supplier2: { userId: string; supplierId: string; email: string; uniqueCode: string; password: string };

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
  buyerToken = getAccessToken(buyerUser.id, UserRole.BUYER);

  supplier1 = await createTestSupplier({ email: 's1@test.com', company_name: 'Supplier 1 Co' });
  supplier1Token = getAccessToken(supplier1.userId, UserRole.SUPPLIER);

  supplier2 = await createTestSupplier({ email: 's2@test.com', company_name: 'Supplier 2 Co' });
});

// Helper: create an ACTIVE RFQ with items and accepted suppliers
async function createActiveBiddingScenario(overrides?: {
  max_revisions?: number;
  min_change_percent?: number;
  cooling_time_minutes?: number;
}): Promise<{
  rfqId: string;
  item1Id: string;
  item2Id: string;
}> {
  const rfq = await createTestRfq({
    buyer_id: buyerUser.id,
    title: 'Bidding Test RFQ',
    status: 'ACTIVE',
    bid_open_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    bid_close_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    max_revisions: overrides?.max_revisions ?? 5,
    min_change_percent: overrides?.min_change_percent ?? 1.0,
    cooling_time_minutes: overrides?.cooling_time_minutes ?? 0, // 0 for most tests to avoid flakiness
  });

  const item1 = await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Widget A', uom: 'PCS', quantity: 100 });
  const item2 = await createTestRfqItem(rfq.id, { sl_no: 2, description: 'Widget B', uom: 'KG', quantity: 50 });

  await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
  await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });

  return { rfqId: rfq.id, item1Id: item1.id, item2Id: item2.id };
}

describe('Bidding Integration Tests', () => {
  describe('POST /api/supplier/rfqs/:id/bids — Submit Initial Bid', () => {
    it('should submit bid successfully (201) with server-calculated totals', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario();

      const res = await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10.50 },
            { rfq_item_id: item2Id, unit_price: 25.00 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const bid = res.body.data;
      expect(bid.revision_number).toBe(0);
      expect(bid.is_latest).toBe(true);
      expect(bid.submission_hash).toHaveLength(64);
      expect(bid.items).toHaveLength(2);

      // Server-calculated total: (10.50 * 100) + (25.00 * 50) = 1050 + 1250 = 2300
      expect(parseFloat(bid.total_price)).toBeCloseTo(2300, 2);
    });

    it('should create audit log entry for BID_SUBMITTED', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario();

      await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      const db = getTestDb();
      const audit = await db('audit_log')
        .where({ rfq_id: rfqId, event_type: 'BID_SUBMITTED' })
        .first();

      expect(audit).toBeDefined();
      expect(audit.actor_type).toBe('SUPPLIER');
      expect(audit.actor_id).toBe(supplier1.supplierId);
    });

    it('should return 422 for partial submission (missing items)', async () => {
      const { rfqId, item1Id } = await createActiveBiddingScenario();

      const res = await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            // Missing item2
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INCOMPLETE_BID');
    });

    it('should return 422 for negative price (Zod validation)', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario();

      const res = await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: -5 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      expect(res.status).toBe(422);
    });

    it('should return 401 without auth token', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario();

      const res = await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      expect(res.status).toBe(401);
    });

    it('should return 403 for BUYER role', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario();

      const res = await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      expect(res.status).toBe(403);
    });

    it('should return 403 for unassigned supplier', async () => {
      const unassigned = await createTestSupplier({ email: 's3@test.com' });
      const unassignedToken = getAccessToken(unassigned.userId, UserRole.SUPPLIER);

      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario();

      const res = await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${unassignedToken}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      expect(res.status).toBe(403);
    });

    it('should return 403 for PENDING supplier (not yet accepted)', async () => {
      const pendingSupplier = await createTestSupplier({ email: 'pending@test.com' });
      const pendingToken = getAccessToken(pendingSupplier.userId, UserRole.SUPPLIER);

      const rfq = await createTestRfq({
        buyer_id: buyerUser.id,
        status: 'ACTIVE',
        bid_open_at: new Date(Date.now() - 3600000).toISOString(),
        bid_close_at: new Date(Date.now() + 3600000).toISOString(),
      });
      const item1 = await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Test', uom: 'PCS', quantity: 10 });
      // Assign but leave as PENDING
      await assignTestSupplier(rfq.id, pendingSupplier.supplierId, pendingSupplier.uniqueCode, { status: 'PENDING' });

      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/bids`)
        .set('Authorization', `Bearer ${pendingToken}`)
        .send({
          items: [{ rfq_item_id: item1.id, unit_price: 10 }],
        });

      expect(res.status).toBe(403);
    });

    it('should return 409 BID_WINDOW_NOT_OPEN before bid_open_at', async () => {
      const rfq = await createTestRfq({
        buyer_id: buyerUser.id,
        status: 'PUBLISHED',
        bid_open_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        bid_close_at: new Date(Date.now() + 7200000).toISOString(),
      });
      const item1 = await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Test', uom: 'PCS', quantity: 10 });
      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });

      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [{ rfq_item_id: item1.id, unit_price: 10 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BID_WINDOW_NOT_OPEN');
    });

    it('should return 409 BID_WINDOW_CLOSED after bid_close_at', async () => {
      const rfq = await createTestRfq({
        buyer_id: buyerUser.id,
        status: 'ACTIVE',
        bid_open_at: new Date(Date.now() - 7200000).toISOString(),
        bid_close_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      });
      const item1 = await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Test', uom: 'PCS', quantity: 10 });
      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });

      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [{ rfq_item_id: item1.id, unit_price: 10 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BID_WINDOW_CLOSED');
    });

    it('should return 409 for CLOSED RFQ', async () => {
      const rfq = await createTestRfq({
        buyer_id: buyerUser.id,
        status: 'CLOSED',
      });
      const item1 = await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Test', uom: 'PCS', quantity: 10 });
      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });

      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [{ rfq_item_id: item1.id, unit_price: 10 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BID_WINDOW_CLOSED');
    });

    it('should return 409 BID_ALREADY_EXISTS for duplicate bid', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario();

      // Submit first bid
      const first = await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });
      expect(first.status).toBe(201);

      // Submit duplicate
      const res = await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 15 },
            { rfq_item_id: item2Id, unit_price: 25 },
          ],
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BID_ALREADY_EXISTS');
    });

    it('should auto-transition PUBLISHED → ACTIVE when bid_open_at has passed', async () => {
      const rfq = await createTestRfq({
        buyer_id: buyerUser.id,
        status: 'PUBLISHED',
        bid_open_at: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
        bid_close_at: new Date(Date.now() + 3600000).toISOString(),
      });
      const item1 = await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Test', uom: 'PCS', quantity: 10 });
      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });

      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [{ rfq_item_id: item1.id, unit_price: 10 }],
        });

      expect(res.status).toBe(201);

      // Verify RFQ status was updated
      const db = getTestDb();
      const updatedRfq = await db('rfqs').where('id', rfq.id).first();
      expect(updatedRfq.status).toBe('ACTIVE');
    });
  });

  describe('PUT /api/supplier/rfqs/:id/bids — Revise Bid', () => {
    it('should revise bid successfully with incremented revision_number', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario();

      // Submit initial bid
      await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      // Revise bid
      const res = await request
        .put(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 9 },
            { rfq_item_id: item2Id, unit_price: 18 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const bid = res.body.data;
      expect(bid.revision_number).toBe(1);
      expect(bid.is_latest).toBe(true);
    });

    it('should mark previous bid as is_latest=false', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario();

      // Submit initial bid
      const initial = await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });
      const initialBidId = initial.body.data.id;

      // Revise
      await request
        .put(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 9 },
            { rfq_item_id: item2Id, unit_price: 18 },
          ],
        });

      const db = getTestDb();
      const oldBid = await db('bids').where('id', initialBidId).first();
      expect(oldBid.is_latest).toBe(false);
    });

    it('should create BID_REVISED audit entry with old and new prices', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario();

      await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      await request
        .put(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 9 },
            { rfq_item_id: item2Id, unit_price: 18 },
          ],
        });

      const db = getTestDb();
      const audit = await db('audit_log')
        .where({ rfq_id: rfqId, event_type: 'BID_REVISED' })
        .first();

      expect(audit).toBeDefined();
      expect(audit.actor_type).toBe('SUPPLIER');

      const eventData = typeof audit.event_data === 'string'
        ? JSON.parse(audit.event_data)
        : audit.event_data;
      expect(eventData.revisionNumber).toBe(1);
      expect(eventData.oldPrices).toBeDefined();
      expect(eventData.newPrices).toBeDefined();
    });

    it('should return 422 REVISION_LIMIT_REACHED when max_revisions exhausted (Rule A)', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario({ max_revisions: 1 });

      // Submit initial bid
      await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      // First revision (allowed — revision_number becomes 1 which equals max_revisions)
      const rev1 = await request
        .put(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 9 },
            { rfq_item_id: item2Id, unit_price: 18 },
          ],
        });
      expect(rev1.status).toBe(200);

      // Second revision (should fail — revision_number=1 and max is 1)
      const res = await request
        .put(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 8 },
            { rfq_item_id: item2Id, unit_price: 16 },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('REVISION_LIMIT_REACHED');
    });

    it('should return 422 MIN_CHANGE_NOT_MET with failed item IDs (Rule B)', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario({ min_change_percent: 5.0 });

      await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 100 },
            { rfq_item_id: item2Id, unit_price: 200 },
          ],
        });

      // Try revision with only 1% change on item1 (below 5% minimum)
      const res = await request
        .put(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 99 }, // 1% change — too small
            { rfq_item_id: item2Id, unit_price: 180 }, // 10% change — ok
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('MIN_CHANGE_NOT_MET');
      expect(res.body.error.details).toBeDefined();
      const failedFields = res.body.error.details.map((d: { field: string }) => d.field);
      expect(failedFields).toContain(item1Id);
    });

    it('should accept revision at exact Rule B boundary', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario({ min_change_percent: 1.0 });

      await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 100 },
            { rfq_item_id: item2Id, unit_price: 200 },
          ],
        });

      // Exactly 1% change
      const res = await request
        .put(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 99 }, // exactly 1% change
            { rfq_item_id: item2Id, unit_price: 198 }, // exactly 1% change
          ],
        });

      expect(res.status).toBe(200);
    });

    it('should return 422 COOLING_TIME_ACTIVE with seconds_remaining (Rule C)', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario({ cooling_time_minutes: 5 });

      await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 100 },
            { rfq_item_id: item2Id, unit_price: 200 },
          ],
        });

      // Immediately try to revise — cooling period active
      const res = await request
        .put(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 90 },
            { rfq_item_id: item2Id, unit_price: 180 },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('COOLING_TIME_ACTIVE');
    });

    it('should return 404 when no initial bid exists', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario();

      const res = await request
        .put(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NO_BID_FOUND');
    });
  });

  describe('GET /api/supplier/rfqs/:id/bid-status', () => {
    it('should return bid status with no bid yet', async () => {
      const { rfqId } = await createActiveBiddingScenario();

      const res = await request
        .get(`/api/supplier/rfqs/${rfqId}/bid-status`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.has_bid).toBe(false);
      expect(res.body.data.revisions_remaining).toBe(5);
      expect(res.body.data.seconds_until_next_revision).toBe(0);
    });

    it('should return revisions_remaining after initial bid', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario({ max_revisions: 3 });

      await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      const res = await request
        .get(`/api/supplier/rfqs/${rfqId}/bid-status`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.has_bid).toBe(true);
      expect(res.body.data.revisions_used).toBe(0);
      expect(res.body.data.revisions_remaining).toBe(3);
    });

    it('should return seconds_until_next_revision when cooling active', async () => {
      const { rfqId, item1Id, item2Id } = await createActiveBiddingScenario({ cooling_time_minutes: 5 });

      await request
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      const res = await request
        .get(`/api/supplier/rfqs/${rfqId}/bid-status`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.seconds_until_next_revision).toBeGreaterThan(0);
    });

    it('should return 403 for unassigned supplier', async () => {
      const unassigned = await createTestSupplier({ email: 'unassigned@test.com' });
      const unassignedToken = getAccessToken(unassigned.userId, UserRole.SUPPLIER);

      const { rfqId } = await createActiveBiddingScenario();

      const res = await request
        .get(`/api/supplier/rfqs/${rfqId}/bid-status`)
        .set('Authorization', `Bearer ${unassignedToken}`);

      expect(res.status).toBe(403);
    });
  });
});
