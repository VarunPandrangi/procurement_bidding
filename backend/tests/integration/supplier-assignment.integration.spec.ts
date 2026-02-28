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
  getAccessToken,
  getTestDb,
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

const request = supertest(app);

let buyerUser: { id: string; email: string; role: string; password: string };
let buyerToken: string;
let rfq: { id: string; rfq_number: string; buyer_id: string; status: string };
let supplier1: { userId: string; supplierId: string; email: string; uniqueCode: string; password: string };
let supplier2: { userId: string; supplierId: string; email: string; uniqueCode: string; password: string };
let supplier3: { userId: string; supplierId: string; email: string; uniqueCode: string; password: string };

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

  rfq = await createTestRfq({ buyer_id: buyerUser.id, title: 'Assignment Test RFQ' });

  supplier1 = await createTestSupplier({ email: 's1@test.com', company_name: 'Supplier 1 Co' });
  supplier2 = await createTestSupplier({ email: 's2@test.com', company_name: 'Supplier 2 Co' });
  supplier3 = await createTestSupplier({ email: 's3@test.com', company_name: 'Supplier 3 Co' });
});

describe('Supplier Assignment Integration Tests', () => {
  describe('POST /api/buyer/rfqs/:id/suppliers', () => {
    it('should assign exactly 2 suppliers successfully (201)', async () => {
      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [supplier1.supplierId, supplier2.supplierId] });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should assign 5 suppliers successfully (201)', async () => {
      const s4 = await createTestSupplier({ email: 's4@test.com' });
      const s5 = await createTestSupplier({ email: 's5@test.com' });

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          supplier_ids: [
            supplier1.supplierId,
            supplier2.supplierId,
            supplier3.supplierId,
            s4.supplierId,
            s5.supplierId,
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(5);
    });

    it('should set each assignment status to PENDING', async () => {
      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [supplier1.supplierId, supplier2.supplierId] });

      expect(res.status).toBe(201);
      for (const assignment of res.body.data) {
        expect(assignment.status).toBe('PENDING');
      }
    });

    it('should generate non-null access_token for each assignment', async () => {
      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [supplier1.supplierId, supplier2.supplierId] });

      expect(res.status).toBe(201);
      for (const assignment of res.body.data) {
        expect(assignment.access_token).toBeDefined();
        expect(typeof assignment.access_token).toBe('string');
        expect(assignment.access_token.length).toBeGreaterThan(0);
      }
    });

    it('should set access_token_expires_at in the future', async () => {
      const now = new Date();
      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [supplier1.supplierId, supplier2.supplierId] });

      expect(res.status).toBe(201);
      for (const assignment of res.body.data) {
        expect(assignment.access_token_expires_at).toBeDefined();
        const expiresAt = new Date(assignment.access_token_expires_at);
        expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
      }
    });

    it('should include correct supplier_code for each assignment', async () => {
      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [supplier1.supplierId, supplier2.supplierId] });

      expect(res.status).toBe(201);

      const codes = res.body.data.map((a: { supplier_code: string }) => a.supplier_code.trim());
      expect(codes).toContain(supplier1.uniqueCode);
      expect(codes).toContain(supplier2.uniqueCode);
    });

    it('should return 422 for only 1 supplier', async () => {
      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [supplier1.supplierId] });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 for empty supplier_ids array', async () => {
      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [] });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 when RFQ is PUBLISHED', async () => {
      const db = getTestDb();
      await db('rfqs').where('id', rfq.id).update({ status: 'PUBLISHED' });

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [supplier1.supplierId, supplier2.supplierId] });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RFQ_NOT_DRAFT');
    });

    it('should return 404 for non-existent supplier UUID', async () => {
      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          supplier_ids: [
            supplier1.supplierId,
            '00000000-0000-0000-0000-000000000099',
          ],
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SUPPLIER_NOT_FOUND');
    });

    it('should not allow duplicate assignment of same supplier', async () => {
      // First assignment
      await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [supplier1.supplierId, supplier2.supplierId] });

      // Second assignment with duplicate supplier1
      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [supplier1.supplierId, supplier3.supplierId] });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SUPPLIER_ALREADY_ASSIGNED');
    });

    it('should return 404 for other buyer RFQ', async () => {
      const buyer2 = await createTestUser({ email: 'buyer2@test.com', role: 'BUYER' });
      const buyer2Token = getAccessToken(buyer2.id, UserRole.BUYER);

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyer2Token}`)
        .send({ supplier_ids: [supplier1.supplierId, supplier2.supplierId] });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RFQ_NOT_FOUND');
    });

    it('should return 401 without auth token', async () => {
      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .send({ supplier_ids: [supplier1.supplierId, supplier2.supplierId] });

      expect(res.status).toBe(401);
    });

    it('should return 403 for SUPPLIER role', async () => {
      const supToken = getAccessToken(supplier1.userId, UserRole.SUPPLIER);

      const res = await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${supToken}`)
        .send({ supplier_ids: [supplier1.supplierId, supplier2.supplierId] });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should persist assignments in the database', async () => {
      await request
        .post(`/api/buyer/rfqs/${rfq.id}/suppliers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ supplier_ids: [supplier1.supplierId, supplier2.supplierId] });

      const db = getTestDb();
      const assignments = await db('rfq_suppliers').where('rfq_id', rfq.id);

      expect(assignments).toHaveLength(2);
      expect(assignments.every((a: { status: string }) => a.status === 'PENDING')).toBe(true);
    });
  });
});
