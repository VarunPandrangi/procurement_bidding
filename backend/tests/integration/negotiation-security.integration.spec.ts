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

// Helper: create scenario with negotiation + bids
async function createNegotiationWithBids(): Promise<{
  rfqId: string;
  negotiationId: string;
  item1Id: string;
  item2Id: string;
}> {
  const rfq = await createTestRfq({
    buyer_id: buyerUser.id,
    title: 'Security Test RFQ',
    status: 'CLOSED',
    bid_open_at: new Date(Date.now() - 7200000).toISOString(),
    bid_close_at: new Date(Date.now() - 3600000).toISOString(),
  });

  const item1 = await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Widget A', uom: 'PCS', quantity: 100 });
  const item2 = await createTestRfqItem(rfq.id, { sl_no: 2, description: 'Widget B', uom: 'KG', quantity: 50 });

  await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
  await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });
  await assignTestSupplier(rfq.id, supplier3.supplierId, supplier3.uniqueCode, { status: 'ACCEPTED' });

  const negotiation = await createTestNegotiation({
    parent_rfq_id: rfq.id,
    buyer_id: buyerUser.id,
    status: 'ACTIVE',
    bid_open_at: new Date(Date.now() - 3600000).toISOString(),
    bid_close_at: new Date(Date.now() + 3600000).toISOString(),
    max_revisions: 5,
    min_change_percent: 1.0,
    cooling_time_minutes: 0,
  });

  await addNegotiationSupplier(negotiation.id, supplier1.supplierId, supplier1.uniqueCode);
  await addNegotiationSupplier(negotiation.id, supplier2.supplierId, supplier2.uniqueCode);

  // Create bids for both suppliers
  await createTestNegotiationBid({
    negotiation_id: negotiation.id,
    rfq_id: rfq.id,
    supplier_id: supplier1.supplierId,
    supplier_code: supplier1.uniqueCode,
    items: [
      { rfq_item_id: item1.id, unit_price: 10, quantity: 100 },
      { rfq_item_id: item2.id, unit_price: 20, quantity: 50 },
    ],
  });

  await createTestNegotiationBid({
    negotiation_id: negotiation.id,
    rfq_id: rfq.id,
    supplier_id: supplier2.supplierId,
    supplier_code: supplier2.uniqueCode,
    items: [
      { rfq_item_id: item1.id, unit_price: 15, quantity: 100 },
      { rfq_item_id: item2.id, unit_price: 30, quantity: 50 },
    ],
  });

  return { rfqId: rfq.id, negotiationId: negotiation.id, item1Id: item1.id, item2Id: item2.id };
}

