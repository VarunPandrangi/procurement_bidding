import supertest from 'supertest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  connectTestRedis,
  cleanRedis,
  closeTestRedis,
  createTestUser,
  createTestRfq,
  createTestRfqItem,
  createTestSupplier,
  assignTestSupplier,
  createTestBid,
  getAccessToken,
  app,
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

const request = supertest(app);

describe('KPI Endpoints', () => {
  let buyerA: { id: string; email: string; role: string; password: string };
  let buyerB: { id: string; email: string; role: string; password: string };
  let admin: { id: string; email: string; role: string; password: string };
  let buyerAToken: string;
  let adminToken: string;

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
    buyerA = await createTestUser({ role: 'BUYER' });
    buyerB = await createTestUser({ role: 'BUYER' });
    admin = await createTestUser({ role: 'ADMIN' });
    buyerAToken = getAccessToken(buyerA.id, UserRole.BUYER);
    adminToken = getAccessToken(admin.id, UserRole.ADMIN);
  });

  describe('GET /api/buyer/kpis', () => {
    it('should return correct KPI shape with no data', async () => {
      const res = await request
        .get('/api/buyer/kpis')
        .set('Authorization', `Bearer ${buyerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('cycle_time_hours');
      expect(res.body.data).toHaveProperty('savings_pct');
      expect(res.body.data).toHaveProperty('participation_ratio_pct');
      expect(res.body.data).toHaveProperty('price_convergence_cv');
      expect(res.body.data).toHaveProperty('rfq_count');
      expect(res.body.data.rfq_count).toBe(0);
    });

    it('should calculate participation ratio correctly', async () => {
      const supplier1 = await createTestSupplier();
      const supplier2 = await createTestSupplier();
      const supplier3 = await createTestSupplier();

      // Create a PUBLISHED RFQ for buyer A with 3 suppliers, 2 accepted
      const rfq = await createTestRfq({ buyer_id: buyerA.id, status: 'PUBLISHED' });
      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
      await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });
      await assignTestSupplier(rfq.id, supplier3.supplierId, supplier3.uniqueCode, { status: 'DECLINED' });

      const res = await request
        .get('/api/buyer/kpis')
        .set('Authorization', `Bearer ${buyerAToken}`);

      expect(res.status).toBe(200);
      // 2 accepted / 3 assigned = 66.67
      expect(res.body.data.participation_ratio_pct).toBeCloseTo(66.67, 1);
      expect(res.body.data.rfq_count).toBe(1);
    });

    it('should return buyer isolation — buyer A cannot see buyer B data', async () => {
      const supplier1 = await createTestSupplier();
      const supplier2 = await createTestSupplier();

      // Create RFQ for buyer B only
      const rfqB = await createTestRfq({ buyer_id: buyerB.id, status: 'PUBLISHED' });
      await assignTestSupplier(rfqB.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
      await assignTestSupplier(rfqB.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });

      // Buyer A should see 0 rfqs
      const res = await request
        .get('/api/buyer/kpis')
        .set('Authorization', `Bearer ${buyerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.rfq_count).toBe(0);
      expect(res.body.data.participation_ratio_pct).toBeNull();
    });

    it('should calculate price convergence CV for closed RFQ', async () => {
      const supplier1 = await createTestSupplier();
      const supplier2 = await createTestSupplier();

      const rfq = await createTestRfq({ buyer_id: buyerA.id, status: 'CLOSED' });
      const item = await createTestRfqItem(rfq.id, { sl_no: 1, quantity: 10 });

      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
      await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });

      // Supplier 1 bids 100 per unit = total 1000
      await createTestBid({
        rfq_id: rfq.id,
        supplier_id: supplier1.supplierId,
        supplier_code: supplier1.uniqueCode,
        items: [{ rfq_item_id: item.id, unit_price: 100, quantity: 10 }],
      });

      // Supplier 2 bids 120 per unit = total 1200
      await createTestBid({
        rfq_id: rfq.id,
        supplier_id: supplier2.supplierId,
        supplier_code: supplier2.uniqueCode,
        items: [{ rfq_item_id: item.id, unit_price: 120, quantity: 10 }],
      });

      const res = await request
        .get('/api/buyer/kpis')
        .set('Authorization', `Bearer ${buyerAToken}`);

      expect(res.status).toBe(200);
      // prices = [1000, 1200], mean=1100, std=100, cv = 100/1100*100 ≈ 9.09
      expect(res.body.data.price_convergence_cv).not.toBeNull();
      expect(res.body.data.price_convergence_cv).toBeGreaterThan(0);
    });

    it('should respect date range filters', async () => {
      const supplier1 = await createTestSupplier();
      const supplier2 = await createTestSupplier();

      const rfq = await createTestRfq({ buyer_id: buyerA.id, status: 'PUBLISHED' });
      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
      await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });

      // Query with future date range — should return 0 RFQs
      const futureFrom = new Date('2030-01-01T00:00:00Z').toISOString();
      const futureTo = new Date('2030-12-31T23:59:59Z').toISOString();

      const res = await request
        .get(`/api/buyer/kpis?from=${futureFrom}&to=${futureTo}`)
        .set('Authorization', `Bearer ${buyerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.rfq_count).toBe(0);
    });

    it('should return 401 without authentication', async () => {
      const res = await request.get('/api/buyer/kpis');
      expect(res.status).toBe(401);
    });

    it('should return 403 for supplier role', async () => {
      const supplier = await createTestSupplier();
      const supplierToken = getAccessToken(supplier.userId, UserRole.SUPPLIER);

      const res = await request
        .get('/api/buyer/kpis')
        .set('Authorization', `Bearer ${supplierToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/kpis', () => {
    it('should return correct shape including supplier_competitiveness', async () => {
      const res = await request
        .get('/api/admin/kpis')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('cycle_time_hours');
      expect(res.body.data).toHaveProperty('savings_pct');
      expect(res.body.data).toHaveProperty('participation_ratio_pct');
      expect(res.body.data).toHaveProperty('price_convergence_cv');
      expect(res.body.data).toHaveProperty('rfq_count');
      expect(res.body.data).toHaveProperty('supplier_competitiveness');
      expect(Array.isArray(res.body.data.supplier_competitiveness)).toBe(true);
    });

    it('should see all buyers data aggregated', async () => {
      const supplier1 = await createTestSupplier();
      const supplier2 = await createTestSupplier();

      // Create RFQ for buyer A
      const rfqA = await createTestRfq({ buyer_id: buyerA.id, status: 'PUBLISHED' });
      await assignTestSupplier(rfqA.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
      await assignTestSupplier(rfqA.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });

      // Create RFQ for buyer B
      const rfqB = await createTestRfq({ buyer_id: buyerB.id, status: 'PUBLISHED' });
      await assignTestSupplier(rfqB.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
      await assignTestSupplier(rfqB.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'DECLINED' });

      const res = await request
        .get('/api/admin/kpis')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // Admin should see 2 RFQs total
      expect(res.body.data.rfq_count).toBe(2);
    });

    it('should return supplier competitiveness for closed RFQs', async () => {
      const supplier1 = await createTestSupplier();
      const supplier2 = await createTestSupplier();

      const rfq = await createTestRfq({ buyer_id: buyerA.id, status: 'CLOSED' });
      const item = await createTestRfqItem(rfq.id, { sl_no: 1, quantity: 10 });

      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
      await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });

      // Supplier 1 bids lower (L1)
      await createTestBid({
        rfq_id: rfq.id,
        supplier_id: supplier1.supplierId,
        supplier_code: supplier1.uniqueCode,
        items: [{ rfq_item_id: item.id, unit_price: 100, quantity: 10 }],
      });

      // Supplier 2 bids higher
      await createTestBid({
        rfq_id: rfq.id,
        supplier_id: supplier2.supplierId,
        supplier_code: supplier2.uniqueCode,
        items: [{ rfq_item_id: item.id, unit_price: 120, quantity: 10 }],
      });

      const res = await request
        .get('/api/admin/kpis')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const competitiveness = res.body.data.supplier_competitiveness;
      expect(competitiveness.length).toBeGreaterThan(0);
      // Supplier 1 should be L1 with 100% index
      const s1Entry = competitiveness.find(
        (s: { supplier_code: string }) => s.supplier_code === supplier1.uniqueCode,
      );
      expect(s1Entry).toBeDefined();
      expect(s1Entry.index_pct).toBe(100);
    });

    it('should return 401 without authentication', async () => {
      const res = await request.get('/api/admin/kpis');
      expect(res.status).toBe(401);
    });

    it('should return 403 for buyer role', async () => {
      const res = await request
        .get('/api/admin/kpis')
        .set('Authorization', `Bearer ${buyerAToken}`);

      expect(res.status).toBe(403);
    });
  });
});
