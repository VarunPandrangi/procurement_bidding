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
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

const request = supertest(app);

let buyerUser: { id: string; email: string; role: string; password: string };
let buyerToken: string;
let supplier1: { userId: string; supplierId: string; email: string; uniqueCode: string; password: string };
let supplier1Token: string;
let supplier2: { userId: string; supplierId: string; email: string; uniqueCode: string; password: string };
let supplier2Token: string;
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
  supplier2Token = getAccessToken(supplier2.userId, UserRole.SUPPLIER);

  supplier3 = await createTestSupplier({ email: 's3@test.com', company_name: 'Supplier 3 Co' });
  supplier3Token = getAccessToken(supplier3.userId, UserRole.SUPPLIER);
});

// Helper: create an RFQ with bids from 3 suppliers at different price levels
async function createRankedScenario(): Promise<{
  rfqId: string;
  item1Id: string;
  item2Id: string;
}> {
  const rfq = await createTestRfq({
    buyer_id: buyerUser.id,
    title: 'Ranking Test RFQ',
    status: 'ACTIVE',
    bid_open_at: new Date(Date.now() - 3600000).toISOString(),
    bid_close_at: new Date(Date.now() + 3600000).toISOString(),
    weight_price: 100,
    weight_delivery: 0,
    weight_payment: 0,
  });

  const item1 = await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Widget A', uom: 'PCS', quantity: 100 });
  const item2 = await createTestRfqItem(rfq.id, { sl_no: 2, description: 'Widget B', uom: 'KG', quantity: 50 });

  await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
  await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });
  await assignTestSupplier(rfq.id, supplier3.supplierId, supplier3.uniqueCode, { status: 'ACCEPTED' });

  // Supplier1: cheapest (L1)
  await createTestBid({
    rfq_id: rfq.id,
    supplier_id: supplier1.supplierId,
    supplier_code: supplier1.uniqueCode,
    items: [
      { rfq_item_id: item1.id, unit_price: 10, quantity: 100 },
      { rfq_item_id: item2.id, unit_price: 20, quantity: 50 },
    ],
  });

  // Supplier2: mid-range (L2, within 1% of L1)
  await createTestBid({
    rfq_id: rfq.id,
    supplier_id: supplier2.supplierId,
    supplier_code: supplier2.uniqueCode,
    items: [
      { rfq_item_id: item1.id, unit_price: 10.1, quantity: 100 },
      { rfq_item_id: item2.id, unit_price: 20.1, quantity: 50 },
    ],
  });

  // Supplier3: most expensive (L3, >10% above L1)
  await createTestBid({
    rfq_id: rfq.id,
    supplier_id: supplier3.supplierId,
    supplier_code: supplier3.uniqueCode,
    items: [
      { rfq_item_id: item1.id, unit_price: 15, quantity: 100 },
      { rfq_item_id: item2.id, unit_price: 30, quantity: 50 },
    ],
  });

  return { rfqId: rfq.id, item1Id: item1.id, item2Id: item2.id };
}

