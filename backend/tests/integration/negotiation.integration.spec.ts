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
  createTestNegotiation,
  addNegotiationSupplier,
  createTestNegotiationBid,
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
let supplier3: { userId: string; supplierId: string; email: string; uniqueCode: string; password: string };
let supplier3Token: string;


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

  supplier3 = await createTestSupplier({ email: 's3@test.com', company_name: 'Supplier 3 Co' });
  supplier3Token = getAccessToken(supplier3.userId, UserRole.SUPPLIER);
});

// Helper: create a CLOSED RFQ with items and accepted suppliers
async function createClosedRfqScenario(): Promise<{
  rfqId: string;
  item1Id: string;
  item2Id: string;
}> {
  const rfq = await createTestRfq({
    buyer_id: buyerUser.id,
    title: 'Negotiation Test RFQ',
    status: 'CLOSED',
    bid_open_at: new Date(Date.now() - 7200000).toISOString(),
    bid_close_at: new Date(Date.now() - 3600000).toISOString(),
    max_revisions: 5,
    min_change_percent: 1.0,
    cooling_time_minutes: 0,
  });

  const item1 = await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Widget A', uom: 'PCS', quantity: 100 });
  const item2 = await createTestRfqItem(rfq.id, { sl_no: 2, description: 'Widget B', uom: 'KG', quantity: 50 });

  await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
  await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });
  await assignTestSupplier(rfq.id, supplier3.supplierId, supplier3.uniqueCode, { status: 'ACCEPTED' });

  return { rfqId: rfq.id, item1Id: item1.id, item2Id: item2.id };
}

// Helper: create a CLOSED RFQ + ACTIVE negotiation with items and suppliers
async function createActiveNegotiationScenario(overrides?: {
  max_revisions?: number;
  min_change_percent?: number;
  cooling_time_minutes?: number;
  anti_snipe_window_minutes?: number;
  anti_snipe_extension_minutes?: number;
}): Promise<{
  rfqId: string;
  negotiationId: string;
  item1Id: string;
  item2Id: string;
}> {
  const { rfqId, item1Id, item2Id } = await createClosedRfqScenario();

  const negotiation = await createTestNegotiation({
    parent_rfq_id: rfqId,
    buyer_id: buyerUser.id,
    status: 'ACTIVE',
    bid_open_at: new Date(Date.now() - 3600000).toISOString(),
    bid_close_at: new Date(Date.now() + 3600000).toISOString(),
    max_revisions: overrides?.max_revisions ?? 5,
    min_change_percent: overrides?.min_change_percent ?? 1.0,
    cooling_time_minutes: overrides?.cooling_time_minutes ?? 0,
    anti_snipe_window_minutes: overrides?.anti_snipe_window_minutes ?? 0,
    anti_snipe_extension_minutes: overrides?.anti_snipe_extension_minutes ?? 0,
  });

  await addNegotiationSupplier(negotiation.id, supplier1.supplierId, supplier1.uniqueCode);
  await addNegotiationSupplier(negotiation.id, supplier2.supplierId, supplier2.uniqueCode);

  return { rfqId, negotiationId: negotiation.id, item1Id, item2Id };
}

