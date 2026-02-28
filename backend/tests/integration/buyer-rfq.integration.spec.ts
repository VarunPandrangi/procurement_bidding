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

  buyerUser = await createTestUser({
    email: 'buyer@test.com',
    password: 'BuyerPass123',
    role: 'BUYER',
    full_name: 'Test Buyer',
  });
  buyerToken = getAccessToken(buyerUser.id, UserRole.BUYER);
});

describe('Buyer RFQ Integration Tests', () => {
  // ─── POST /api/buyer/rfqs ─────────────────────────────────────────────
  describe('POST /api/buyer/rfqs', () => {
    it('should create an RFQ in DRAFT with auto-generated number (201)', async () => {
      const res = await request
        .post('/api/buyer/rfqs')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ title: 'Office Supplies Q1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Office Supplies Q1');
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.buyer_id).toBe(buyerUser.id);
      expect(res.body.data.rfq_number).toMatch(/^RFQ-\d{4}-\d{4}$/);
      expect(res.body.data.items).toEqual([]);
    });

    it('should create an RFQ with items (201)', async () => {
      const res = await request
        .post('/api/buyer/rfqs')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          title: 'Widgets RFQ',
          items: [
            { sl_no: 1, description: 'Widget A', uom: 'PCS', quantity: 100 },
            { sl_no: 2, description: 'Widget B', uom: 'KG', quantity: 50.5 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.items[0].description).toBe('Widget A');
      expect(res.body.data.items[1].description).toBe('Widget B');
    });

    it('should create an RFQ with commercial terms (201)', async () => {
      const res = await request
        .post('/api/buyer/rfqs')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          title: 'Terms RFQ',
          payment_terms: 'Net 30',
          freight_terms: 'FOB Destination',
          delivery_lead_time_days: 14,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.payment_terms).toBe('Net 30');
      expect(res.body.data.freight_terms).toBe('FOB Destination');
      expect(res.body.data.delivery_lead_time_days).toBe(14);
    });

    it('should return 422 for missing title', async () => {
      const res = await request
        .post('/api/buyer/rfqs')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without auth token', async () => {
      const res = await request
        .post('/api/buyer/rfqs')
        .send({ title: 'No Auth RFQ' });

      expect(res.status).toBe(401);
    });

    it('should return 403 for SUPPLIER role', async () => {
      const supplier = await createTestSupplier({ email: 'sup@test.com' });
      const supToken = getAccessToken(supplier.userId, UserRole.SUPPLIER);

      const res = await request
        .post('/api/buyer/rfqs')
        .set('Authorization', `Bearer ${supToken}`)
        .send({ title: 'Forbidden RFQ' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 403 for ADMIN role', async () => {
      const admin = await createTestUser({ email: 'admin@test.com', role: 'ADMIN' });
      const adminToken = getAccessToken(admin.id, UserRole.ADMIN);

      const res = await request
        .post('/api/buyer/rfqs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin Forbidden RFQ' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should create audit log entry for RFQ creation', async () => {
      const res = await request
        .post('/api/buyer/rfqs')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ title: 'Audit Test RFQ' });

      expect(res.status).toBe(201);

      const db = getTestDb();
      const auditEntries = await db('audit_log')
        .where({ event_type: 'RFQ_CREATED', rfq_id: res.body.data.id });

      expect(auditEntries.length).toBe(1);
      expect(auditEntries[0].actor_type).toBe('BUYER');
      expect(auditEntries[0].actor_id).toBe(buyerUser.id);
    });
  });

  // ─── GET /api/buyer/rfqs ──────────────────────────────────────────────
  describe('GET /api/buyer/rfqs', () => {
    it('should return buyer own RFQs (200)', async () => {
      await createTestRfq({ buyer_id: buyerUser.id, title: 'RFQ One' });
      await createTestRfq({ buyer_id: buyerUser.id, title: 'RFQ Two' });

      const res = await request
        .get('/api/buyer/rfqs')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.pagination).toBeDefined();
      expect(res.body.meta.pagination.total).toBe(2);
    });

    it('should NOT include other buyer RFQs (RBAC scoping)', async () => {
      const buyer2 = await createTestUser({ email: 'buyer2@test.com', role: 'BUYER' });
      await createTestRfq({ buyer_id: buyerUser.id, title: 'My RFQ' });
      await createTestRfq({ buyer_id: buyer2.id, title: 'Other RFQ' });

      const res = await request
        .get('/api/buyer/rfqs')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('My RFQ');
    });

    it('should support pagination', async () => {
      await createTestRfq({ buyer_id: buyerUser.id, title: 'RFQ 1' });
      await createTestRfq({ buyer_id: buyerUser.id, title: 'RFQ 2' });
      await createTestRfq({ buyer_id: buyerUser.id, title: 'RFQ 3' });

      const res = await request
        .get('/api/buyer/rfqs?page=1&limit=2')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.pagination.total).toBe(3);
      expect(res.body.meta.pagination.totalPages).toBe(2);
    });

    it('should support status filter', async () => {
      await createTestRfq({ buyer_id: buyerUser.id, title: 'Draft RFQ', status: 'DRAFT' });
      await createTestRfq({ buyer_id: buyerUser.id, title: 'Published RFQ', status: 'PUBLISHED' });

      const res = await request
        .get('/api/buyer/rfqs?status=DRAFT')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Draft RFQ');
    });

    it('should return empty array for buyer with no RFQs', async () => {
      const res = await request
        .get('/api/buyer/rfqs')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta.pagination.total).toBe(0);
    });
  });

  // ─── GET /api/buyer/rfqs/:id ──────────────────────────────────────────
  describe('GET /api/buyer/rfqs/:id', () => {
    it('should return RFQ with items and suppliers (200)', async () => {
      const rfq = await createTestRfq({ buyer_id: buyerUser.id, title: 'Detail RFQ' });
      await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Item 1', uom: 'PCS', quantity: 10 });

      const supplier = await createTestSupplier({ email: 'sup@test.com' });
      await assignTestSupplier(rfq.id, supplier.supplierId, supplier.uniqueCode);

      const res = await request
        .get(`/api/buyer/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(rfq.id);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.suppliers).toHaveLength(1);
      expect(res.body.data.suppliers[0].company_name).toBe('Test Supplier Co');
    });

    it('should return 404 for other buyer RFQ (RBAC)', async () => {
      const buyer2 = await createTestUser({ email: 'buyer2@test.com', role: 'BUYER' });
      const rfq = await createTestRfq({ buyer_id: buyer2.id, title: 'Other RFQ' });

      const res = await request
        .get(`/api/buyer/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RFQ_NOT_FOUND');
    });

    it('should return 404 for non-existent UUID', async () => {
      const res = await request
        .get('/api/buyer/rfqs/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 without auth', async () => {
      const rfq = await createTestRfq({ buyer_id: buyerUser.id });
      const res = await request.get(`/api/buyer/rfqs/${rfq.id}`);
      expect(res.status).toBe(401);
    });
  });

  // ─── PUT /api/buyer/rfqs/:id ──────────────────────────────────────────
  describe('PUT /api/buyer/rfqs/:id', () => {
    it('should update title in DRAFT (200)', async () => {
      const rfq = await createTestRfq({ buyer_id: buyerUser.id, title: 'Old Title' });

      const res = await request
        .put(`/api/buyer/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('New Title');
    });

    it('should update commercial terms in DRAFT (200)', async () => {
      const rfq = await createTestRfq({ buyer_id: buyerUser.id });

      const res = await request
        .put(`/api/buyer/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ payment_terms: 'Net 60', freight_terms: 'CIF' });

      expect(res.status).toBe(200);
      expect(res.body.data.payment_terms).toBe('Net 60');
      expect(res.body.data.freight_terms).toBe('CIF');
    });

    it('should update items (replace) in DRAFT (200)', async () => {
      const rfq = await createTestRfq({ buyer_id: buyerUser.id });
      await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Old Item' });

      const res = await request
        .put(`/api/buyer/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [
            { sl_no: 1, description: 'New Item A', uom: 'PCS', quantity: 50 },
            { sl_no: 2, description: 'New Item B', uom: 'KG', quantity: 25 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.items[0].description).toBe('New Item A');
    });

    it('should return 409 when status is not DRAFT', async () => {
      const rfq = await createTestRfq({
        buyer_id: buyerUser.id,
        status: 'PUBLISHED',
      });

      const res = await request
        .put(`/api/buyer/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RFQ_NOT_DRAFT');
    });

    it('should return 409 when commercial terms are locked (payment_terms)', async () => {
      const rfq = await createTestRfq({ buyer_id: buyerUser.id });
      const db = getTestDb();
      await db('rfqs').where('id', rfq.id).update({
        commercial_locked_at: new Date(),
        commercial_locked_by_supplier_code: 'ABC12',
      });

      const res = await request
        .put(`/api/buyer/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ payment_terms: 'Net 90' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('COMMERCIAL_LOCKED');
    });

    it('should return 409 when items are locked', async () => {
      const rfq = await createTestRfq({ buyer_id: buyerUser.id });
      const db = getTestDb();
      await db('rfqs').where('id', rfq.id).update({
        commercial_locked_at: new Date(),
        commercial_locked_by_supplier_code: 'ABC12',
      });

      const res = await request
        .put(`/api/buyer/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ items: [{ sl_no: 1, description: 'Locked item', uom: 'PCS', quantity: 1 }] });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('COMMERCIAL_LOCKED');
    });

    it('should allow non-commercial field update even after lock (200)', async () => {
      const rfq = await createTestRfq({ buyer_id: buyerUser.id, title: 'Original' });
      const db = getTestDb();
      await db('rfqs').where('id', rfq.id).update({
        commercial_locked_at: new Date(),
        commercial_locked_by_supplier_code: 'ABC12',
      });

      const res = await request
        .put(`/api/buyer/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ title: 'Updated Title After Lock' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Title After Lock');
    });

    it('should return 404 for other buyer RFQ', async () => {
      const buyer2 = await createTestUser({ email: 'buyer2@test.com', role: 'BUYER' });
      const rfq = await createTestRfq({ buyer_id: buyer2.id });

      const res = await request
        .put(`/api/buyer/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RFQ_NOT_FOUND');
    });
  });

  // ─── POST /api/buyer/rfqs/:id/publish ─────────────────────────────────
  describe('POST /api/buyer/rfqs/:id/publish', () => {
    it('should transition DRAFT → PUBLISHED (200)', async () => {
      const supplier1 = await createTestSupplier({ email: 's1@test.com' });
      const supplier2 = await createTestSupplier({ email: 's2@test.com' });

      const rfq = await createTestRfq({
        buyer_id: buyerUser.id,
        payment_terms: 'Net 30',
      });
      await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Item A' });
      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode);
      await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode);

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/publish`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PUBLISHED');
    });

    it('should return 409 when already PUBLISHED', async () => {
      const rfq = await createTestRfq({
        buyer_id: buyerUser.id,
        status: 'PUBLISHED',
      });

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/publish`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should return 422 when no items exist', async () => {
      const supplier1 = await createTestSupplier({ email: 's1@test.com' });
      const supplier2 = await createTestSupplier({ email: 's2@test.com' });

      const rfq = await createTestRfq({
        buyer_id: buyerUser.id,
        payment_terms: 'Net 30',
      });
      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode);
      await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode);

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/publish`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('PUBLISH_VALIDATION_FAILED');
    });

    it('should return 422 when fewer than 2 suppliers assigned', async () => {
      const supplier1 = await createTestSupplier({ email: 's1@test.com' });

      const rfq = await createTestRfq({
        buyer_id: buyerUser.id,
        payment_terms: 'Net 30',
      });
      await createTestRfqItem(rfq.id);
      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode);

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/publish`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('PUBLISH_VALIDATION_FAILED');
    });

    it('should return 422 when payment_terms is missing', async () => {
      const supplier1 = await createTestSupplier({ email: 's1@test.com' });
      const supplier2 = await createTestSupplier({ email: 's2@test.com' });

      const rfq = await createTestRfq({ buyer_id: buyerUser.id });
      await createTestRfqItem(rfq.id);
      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode);
      await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode);

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/publish`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('PUBLISH_VALIDATION_FAILED');
    });

    it('should return 404 for other buyer RFQ', async () => {
      const buyer2 = await createTestUser({ email: 'buyer2@test.com', role: 'BUYER' });
      const rfq = await createTestRfq({ buyer_id: buyer2.id });

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/publish`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(404);
    });

    it('should create RFQ_PUBLISHED audit entry', async () => {
      const supplier1 = await createTestSupplier({ email: 's1@test.com' });
      const supplier2 = await createTestSupplier({ email: 's2@test.com' });

      const rfq = await createTestRfq({
        buyer_id: buyerUser.id,
        payment_terms: 'Net 30',
      });
      await createTestRfqItem(rfq.id);
      await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode);
      await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode);

      await request
        .post(`/api/buyer/rfqs/${rfq.id}/publish`)
        .set('Authorization', `Bearer ${buyerToken}`);

      const db = getTestDb();
      const entries = await db('audit_log')
        .where({ event_type: 'RFQ_PUBLISHED', rfq_id: rfq.id });

      expect(entries.length).toBe(1);
    });
  });

  // ─── POST /api/buyer/rfqs/:id/suppliers ───────────────────────────────
  describe('POST /api/buyer/rfqs/:id/suppliers', () => {
    it('should assign 2 suppliers successfully (201)', async () => {
      const s1 = await createTestSupplier({ email: 's1@test.com' });
      const s2 = await createTestSupplier({ email: 's2@test.com' });
      const rfq = await createTestRfq({ buyer_id: buyerUser.id });

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [s1.supplierId, s2.supplierId] });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].access_token).toBeDefined();
      expect(res.body.data[0].status).toBe('PENDING');
    });

    it('should return 422 for fewer than 2 suppliers', async () => {
      const s1 = await createTestSupplier({ email: 's1@test.com' });
      const rfq = await createTestRfq({ buyer_id: buyerUser.id });

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [s1.supplierId] });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 when RFQ is not DRAFT', async () => {
      const s1 = await createTestSupplier({ email: 's1@test.com' });
      const s2 = await createTestSupplier({ email: 's2@test.com' });
      const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'PUBLISHED' });

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [s1.supplierId, s2.supplierId] });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RFQ_NOT_DRAFT');
    });

    it('should return 404 for non-existent supplier UUID', async () => {
      const s1 = await createTestSupplier({ email: 's1@test.com' });
      const rfq = await createTestRfq({ buyer_id: buyerUser.id });

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          supplier_ids: [s1.supplierId, '00000000-0000-0000-0000-000000000099'],
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SUPPLIER_NOT_FOUND');
    });

    it('should return 404 for other buyer RFQ', async () => {
      const buyer2 = await createTestUser({ email: 'buyer2@test.com', role: 'BUYER' });
      const rfq = await createTestRfq({ buyer_id: buyer2.id });
      const s1 = await createTestSupplier({ email: 's1@test.com' });
      const s2 = await createTestSupplier({ email: 's2@test.com' });

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [s1.supplierId, s2.supplierId] });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RFQ_NOT_FOUND');
    });

    it('should return 409 for duplicate assignment', async () => {
      const s1 = await createTestSupplier({ email: 's1@test.com' });
      const s2 = await createTestSupplier({ email: 's2@test.com' });
      const s3 = await createTestSupplier({ email: 's3@test.com' });
      const rfq = await createTestRfq({ buyer_id: buyerUser.id });

      // First assignment — success
      await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [s1.supplierId, s2.supplierId] });

      // Second assignment with duplicate s1
      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [s1.supplierId, s3.supplierId] });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SUPPLIER_ALREADY_ASSIGNED');
    });
  });
});