describe('Ranking Integration Tests', () => {
  describe('GET /api/supplier/rfqs/:id/ranking — Supplier ranking view', () => {
    it('should return GREEN rank_color for L1 supplier', async () => {
      const { rfqId } = await createRankedScenario();

      const res = await request
        .get(`/api/supplier/rfqs/${rfqId}/ranking`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rank_color).toBe('GREEN');
    });

    it('should return YELLOW rank_color for L2 supplier', async () => {
      const { rfqId } = await createRankedScenario();

      const res = await request
        .get(`/api/supplier/rfqs/${rfqId}/ranking`)
        .set('Authorization', `Bearer ${supplier2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.rank_color).toBe('YELLOW');
    });

    it('should return RED rank_color for L3+ supplier', async () => {
      const { rfqId } = await createRankedScenario();

      const res = await request
        .get(`/api/supplier/rfqs/${rfqId}/ranking`)
        .set('Authorization', `Bearer ${supplier3Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.rank_color).toBe('RED');
    });

    it('should return correct proximity labels', async () => {
      const { rfqId } = await createRankedScenario();

      // L1 supplier — proximity is null (they ARE L1)
      const res1 = await request
        .get(`/api/supplier/rfqs/${rfqId}/ranking`)
        .set('Authorization', `Bearer ${supplier1Token}`);
      expect(res1.body.data.proximity_label).toBeNull();

      // L2 supplier — very close (within 2%)
      const res2 = await request
        .get(`/api/supplier/rfqs/${rfqId}/ranking`)
        .set('Authorization', `Bearer ${supplier2Token}`);
      expect(res2.body.data.proximity_label).toBe('VERY_CLOSE');

      // L3 supplier — far (>10%)
      const res3 = await request
        .get(`/api/supplier/rfqs/${rfqId}/ranking`)
        .set('Authorization', `Bearer ${supplier3Token}`);
      expect(res3.body.data.proximity_label).toBe('FAR');
    });

    it('should return own prices only', async () => {
      const { rfqId, item1Id, item2Id } = await createRankedScenario();

      const res = await request
        .get(`/api/supplier/rfqs/${rfqId}/ranking`)
        .set('Authorization', `Bearer ${supplier2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.own_items).toHaveLength(2);

      const ownItem1 = res.body.data.own_items.find((i: { rfq_item_id: string }) => i.rfq_item_id === item1Id);
      expect(ownItem1).toBeDefined();
      expect(parseFloat(ownItem1.unit_price)).toBeCloseTo(10.1, 1);

      const ownItem2 = res.body.data.own_items.find((i: { rfq_item_id: string }) => i.rfq_item_id === item2Id);
      expect(ownItem2).toBeDefined();
      expect(parseFloat(ownItem2.unit_price)).toBeCloseTo(20.1, 1);
    });

    it('should return 401 without auth token', async () => {
      const { rfqId } = await createRankedScenario();

      const res = await request.get(`/api/supplier/rfqs/${rfqId}/ranking`);

      expect(res.status).toBe(401);
    });

    it('should return 403 for unassigned supplier', async () => {
      const unassigned = await createTestSupplier({ email: 'unassigned@test.com' });
      const unassignedToken = getAccessToken(unassigned.userId, UserRole.SUPPLIER);

      const { rfqId } = await createRankedScenario();

      const res = await request
        .get(`/api/supplier/rfqs/${rfqId}/ranking`)
        .set('Authorization', `Bearer ${unassignedToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/buyer/rfqs/:id/rankings — Buyer full ranking view', () => {
    it('should return full ranking data with supplier codes, prices, and ranks', async () => {
      const { rfqId } = await createRankedScenario();

      const res = await request
        .get(`/api/buyer/rfqs/${rfqId}/rankings`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Item rankings
      expect(res.body.data.item_rankings).toHaveLength(2);
      expect(res.body.data.item_rankings[0].bidder_count).toBe(3);
      expect(res.body.data.item_rankings[0].l1_supplier_code).toBeDefined();
      expect(res.body.data.item_rankings[0].l1_price).toBeDefined();
      expect(res.body.data.item_rankings[0].rankings).toHaveLength(3);

      // Total rankings
      expect(res.body.data.total_rankings).toHaveLength(3);
      expect(res.body.data.total_rankings[0].rank).toBe(1);
      expect(res.body.data.total_rankings[0].supplier_code).toBeDefined();

      // Weighted rankings
      expect(res.body.data.weighted_rankings).toHaveLength(3);
      expect(res.body.data.weighted_rankings[0].rank).toBe(1);
      expect(res.body.data.weighted_rankings[0].score_breakdown).toBeDefined();
    });

    it('should return 404 for wrong buyer', async () => {
      const { rfqId } = await createRankedScenario();

      const otherBuyer = await createTestUser({ email: 'buyer2@test.com', role: 'BUYER' });
      const otherBuyerToken = getAccessToken(otherBuyer.id, UserRole.BUYER);

      const res = await request
        .get(`/api/buyer/rfqs/${rfqId}/rankings`)
        .set('Authorization', `Bearer ${otherBuyerToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 403 for SUPPLIER role', async () => {
      const { rfqId } = await createRankedScenario();

      const res = await request
        .get(`/api/buyer/rfqs/${rfqId}/rankings`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(403);
    });
  });
});
