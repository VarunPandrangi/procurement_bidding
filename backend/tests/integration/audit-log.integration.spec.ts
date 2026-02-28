import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';
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
let adminUser: { id: string; email: string; role: string; password: string };
let adminToken: string;
let supplier: { userId: string; supplierId: string; email: string; uniqueCode: string; password: string };
let supplierToken: string;
let rfq: { id: string; rfq_number: string; buyer_id: string; status: string };

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

  adminUser = await createTestUser({ email: 'admin@test.com', role: 'ADMIN' });
  adminToken = getAccessToken(adminUser.id, UserRole.ADMIN);

  supplier = await createTestSupplier({ email: 'supplier@test.com', company_name: 'Supplier Co' });
  supplierToken = getAccessToken(supplier.userId, UserRole.SUPPLIER);

  rfq = await createTestRfq({
    buyer_id: buyerUser.id,
    title: 'Audit Test RFQ',
    status: 'ACTIVE',
  });
});

/**
 * Inserts audit_log rows directly into the database for test seeding.
 */
async function seedAuditEntries(
  entries: Array<{
    rfq_id?: string | null;
    event_type: string;
    actor_type: string;
    actor_id?: string | null;
    event_data?: Record<string, unknown>;
    created_at?: Date;
  }>,
): Promise<string[]> {
  const db = getTestDb();
  const ids: string[] = [];

  for (const entry of entries) {
    const id = uuidv4();
    ids.push(id);
    await db('audit_log').insert({
      id,
      rfq_id: entry.rfq_id || null,
      event_type: entry.event_type,
      actor_type: entry.actor_type,
      actor_id: entry.actor_id || null,
      event_data: JSON.stringify(entry.event_data || {}),
      event_hash: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''), // 64-char placeholder hash
      created_at: entry.created_at || new Date(),
    });
  }

  return ids;
}