describe('Negotiation Security Tests', () => {
  // ── SEC-T01-NEG: Supplier ranking response has EXACTLY 4 allowlisted keys ──
  describe('SEC-T01-NEG: Supplier ranking allowlist enforcement', () => {
    it('should return EXACTLY 4 allowlisted keys in ranking response', async () => {
      const { negotiationId } = await createNegotiationWithBids();

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}/ranking`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);

      const data = res.body.data;
      const keys = Object.keys(data).sort();

      // Exact allowlist — 4 keys and only 4 keys
      expect(keys).toEqual(['own_items', 'own_total_price', 'proximity_label', 'rank_color']);
      expect(keys).toHaveLength(4);
    });

    it('should NOT contain competitor supplier_code in ranking response', async () => {
      const { negotiationId } = await createNegotiationWithBids();

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}/ranking`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);

      const body = JSON.stringify(res.body);
      // The response should NOT contain supplier2's code
      expect(body).not.toContain(supplier2.uniqueCode);
      // The response should NOT contain supplier2's ID
      expect(body).not.toContain(supplier2.supplierId);
    });

    it('should NOT contain competitor prices or competitor IDs', async () => {
      const { negotiationId } = await createNegotiationWithBids();

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}/ranking`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);

      const data = res.body.data;

      // Should NOT have full ranking arrays
      expect(data.item_rankings).toBeUndefined();
      expect(data.total_rankings).toBeUndefined();
      expect(data.weighted_rankings).toBeUndefined();

      // Own items should not contain supplier_code or supplier_id
      for (const item of data.own_items) {
        expect(item.supplier_code).toBeUndefined();
        expect(item.supplier_id).toBeUndefined();
      }
    });

    it('should NOT contain numeric rank position or bidder count', async () => {
      const { negotiationId } = await createNegotiationWithBids();

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}/ranking`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);

      const data = res.body.data;
      expect(data.rank).toBeUndefined();
      expect(data.bidder_count).toBeUndefined();
      expect(data.total_bidders).toBeUndefined();
    });
  });

  // ── SEC-T02-NEG: Supplier negotiation detail has no competitor data ──
  describe('SEC-T02-NEG: Supplier negotiation detail contains no competitor data', () => {
    it('should NOT contain suppliers array or buyer_id in supplier view', async () => {
      const { negotiationId } = await createNegotiationWithBids();

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);

      const data = res.body.data;
      expect(data.suppliers).toBeUndefined();
      expect(data.buyer_id).toBeUndefined();
    });

    it('supplier response body should contain zero references to competitor supplier data', async () => {
      const { negotiationId } = await createNegotiationWithBids();

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);

      const body = JSON.stringify(res.body);
      // Should not contain supplier2's unique code or ID
      expect(body).not.toContain(supplier2.uniqueCode);
      expect(body).not.toContain(supplier2.supplierId);
      expect(body).not.toContain(supplier2.userId);
    });
  });

  // ── Cross-supplier access ──
  describe('Cross-supplier access control', () => {
    it('supplier not in negotiation should get 403 for GET negotiation', async () => {
      const { negotiationId } = await createNegotiationWithBids();

      // supplier3 is NOT in the negotiation
      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}`)
        .set('Authorization', `Bearer ${supplier3Token}`);

      expect(res.status).toBe(403);
    });

    it('supplier not in negotiation should get 403 for POST bid', async () => {
      const { negotiationId, item1Id, item2Id } = await createNegotiationWithBids();

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

    it('supplier not in negotiation should get 403 for ranking', async () => {
      const { negotiationId } = await createNegotiationWithBids();

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}/ranking`)
        .set('Authorization', `Bearer ${supplier3Token}`);

      expect(res.status).toBe(403);
    });

    it('supplier not in negotiation should get 403 for bid-status', async () => {
      const { negotiationId } = await createNegotiationWithBids();

      const res = await request
        .get(`/api/supplier/negotiations/${negotiationId}/bid-status`)
        .set('Authorization', `Bearer ${supplier3Token}`);

      expect(res.status).toBe(403);
    });
  });

  // ── Cross-buyer access ──
  describe('Cross-buyer access control', () => {
    it('different buyer should get 404 for buyer negotiation endpoints', async () => {
      const { negotiationId } = await createNegotiationWithBids();

      const otherBuyer = await createTestUser({ email: 'other-buyer@test.com', role: 'BUYER' });
      const otherToken = getAccessToken(otherBuyer.id, UserRole.BUYER);

      const detailRes = await request
        .get(`/api/buyer/negotiations/${negotiationId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(detailRes.status).toBe(404);

      const rankRes = await request
        .get(`/api/buyer/negotiations/${negotiationId}/rankings`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(rankRes.status).toBe(404);
    });
  });

  // ── Role enforcement ──
  describe('Role enforcement', () => {
    it('supplier cannot access buyer negotiation endpoints', async () => {
      const { negotiationId } = await createNegotiationWithBids();

      const detailRes = await request
        .get(`/api/buyer/negotiations/${negotiationId}`)
        .set('Authorization', `Bearer ${supplier1Token}`);
      expect(detailRes.status).toBe(403);

      const rankRes = await request
        .get(`/api/buyer/negotiations/${negotiationId}/rankings`)
        .set('Authorization', `Bearer ${supplier1Token}`);
      expect(rankRes.status).toBe(403);

      const closeRes = await request
        .post(`/api/buyer/negotiations/${negotiationId}/close`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ confirm: true });
      expect(closeRes.status).toBe(403);

      const awardRes = await request
        .post(`/api/buyer/negotiations/${negotiationId}/award`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ type: 'single', allocations: [{ supplier_id: supplier1.supplierId }] });
      expect(awardRes.status).toBe(403);
    });

    it('buyer cannot access supplier negotiation endpoints', async () => {
      const { negotiationId, item1Id, item2Id } = await createNegotiationWithBids();

      const detailRes = await request
        .get(`/api/supplier/negotiations/${negotiationId}`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(detailRes.status).toBe(403);

      const bidRes = await request
        .post(`/api/supplier/negotiations/${negotiationId}/bids`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [
            { rfq_item_id: item1Id, unit_price: 10 },
            { rfq_item_id: item2Id, unit_price: 20 },
          ],
        });
      expect(bidRes.status).toBe(403);

      const rankRes = await request
        .get(`/api/supplier/negotiations/${negotiationId}/ranking`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(rankRes.status).toBe(403);

      const statusRes = await request
        .get(`/api/supplier/negotiations/${negotiationId}/bid-status`)
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(statusRes.status).toBe(403);
    });

    it('admin cannot access supplier negotiation endpoints', async () => {
      const adminUser = await createTestUser({ email: 'admin@test.com', role: 'ADMIN' });
      const adminToken = getAccessToken(adminUser.id, UserRole.ADMIN);

      const { negotiationId } = await createNegotiationWithBids();

      const detailRes = await request
        .get(`/api/supplier/negotiations/${negotiationId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detailRes.status).toBe(403);

      const rankRes = await request
        .get(`/api/supplier/negotiations/${negotiationId}/ranking`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(rankRes.status).toBe(403);
    });
  });
});