describe('Negotiation Integration Tests', () => {
  // ── POST /api/buyer/rfqs/:id/negotiation — Create Negotiation ──
  describe('POST /api/buyer/rfqs/:id/negotiation — Create Negotiation', () => {
    it('should create negotiation from CLOSED RFQ (201)', async () => {
      const { rfqId } = await createClosedRfqScenario();

      const res = await request
        .post(`/api/buyer/rfqs/${rfqId}/negotiation`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          invited_supplier_ids: [supplier1.supplierId, supplier2.supplierId],
          max_revisions: 3,
          min_change_percent: 2.0,
          cooling_time_minutes: 5,
          bid_open_at: new Date(Date.now() + 60000).toISOString(),
          bid_close_at: new Date(Date.now() + 7200000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.parent_rfq_id).toBe(rfqId);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.max_revisions).toBe(3);
      expect(res.body.data.suppliers).toHaveLength(2);
    });

    it('should create NEGOTIATION_CREATED audit entry with parent_rfq_id', async () => {
      const { rfqId } = await createClosedRfqScenario();

      await request
        .post(`/api/buyer/rfqs/${rfqId}/negotiation`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          invited_supplier_ids: [supplier1.supplierId, supplier2.supplierId],
          max_revisions: 3,
          min_change_percent: 2.0,
          cooling_time_minutes: 5,
          bid_open_at: new Date(Date.now() + 60000).toISOString(),
          bid_close_at: new Date(Date.now() + 7200000).toISOString(),
        });

      const db = getTestDb();
      const audit = await db('audit_log')
        .where({ rfq_id: rfqId, event_type: 'NEGOTIATION_CREATED' })
        .first();

      expect(audit).toBeDefined();
      expect(audit.actor_type).toBe('BUYER');
      expect(audit.actor_id).toBe(buyerUser.id);
    });

    it('should fail if RFQ is not CLOSED (409)', async () => {
      const rfq = await createTestRfq({
        buyer_id: buyerUser.id,
        title: 'Active RFQ',
        status: 'ACTIVE',
        bid_open_at: new Date(Date.now() - 3600000).toISOString(),
        bid_close_at: new Date(Date.now() + 3600000).toISOString(),
      });
      await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Item', uom: 'PCS', quantity: 10 });
      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
      await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/negotiation`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          invited_supplier_ids: [supplier1.supplierId, supplier2.supplierId],
          max_revisions: 3,
          min_change_percent: 2.0,
          cooling_time_minutes: 5,
          bid_open_at: new Date(Date.now() + 60000).toISOString(),
          bid_close_at: new Date(Date.now() + 7200000).toISOString(),
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE');
    });

    it('should fail if supplier is not accepted on parent RFQ (422)', async () => {
      const { rfqId } = await createClosedRfqScenario();

      // Create a supplier not assigned to this RFQ
      const unrelated = await createTestSupplier({ email: 'unrelated@test.com' });

      const res = await request
        .post(`/api/buyer/rfqs/${rfqId}/negotiation`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          invited_supplier_ids: [supplier1.supplierId, unrelated.supplierId],
          max_revisions: 3,
          min_change_percent: 2.0,
          cooling_time_minutes: 5,
          bid_open_at: new Date(Date.now() + 60000).toISOString(),
          bid_close_at: new Date(Date.now() + 7200000).toISOString(),
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_SUPPLIERS');
    });

    it('should fail if fewer than 2 suppliers invited (422)', async () => {
      const { rfqId } = await createClosedRfqScenario();

      const res = await request
        .post(`/api/buyer/rfqs/${rfqId}/negotiation`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          invited_supplier_ids: [supplier1.supplierId],
          max_revisions: 3,
          min_change_percent: 2.0,
          cooling_time_minutes: 5,
          bid_open_at: new Date(Date.now() + 60000).toISOString(),
          bid_close_at: new Date(Date.now() + 7200000).toISOString(),
        });

      expect(res.status).toBe(422);
    });

    it('should return 404 if buyer does not own RFQ', async () => {
      const otherBuyer = await createTestUser({ email: 'other-buyer@test.com', role: 'BUYER' });
      const otherToken = getAccessToken(otherBuyer.id, UserRole.BUYER);

      const { rfqId } = await createClosedRfqScenario();

      const res = await request
        .post(`/api/buyer/rfqs/${rfqId}/negotiation`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          invited_supplier_ids: [supplier1.supplierId, supplier2.supplierId],
          max_revisions: 3,
          min_change_percent: 2.0,
          cooling_time_minutes: 5,
          bid_open_at: new Date(Date.now() + 60000).toISOString(),
          bid_close_at: new Date(Date.now() + 7200000).toISOString(),
        });

      expect(res.status).toBe(404);
    });

    it('should return 401 without auth token', async () => {
      const { rfqId } = await createClosedRfqScenario();

      const res = await request
        .post(`/api/buyer/rfqs/${rfqId}/negotiation`)
        .send({
          invited_supplier_ids: [supplier1.supplierId, supplier2.supplierId],
          max_revisions: 3,
          min_change_percent: 2.0,
          cooling_time_minutes: 5,
          bid_open_at: new Date(Date.now() + 60000).toISOString(),
          bid_close_at: new Date(Date.now() + 7200000).toISOString(),
        });

      expect(res.status).toBe(401);
    });

    it('should return 403 for SUPPLIER role', async () => {
      const { rfqId } = await createClosedRfqScenario();

      const res = await request
        .post(`/api/buyer/rfqs/${rfqId}/negotiation`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          invited_supplier_ids: [supplier1.supplierId, supplier2.supplierId],
          max_revisions: 3,
          min_change_percent: 2.0,
          cooling_time_minutes: 5,
          bid_open_at: new Date(Date.now() + 60000).toISOString(),
          bid_close_at: new Date(Date.now() + 7200000).toISOString(),
        });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/supplier/negotiations/:id — Get Negotiation (Supplier) ──
  describe('GET /api/supplier/negotiations/:id — Supplier View', () => {
    it('should return negotiation details + parent RFQ items (200)', async () => {
      const { negotiationId } = await createActiveNegotiationScenario();

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(negotiationId);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.own_assignment).toBeDefined();
      expect(res.body.data.own_assignment.status).toBe('ACCEPTED');
    });

    it('should return 403 if supplier not invited', async () => {
      const { negotiationId } = await createActiveNegotiationScenario();

      // supplier3 is not added to the negotiation
      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}`)
        .set('Authorization', `Bearer ${supplier3Token}`);

      expect(res.status).toBe(403);
    });

    it('should not include competitor supplier data in response', async () => {
      const { negotiationId } = await createActiveNegotiationScenario();

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);

      // Response should NOT contain 'suppliers' array or competitor info
      const data = res.body.data;
      expect(data.suppliers).toBeUndefined();
      expect(data.buyer_id).toBeUndefined();
    });
  });

  // ── GET /api/buyer/negotiations/:id — Get Negotiation (Buyer) ──
  describe('GET /api/buyer/negotiations/:id — Buyer View', () => {
    it('should return negotiation details with suppliers list (200)', async () => {
      const { negotiationId } = await createActiveNegotiationScenario();

      const res = await request
        .get(`/api/buyer/negotiations/${negotiationId}`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(negotiationId);
      expect(res.body.data.suppliers).toBeDefined();
      expect(res.body.data.suppliers).toHaveLength(2);
      expect(res.body.data.items).toBeDefined();
    });

    it('should return 404 for another buyer', async () => {
      const { negotiationId } = await createActiveNegotiationScenario();
      const otherBuyer = await createTestUser({ email: 'other@test.com', role: 'BUYER' });
      const otherToken = getAccessToken(otherBuyer.id, UserRole.BUYER);

      const res = await request
        .get(`/api/buyer/negotiations/${negotiationId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/supplier/negotiations/:id/bids — Submit Negotiation Bid ──
  describe('POST /api/supplier/negotiations/:id/bids — Submit Bid', () => {
    it('should submit bid successfully (201) with negotiation_id on bid record', async () => {
      const { negotiationId, item1Id, item2Id } = await createActiveNegotiationScenario();

      const res = await request
        .post(`/api/supplier/negotiations/${negotiationId}/bids`)
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
      expect(bid.negotiation_id).toBe(negotiationId);
      expect(bid.items).toHaveLength(2);

      // Server-calculated total: (10.50 * 100) + (25.00 * 50) = 1050 + 1250 = 2300
      expect(parseFloat(bid.total_price)).toBeCloseTo(2300, 2);
    });

    it('should create BID_SUBMITTED audit entry with parent_rfq_id', async () => {
      const { rfqId, negotiationId, item1Id, item2Id } = await createActiveNegotiationScenario();

      await request
        .post(`/api/supplier/negotiations/${negotiationId}/bids`)
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
    });

    it('should fail if negotiation is not ACTIVE (409)', async () => {
      const { rfqId } = await createClosedRfqScenario();

      const negotiation = await createTestNegotiation({
        parent_rfq_id: rfqId,
        buyer_id: buyerUser.id,
        status: 'CLOSED',
      });
      await addNegotiationSupplier(negotiation.id, supplier1.supplierId, supplier1.uniqueCode);

      const item1 = await getTestDb()('rfq_items').where('rfq_id', rfqId).first();

      const res = await request
        .post(`/api/supplier/negotiations/${negotiation.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [{ rfq_item_id: item1.id, unit_price: 10 }],
        });

      expect(res.status).toBe(409);
    });

    it('should validate all parent RFQ items have prices (422)', async () => {
      const { negotiationId, item1Id } = await createActiveNegotiationScenario();

      const res = await request
        .post(`/api/supplier/negotiations/${negotiationId}/bids`)
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

    it('should return 409 BID_ALREADY_EXISTS for duplicate bid', async () => {
      const { negotiationId, item1Id, item2Id } = await createActiveNegotiationScenario();

      // Submit first bid
      const first = await request
        .post(`/api/supplier/negotiations/${negotiationId}/bids`)
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
        .post(`/api/supplier/negotiations/${negotiationId}/bids`)
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

    it('should return 403 for supplier not in negotiation', async () => {
      const { negotiationId, item1Id, item2Id } = await createActiveNegotiationScenario();

      const res = await request
        .post(`/api/supplier/negotiations/${negotiationId}/bids`)
        .set('Authorization', `Bearer ${supplier3Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      expect(res.status).toBe(403);
    });

    it('should auto-transition DRAFT → ACTIVE when bid_open_at has passed', async () => {
      const { rfqId, item1Id, item2Id } = await createClosedRfqScenario();

      const negotiation = await createTestNegotiation({
        parent_rfq_id: rfqId,
        buyer_id: buyerUser.id,
        status: 'DRAFT',
        bid_open_at: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
        bid_close_at: new Date(Date.now() + 3600000).toISOString(),
        cooling_time_minutes: 0,
      });
      await addNegotiationSupplier(negotiation.id, supplier1.supplierId, supplier1.uniqueCode);
      await addNegotiationSupplier(negotiation.id, supplier2.supplierId, supplier2.uniqueCode);

      const res = await request
        .post(`/api/supplier/negotiations/${negotiation.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      expect(res.status).toBe(201);

      // Verify negotiation status was auto-updated
      const db = getTestDb();
      const updated = await db('negotiation_events').where('id', negotiation.id).first();
      expect(updated.status).toBe('ACTIVE');
    });
  });

  // ── PUT /api/supplier/negotiations/:id/bids — Revise Negotiation Bid ──
  describe('PUT /api/supplier/negotiations/:id/bids — Revise Bid', () => {
    it('should revise bid successfully when rules pass (200)', async () => {
      const { negotiationId, item1Id, item2Id } = await createActiveNegotiationScenario({
        min_change_percent: 1.0,
      });

      // Submit initial bid
      await request
        .post(`/api/supplier/negotiations/${negotiationId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 100 },
            { rfq_item_id: item2Id, unit_price: 200 },
          ],
        });

      // Revise bid (5% decrease)
      const res = await request
        .put(`/api/supplier/negotiations/${negotiationId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 95 },
            { rfq_item_id: item2Id, unit_price: 190 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.revision_number).toBe(1);
      expect(res.body.data.negotiation_id).toBe(negotiationId);
    });

    it('should enforce Rule A: revision limit (422)', async () => {
      const { rfqId, item1Id, item2Id } = await createClosedRfqScenario();

      const negotiation = await createTestNegotiation({
        parent_rfq_id: rfqId,
        buyer_id: buyerUser.id,
        status: 'ACTIVE',
        max_revisions: 1,
        min_change_percent: 1.0,
        cooling_time_minutes: 0,
        bid_open_at: new Date(Date.now() - 3600000).toISOString(),
        bid_close_at: new Date(Date.now() + 3600000).toISOString(),
      });
      await addNegotiationSupplier(negotiation.id, supplier1.supplierId, supplier1.uniqueCode);
      await addNegotiationSupplier(negotiation.id, supplier2.supplierId, supplier2.uniqueCode);

      // Submit initial bid
      await request
        .post(`/api/supplier/negotiations/${negotiation.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 100 },
            { rfq_item_id: item2Id, unit_price: 200 },
          ],
        });

      // First revision (should succeed, revision 0 → 1)
      const rev1 = await request
        .put(`/api/supplier/negotiations/${negotiation.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 90 },
            { rfq_item_id: item2Id, unit_price: 180 },
          ],
        });
      expect(rev1.status).toBe(200);

      // Second revision (should fail — max_revisions=1, already at revision 1)
      const rev2 = await request
        .put(`/api/supplier/negotiations/${negotiation.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 80 },
            { rfq_item_id: item2Id, unit_price: 160 },
          ],
        });

      expect(rev2.status).toBe(422);
      expect(rev2.body.error.code).toBe('REVISION_LIMIT_REACHED');
    });

    it('should enforce Rule B: minimum change (422)', async () => {
      const { negotiationId, item1Id, item2Id } = await createActiveNegotiationScenario({
        min_change_percent: 5.0,
      });

      // Submit initial bid
      await request
        .post(`/api/supplier/negotiations/${negotiationId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 100 },
            { rfq_item_id: item2Id, unit_price: 200 },
          ],
        });

      // Attempt revision with only 1% change (below 5% minimum)
      const res = await request
        .put(`/api/supplier/negotiations/${negotiationId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 99 },
            { rfq_item_id: item2Id, unit_price: 198 },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('MIN_CHANGE_NOT_MET');
    });

    it('should enforce Rule C: cooling time (422)', async () => {
      const { rfqId, item1Id, item2Id } = await createClosedRfqScenario();

      const negotiation = await createTestNegotiation({
        parent_rfq_id: rfqId,
        buyer_id: buyerUser.id,
        status: 'ACTIVE',
        max_revisions: 5,
        min_change_percent: 1.0,
        cooling_time_minutes: 60, // 60 minute cooling time
        bid_open_at: new Date(Date.now() - 3600000).toISOString(),
        bid_close_at: new Date(Date.now() + 7200000).toISOString(),
      });
      await addNegotiationSupplier(negotiation.id, supplier1.supplierId, supplier1.uniqueCode);
      await addNegotiationSupplier(negotiation.id, supplier2.supplierId, supplier2.uniqueCode);

      // Submit initial bid
      await request
        .post(`/api/supplier/negotiations/${negotiation.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 100 },
            { rfq_item_id: item2Id, unit_price: 200 },
          ],
        });

      // Immediate revision should fail due to cooling time
      const res = await request
        .put(`/api/supplier/negotiations/${negotiation.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 80 },
            { rfq_item_id: item2Id, unit_price: 160 },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('COOLING_TIME_ACTIVE');
    });

    it('should return 404 NO_BID_FOUND when revising without initial bid', async () => {
      const { negotiationId, item1Id, item2Id } = await createActiveNegotiationScenario();

      const res = await request
        .put(`/api/supplier/negotiations/${negotiationId}/bids`)
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

  // ── GET /api/supplier/negotiations/:id/ranking — Supplier Ranking ──
  describe('GET /api/supplier/negotiations/:id/ranking — Supplier Ranking', () => {
    it('should return rank_color, proximity_label, own_items, own_total_price only', async () => {
      const { rfqId, negotiationId, item1Id, item2Id } = await createActiveNegotiationScenario();

      // Create bids for both suppliers directly in DB
      await createTestNegotiationBid({
        negotiation_id: negotiationId,
        rfq_id: rfqId,
        supplier_id: supplier1.supplierId,
        supplier_code: supplier1.uniqueCode,
        items: [
          { rfq_item_id: item1Id, unit_price: 10, quantity: 100 },
          { rfq_item_id: item2Id, unit_price: 20, quantity: 50 },
        ],
      });

      await createTestNegotiationBid({
        negotiation_id: negotiationId,
        rfq_id: rfqId,
        supplier_id: supplier2.supplierId,
        supplier_code: supplier2.uniqueCode,
        items: [
          { rfq_item_id: item1Id, unit_price: 12, quantity: 100 },
          { rfq_item_id: item2Id, unit_price: 25, quantity: 50 },
        ],
      });

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}/ranking`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.rank_color).toBeDefined();
      expect(data.own_items).toBeDefined();
      expect(data.own_total_price).toBeDefined();
      expect(data).toHaveProperty('proximity_label');

      // Should have exactly the allowlisted keys
      const keys = Object.keys(data);
      expect(keys).toContain('rank_color');
      expect(keys).toContain('proximity_label');
      expect(keys).toContain('own_items');
      expect(keys).toContain('own_total_price');
      expect(keys).toHaveLength(4);
    });

    it('should return 403 for supplier not in negotiation', async () => {
      const { negotiationId } = await createActiveNegotiationScenario();

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}/ranking`)
        .set('Authorization', `Bearer ${supplier3Token}`);

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/supplier/negotiations/:id/bid-status — Bid Status ──
  describe('GET /api/supplier/negotiations/:id/bid-status — Bid Status', () => {
    it('should return bid status with revisions info (200)', async () => {
      const { negotiationId, item1Id, item2Id } = await createActiveNegotiationScenario();

      // Submit a bid first
      await request
        .post(`/api/supplier/negotiations/${negotiationId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}/bid-status`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.has_bid).toBe(true);
      expect(res.body.data.revisions_used).toBe(0);
      expect(res.body.data.revisions_remaining).toBe(5);
      expect(res.body.data).toHaveProperty('seconds_until_next_revision');
    });

    it('should return has_bid=false when no bid submitted', async () => {
      const { negotiationId } = await createActiveNegotiationScenario();

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}/bid-status`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.has_bid).toBe(false);
      expect(res.body.data.revisions_used).toBe(0);
    });

    it('should return 403 for supplier not in negotiation', async () => {
      const { negotiationId } = await createActiveNegotiationScenario();

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}/bid-status`)
        .set('Authorization', `Bearer ${supplier3Token}`);

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/buyer/negotiations/:id/rankings — Buyer Rankings ──
  describe('GET /api/buyer/negotiations/:id/rankings — Buyer Rankings', () => {
    it('should return full ranking data (200)', async () => {
      const { rfqId, negotiationId, item1Id, item2Id } = await createActiveNegotiationScenario();

      // Create bids for both suppliers
      await createTestNegotiationBid({
        negotiation_id: negotiationId,
        rfq_id: rfqId,
        supplier_id: supplier1.supplierId,
        supplier_code: supplier1.uniqueCode,
        items: [
          { rfq_item_id: item1Id, unit_price: 10, quantity: 100 },
          { rfq_item_id: item2Id, unit_price: 20, quantity: 50 },
        ],
      });

      await createTestNegotiationBid({
        negotiation_id: negotiationId,
        rfq_id: rfqId,
        supplier_id: supplier2.supplierId,
        supplier_code: supplier2.uniqueCode,
        items: [
          { rfq_item_id: item1Id, unit_price: 12, quantity: 100 },
          { rfq_item_id: item2Id, unit_price: 25, quantity: 50 },
        ],
      });

      const res = await request
        .get(`/api/buyer/negotiations/${negotiationId}/rankings`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.item_rankings).toBeDefined();
      expect(res.body.data.total_rankings).toBeDefined();
      expect(res.body.data.weighted_rankings).toBeDefined();

      // Buyer should see supplier codes
      expect(res.body.data.total_rankings.length).toBe(2);
      expect(res.body.data.total_rankings[0].supplier_code).toBeDefined();
    });

    it('should return 404 for another buyer', async () => {
      const { negotiationId } = await createActiveNegotiationScenario();
      const otherBuyer = await createTestUser({ email: 'other@test.com', role: 'BUYER' });
      const otherToken = getAccessToken(otherBuyer.id, UserRole.BUYER);

      const res = await request
        .get(`/api/buyer/negotiations/${negotiationId}/rankings`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/buyer/negotiations/:id/close — Close Negotiation ──
  describe('POST /api/buyer/negotiations/:id/close — Close Negotiation', () => {
    it('should close ACTIVE negotiation (200)', async () => {
      const { negotiationId } = await createActiveNegotiationScenario();

      const res = await request
        .post(`/api/buyer/negotiations/${negotiationId}/close`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ confirm: true });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CLOSED');
    });

    it('should create NEGOTIATION_CLOSED audit entry', async () => {
      const { rfqId, negotiationId } = await createActiveNegotiationScenario();

      await request
        .post(`/api/buyer/negotiations/${negotiationId}/close`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ confirm: true });

      const db = getTestDb();
      const audit = await db('audit_log')
        .where({ rfq_id: rfqId, event_type: 'NEGOTIATION_CLOSED' })
        .first();

      expect(audit).toBeDefined();
      expect(audit.actor_type).toBe('BUYER');
    });

    it('should fail to close DRAFT negotiation (409)', async () => {
      const { rfqId } = await createClosedRfqScenario();

      const negotiation = await createTestNegotiation({
        parent_rfq_id: rfqId,
        buyer_id: buyerUser.id,
        status: 'DRAFT',
      });

      const res = await request
        .post(`/api/buyer/negotiations/${negotiation.id}/close`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ confirm: true });

      expect(res.status).toBe(409);
    });

    it('should return 404 for another buyer', async () => {
      const { negotiationId } = await createActiveNegotiationScenario();
      const otherBuyer = await createTestUser({ email: 'other@test.com', role: 'BUYER' });
      const otherToken = getAccessToken(otherBuyer.id, UserRole.BUYER);

      const res = await request
        .post(`/api/buyer/negotiations/${negotiationId}/close`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ confirm: true });

      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/buyer/negotiations/:id/award — Award Negotiation ──
  describe('POST /api/buyer/negotiations/:id/award — Award Negotiation', () => {
    it('should award CLOSED negotiation (200)', async () => {
      const { rfqId } = await createClosedRfqScenario();

      const negotiation = await createTestNegotiation({
        parent_rfq_id: rfqId,
        buyer_id: buyerUser.id,
        status: 'CLOSED',
      });

      const res = await request
        .post(`/api/buyer/negotiations/${negotiation.id}/award`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          type: 'single',
          allocations: [{ supplier_id: supplier1.supplierId }],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('AWARDED');
    });

    it('should create NEGOTIATION_AWARDED audit entry with allocations', async () => {
      const { rfqId } = await createClosedRfqScenario();

      const negotiation = await createTestNegotiation({
        parent_rfq_id: rfqId,
        buyer_id: buyerUser.id,
        status: 'CLOSED',
      });

      await request
        .post(`/api/buyer/negotiations/${negotiation.id}/award`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          type: 'single',
          allocations: [{ supplier_id: supplier1.supplierId }],
        });

      const db = getTestDb();
      const audit = await db('audit_log')
        .where({ rfq_id: rfqId, event_type: 'NEGOTIATION_AWARDED' })
        .first();

      expect(audit).toBeDefined();
      const eventData = typeof audit.event_data === 'string'
        ? JSON.parse(audit.event_data)
        : audit.event_data;
      expect(eventData.award_type).toBe('single');
      expect(eventData.allocations).toBeDefined();
    });

    it('should fail to award ACTIVE negotiation (409)', async () => {
      const { negotiationId } = await createActiveNegotiationScenario();

      const res = await request
        .post(`/api/buyer/negotiations/${negotiationId}/award`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          type: 'single',
          allocations: [{ supplier_id: supplier1.supplierId }],
        });

      expect(res.status).toBe(409);
    });

    it('should fail to award DRAFT negotiation (409)', async () => {
      const { rfqId } = await createClosedRfqScenario();

      const negotiation = await createTestNegotiation({
        parent_rfq_id: rfqId,
        buyer_id: buyerUser.id,
        status: 'DRAFT',
      });

      const res = await request
        .post(`/api/buyer/negotiations/${negotiation.id}/award`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          type: 'single',
          allocations: [{ supplier_id: supplier1.supplierId }],
        });

      expect(res.status).toBe(409);
    });
  });

  // ── Anti-snipe test ──
  describe('Anti-snipe extension', () => {
    it('should extend negotiation bid_close_at (not parent RFQ) when bid arrives in window', async () => {
      const { rfqId, item1Id, item2Id } = await createClosedRfqScenario();

      const originalCloseAt = new Date(Date.now() + 180000); // 3 minutes from now

      const negotiation = await createTestNegotiation({
        parent_rfq_id: rfqId,
        buyer_id: buyerUser.id,
        status: 'ACTIVE',
        max_revisions: 5,
        min_change_percent: 1.0,
        cooling_time_minutes: 0,
        bid_open_at: new Date(Date.now() - 3600000).toISOString(),
        bid_close_at: originalCloseAt.toISOString(),
        anti_snipe_window_minutes: 5, // 5 minute window
        anti_snipe_extension_minutes: 3, // 3 minute extension
      });
      await addNegotiationSupplier(negotiation.id, supplier1.supplierId, supplier1.uniqueCode);
      await addNegotiationSupplier(negotiation.id, supplier2.supplierId, supplier2.uniqueCode);

      // Submit bid within anti-snipe window (3 min < 5 min window)
      await request
        .post(`/api/supplier/negotiations/${negotiation.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      const db = getTestDb();

      // Negotiation's bid_close_at should be extended
      const updatedNeg = await db('negotiation_events').where('id', negotiation.id).first();
      const newCloseAt = new Date(updatedNeg.bid_close_at);
      expect(newCloseAt.getTime()).toBeGreaterThan(originalCloseAt.getTime());

      // Parent RFQ's bid_close_at should NOT be modified
      const parentRfq = await db('rfqs').where('id', rfqId).first();
      // Since parent RFQ was CLOSED, its bid_close_at is in the past and should remain unchanged
      const parentCloseAt = new Date(parentRfq.bid_close_at);
      expect(parentCloseAt.getTime()).toBeLessThan(Date.now());
    });
  });

  // ── Cooling time isolation ──
  describe('Cooling time isolation', () => {
    it('negotiation cooling keys should not affect RFQ cooling keys', async () => {
      const { negotiationId, item1Id, item2Id } = await createActiveNegotiationScenario({
        cooling_time_minutes: 60,
      });

      // Submit negotiation bid (sets cooling:neg:... key)
      await request
        .post(`/api/supplier/negotiations/${negotiationId}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });

      // Create a separate ACTIVE RFQ for the same supplier to test isolation
      const activeRfq = await createTestRfq({
        buyer_id: buyerUser.id,
        title: 'Separate Active RFQ',
        status: 'ACTIVE',
        bid_open_at: new Date(Date.now() - 3600000).toISOString(),
        bid_close_at: new Date(Date.now() + 3600000).toISOString(),
        max_revisions: 5,
        min_change_percent: 1.0,
        cooling_time_minutes: 0, // No cooling for RFQ
      });
      const aItem1 = await createTestRfqItem(activeRfq.id, { sl_no: 1, description: 'A', uom: 'PCS', quantity: 100 });
      const aItem2 = await createTestRfqItem(activeRfq.id, { sl_no: 2, description: 'B', uom: 'KG', quantity: 50 });
      await assignTestSupplier(activeRfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });

      // Submit RFQ bid — should succeed (negotiation cooling should NOT block this)
      const rfqBid = await request
        .post(`/api/supplier/rfqs/${activeRfq.id}/bids`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          items: [
            { rfq_item_id: aItem1.id, unit_price: 10 },
            { rfq_item_id: aItem2.id, unit_price: 20 },
          ],
        });

      expect(rfqBid.status).toBe(201);
    });
  });
});