describe('Audit Log Integration Tests', () => {
  describe('GET /api/buyer/rfqs/:id/audit-log', () => {
    it('should return audit entries scoped to the requested RFQ', async () => {
      // Create a second RFQ to confirm scoping
      const otherRfq = await createTestRfq({
        buyer_id: buyerUser.id,
        title: 'Other RFQ',
        status: 'DRAFT',
      });

      // Seed entries for both RFQs
      await seedAuditEntries([
        { rfq_id: rfq.id, event_type: 'BID_SUBMITTED', actor_type: 'SUPPLIER', actor_id: supplier.supplierId },
        { rfq_id: rfq.id, event_type: 'BID_REVISED', actor_type: 'SUPPLIER', actor_id: supplier.supplierId },
        { rfq_id: otherRfq.id, event_type: 'RFQ_CREATED', actor_type: 'BUYER', actor_id: buyerUser.id },
      ]);

      const res = await request
        .get(`/api/buyer/rfqs/${rfq.id}/audit-log`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);

      // All returned entries should belong to the requested RFQ
      for (const entry of res.body.data) {
        expect(entry.rfq_id).toBe(rfq.id);
      }
    });

    it('should support pagination with page and limit query params', async () => {
      // Seed 5 entries for the RFQ with staggered timestamps for deterministic ordering
      const baseTime = new Date('2026-01-01T00:00:00Z');
      await seedAuditEntries(
        Array.from({ length: 5 }, (_, i) => ({
          rfq_id: rfq.id,
          event_type: 'BID_SUBMITTED',
          actor_type: 'SUPPLIER',
          actor_id: supplier.supplierId,
          event_data: { index: i },
          created_at: new Date(baseTime.getTime() + i * 1000),
        })),
      );

      const res = await request
        .get(`/api/buyer/rfqs/${rfq.id}/audit-log?page=1&limit=2`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.pagination).toBeDefined();
      expect(res.body.meta.pagination.page).toBe(1);
      expect(res.body.meta.pagination.limit).toBe(2);
      expect(res.body.meta.pagination.total).toBe(5);
      expect(res.body.meta.pagination.totalPages).toBe(3);

      // Fetch page 3 — should have 1 entry
      const resPage3 = await request
        .get(`/api/buyer/rfqs/${rfq.id}/audit-log?page=3&limit=2`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(resPage3.status).toBe(200);
      expect(resPage3.body.data).toHaveLength(1);
      expect(resPage3.body.meta.pagination.page).toBe(3);
    });

    it('should return 404 for an RFQ not owned by the buyer', async () => {
      const otherBuyer = await createTestUser({ email: 'other-buyer@test.com', role: 'BUYER' });
      const otherRfq = await createTestRfq({
        buyer_id: otherBuyer.id,
        title: 'Not My RFQ',
        status: 'ACTIVE',
      });

      await seedAuditEntries([
        { rfq_id: otherRfq.id, event_type: 'RFQ_CREATED', actor_type: 'BUYER', actor_id: otherBuyer.id },
      ]);

      const res = await request
        .get(`/api/buyer/rfqs/${otherRfq.id}/audit-log`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RFQ_NOT_FOUND');
    });

    it('should return 403 for SUPPLIER role', async () => {
      await seedAuditEntries([
        { rfq_id: rfq.id, event_type: 'BID_SUBMITTED', actor_type: 'SUPPLIER', actor_id: supplier.supplierId },
      ]);

      const res = await request
        .get(`/api/buyer/rfqs/${rfq.id}/audit-log`)
        .set('Authorization', `Bearer ${supplierToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/audit-log', () => {
    it('should return all audit entries for admin', async () => {
      // Seed entries across multiple RFQs
      const otherRfq = await createTestRfq({
        buyer_id: buyerUser.id,
        title: 'Another RFQ',
        status: 'DRAFT',
      });

      await seedAuditEntries([
        { rfq_id: rfq.id, event_type: 'BID_SUBMITTED', actor_type: 'SUPPLIER', actor_id: supplier.supplierId },
        { rfq_id: rfq.id, event_type: 'RFQ_CLOSED', actor_type: 'BUYER', actor_id: buyerUser.id },
        { rfq_id: otherRfq.id, event_type: 'RFQ_CREATED', actor_type: 'BUYER', actor_id: buyerUser.id },
        { rfq_id: null, event_type: 'USER_CREATED', actor_type: 'ADMIN', actor_id: adminUser.id },
      ]);

      const res = await request
        .get('/api/admin/audit-log')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(4);
      expect(res.body.meta.pagination.total).toBe(4);
    });

    it('should filter by event_type query param', async () => {
      await seedAuditEntries([
        { rfq_id: rfq.id, event_type: 'BID_SUBMITTED', actor_type: 'SUPPLIER', actor_id: supplier.supplierId },
        { rfq_id: rfq.id, event_type: 'BID_REVISED', actor_type: 'SUPPLIER', actor_id: supplier.supplierId },
        { rfq_id: rfq.id, event_type: 'BID_SUBMITTED', actor_type: 'SUPPLIER', actor_id: supplier.supplierId },
        { rfq_id: rfq.id, event_type: 'RFQ_CLOSED', actor_type: 'BUYER', actor_id: buyerUser.id },
      ]);

      const res = await request
        .get('/api/admin/audit-log?event_type=BID_SUBMITTED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);

      for (const entry of res.body.data) {
        expect(entry.event_type).toBe('BID_SUBMITTED');
      }
    });

    it('should filter by rfq_id query param', async () => {
      const otherRfq = await createTestRfq({
        buyer_id: buyerUser.id,
        title: 'Other RFQ',
        status: 'DRAFT',
      });

      await seedAuditEntries([
        { rfq_id: rfq.id, event_type: 'BID_SUBMITTED', actor_type: 'SUPPLIER', actor_id: supplier.supplierId },
        { rfq_id: rfq.id, event_type: 'RFQ_CLOSED', actor_type: 'BUYER', actor_id: buyerUser.id },
        { rfq_id: otherRfq.id, event_type: 'RFQ_CREATED', actor_type: 'BUYER', actor_id: buyerUser.id },
      ]);

      const res = await request
        .get(`/api/admin/audit-log?rfq_id=${rfq.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);

      for (const entry of res.body.data) {
        expect(entry.rfq_id).toBe(rfq.id);
      }
    });

    it('should return 403 for BUYER role', async () => {
      const res = await request
        .get('/api/admin/audit-log')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 403 for SUPPLIER role', async () => {
      const res = await request
        .get('/api/admin/audit-log')
        .set('Authorization', `Bearer ${supplierToken}`);

      expect(res.status).toBe(403);
    });
  });
});
