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
  getAccessToken,
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

const request = supertest(app);

let adminUser: { id: string; email: string; role: string; password: string };
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

  // Create admin user for each test
  adminUser = await createTestUser({
    email: 'admin@test.com',
    password: 'AdminPass123',
    role: 'ADMIN',
    full_name: 'Test Admin',
  });
  adminToken = getAccessToken(adminUser.id, UserRole.ADMIN);
});

describe('Admin Users Integration Tests', () => {
  describe('GET /api/admin/users', () => {
    it('should return list of users for admin (200)', async () => {
      const res = await request
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.pagination).toBeDefined();
    });

    it('should return 403 for buyer', async () => {
      const buyer = await createTestUser({ role: 'BUYER' });
      const buyerToken = getAccessToken(buyer.id, UserRole.BUYER);

      const res = await request
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 403 for supplier', async () => {
      const supplier = await createTestSupplier();
      const supplierToken = getAccessToken(supplier.userId, UserRole.SUPPLIER);

      const res = await request
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${supplierToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request.get('/api/admin/users');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/admin/users', () => {
    it('should create a buyer successfully (201)', async () => {
      const res = await request
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newbuyer@test.com',
          password: 'BuyerPass123',
          full_name: 'New Buyer',
          role: 'BUYER',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('newbuyer@test.com');
      expect(res.body.data.role).toBe('BUYER');
      expect(res.body.data.password_hash).toBeUndefined();
    });

    it('should create a supplier and auto-generate code (201)', async () => {
      const res = await request
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newsupplier@test.com',
          password: 'SupplierPass123',
          full_name: 'New Supplier',
          role: 'SUPPLIER',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('SUPPLIER');
      expect(res.body.data.supplier).toBeDefined();
      expect(res.body.data.supplier.unique_code).toBeDefined();
      expect(res.body.data.supplier.unique_code).toMatch(/^[A-Z0-9]{5}$/);
    });

    it('should return 409 for duplicate email', async () => {
      await createTestUser({ email: 'existing@test.com' });

      const res = await request
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'existing@test.com',
          password: 'SomePass123',
          full_name: 'Duplicate',
          role: 'BUYER',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
    });

    it('should return 422 for invalid data', async () => {
      const res = await request
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'not-valid',
          password: 'short',
          role: 'INVALID_ROLE',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 for non-admin', async () => {
      const buyer = await createTestUser({ role: 'BUYER' });
      const buyerToken = getAccessToken(buyer.id, UserRole.BUYER);

      const res = await request
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          email: 'test@test.com',
          password: 'Password123',
          full_name: 'Test',
          role: 'BUYER',
        });

      expect(res.status).toBe(403);
    });

    it('should create audit log entry for user creation', async () => {
      const res = await request
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'audited@test.com',
          password: 'AuditPass123',
          full_name: 'Audited User',
          role: 'BUYER',
        });

      expect(res.status).toBe(201);

      // Verify audit log entry exists
      const db = (await import('../helpers/setup')).getTestDb();
      const auditEntries = await db('audit_log')
        .where({ event_type: 'USER_CREATED' })
        .orderBy('created_at', 'desc');

      expect(auditEntries.length).toBeGreaterThan(0);
      const entry = auditEntries[0];
      expect(entry.event_type).toBe('USER_CREATED');
      expect(entry.actor_type).toBe('ADMIN');
    });
  });

  describe('PATCH /api/admin/users/:id', () => {
    it('should deactivate a user (200)', async () => {
      const targetUser = await createTestUser({
        email: 'deactivate@test.com',
        role: 'BUYER',
      });

      const res = await request
        .patch(`/api/admin/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(false);
    });

    it('should change user role (200)', async () => {
      const targetUser = await createTestUser({
        email: 'rolechange@test.com',
        role: 'BUYER',
      });

      const res = await request
        .patch(`/api/admin/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'ADMIN' });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('ADMIN');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request
        .patch('/api/admin/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false });

      expect(res.status).toBe(404);
    });

    it('should return 403 for non-admin', async () => {
      const buyer = await createTestUser({ role: 'BUYER' });
      const buyerToken = getAccessToken(buyer.id, UserRole.BUYER);

      const res = await request
        .patch(`/api/admin/users/${buyer.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ is_active: false });

      expect(res.status).toBe(403);
    });

    it('should return 422 for empty update', async () => {
      const targetUser = await createTestUser({ email: 'empty@test.com' });

      const res = await request
        .patch(`/api/admin/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/admin/suppliers', () => {
    it('should onboard a supplier successfully (201)', async () => {
      const res = await request
        .post('/api/admin/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          company_name: 'Test Supplier Co',
          contact_name: 'John Doe',
          contact_email: 'john@supplier.com',
          email: 'supplier@test.com',
          password: 'SupplierPass123',
          full_name: 'Supplier User',
          category_tags: ['Electronics', 'Hardware'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.supplier).toBeDefined();
      expect(res.body.data.supplier.unique_code).toMatch(/^[A-Z0-9]{5}$/);
      expect(res.body.data.supplier.company_name).toBe('Test Supplier Co');
    });

    it('should return 403 for non-admin', async () => {
      const buyer = await createTestUser({ role: 'BUYER' });
      const buyerToken = getAccessToken(buyer.id, UserRole.BUYER);

      const res = await request
        .post('/api/admin/suppliers')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          company_name: 'Test Co',
          email: 'supplier@test.com',
          password: 'Pass12345',
          full_name: 'Test',
        });

      expect(res.status).toBe(403);
    });

    it('should return 409 for duplicate email', async () => {
      await createTestUser({ email: 'existing@test.com' });

      const res = await request
        .post('/api/admin/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          company_name: 'Test Co',
          email: 'existing@test.com',
          password: 'Pass12345',
          full_name: 'Test Supplier',
        });

      expect(res.status).toBe(409);
    });

    it('should return 422 for invalid data', async () => {
      const res = await request
        .post('/api/admin/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'invalid',
        });

      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/admin/suppliers', () => {
    it('should list suppliers for admin (200)', async () => {
      await createTestSupplier({ email: 'list-sup1@test.com' });
      await createTestSupplier({ email: 'list-sup2@test.com' });

      const res = await request
        .get('/api/admin/suppliers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 403 for non-admin', async () => {
      const supplier = await createTestSupplier();
      const supplierToken = getAccessToken(supplier.userId, UserRole.SUPPLIER);

      const res = await request
        .get('/api/admin/suppliers')
        .set('Authorization', `Bearer ${supplierToken}`);

      expect(res.status).toBe(403);
    });
  });
});
