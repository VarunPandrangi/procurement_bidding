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

beforeAll(async () => {
  await setupTestDatabase();
  await connectTestRedis();
});

afterAll(async () => {
  await teardownTestDatabase();
  await closeTestRedis();
});

// Create common test data in beforeEach
let buyerUser: any;
let buyerToken: string;
let supplier1: any;
let supplier1Token: string;
let supplier2: any;
let supplier2Token: string;
let rfq: any;

beforeEach(async () => {
  await cleanDatabase();
  await cleanRedis();

  buyerUser = await createTestUser({ email: 'buyer@test.com', role: 'BUYER' });
  buyerToken = getAccessToken(buyerUser.id, UserRole.BUYER);

  supplier1 = await createTestSupplier({ email: 'supplier1@test.com', company_name: 'Alpha Co' });
  supplier1Token = getAccessToken(supplier1.userId, UserRole.SUPPLIER);

  supplier2 = await createTestSupplier({ email: 'supplier2@test.com', company_name: 'Beta Co' });
  supplier2Token = getAccessToken(supplier2.userId, UserRole.SUPPLIER);

  // Create a PUBLISHED RFQ with items and both suppliers assigned
  rfq = await createTestRfq({
    buyer_id: buyerUser.id,
    title: 'Test Published RFQ',
    status: 'PUBLISHED',
    payment_terms: 'Net 30',
    freight_terms: 'FOB',
    delivery_lead_time_days: 14,
  });

  await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Widget A', uom: 'PCS', quantity: 100 });
  await createTestRfqItem(rfq.id, { sl_no: 2, description: 'Widget B', uom: 'KG', quantity: 50 });

  await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode);
  await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode);
});

describe('Supplier RFQ Integration Tests', () => {
  // ---------------------------------------------------------------------------
  // GET /api/supplier/rfqs — List assigned RFQs
  // ---------------------------------------------------------------------------
  describe('GET /api/supplier/rfqs', () => {
    it('should return 200 with RFQs assigned to this supplier', async () => {
      const res = await request
        .get('/api/supplier/rfqs')
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(rfq.id);
      expect(res.body.data[0].title).toBe('Test Published RFQ');
      expect(res.body.data[0].assignment_status).toBe('PENDING');
      expect(res.body.meta.pagination).toBeDefined();
      expect(res.body.meta.pagination.total).toBe(1);
    });

    it('should NOT include RFQs where this supplier is not assigned', async () => {
      // Arrange: create a second RFQ assigned only to supplier2
      const rfq2 = await createTestRfq({
        buyer_id: buyerUser.id,
        title: 'Supplier2 Only RFQ',
        status: 'PUBLISHED',
        payment_terms: 'Net 45',
      });
      await createTestRfqItem(rfq2.id, { sl_no: 1, description: 'Gadget C', uom: 'PCS', quantity: 200 });

      // Create a third supplier to satisfy >= 2 supplier assignments for rfq2
      const supplier3 = await createTestSupplier({ email: 'supplier3@test.com', company_name: 'Gamma Co' });
      await assignTestSupplier(rfq2.id, supplier2.supplierId, supplier2.uniqueCode);
      await assignTestSupplier(rfq2.id, supplier3.supplierId, supplier3.uniqueCode);

      // Act: supplier1 lists their RFQs
      const res = await request
        .get('/api/supplier/rfqs')
        .set('Authorization', `Bearer ${supplier1Token}`);

      // Assert: supplier1 should only see the first RFQ, not rfq2
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(rfq.id);

      const rfqIds = res.body.data.map((r: any) => r.id);
      expect(rfqIds).not.toContain(rfq2.id);
    });

    it('should return 401 when no auth token is provided', async () => {
      const res = await request.get('/api/supplier/rfqs');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should return 403 when a BUYER role tries to access', async () => {
      const res = await request
        .get('/api/supplier/rfqs')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/supplier/rfqs/:id — View RFQ detail
  // ---------------------------------------------------------------------------
  describe('GET /api/supplier/rfqs/:id', () => {
    it('should return 200 with RFQ details including items and own assignment', async () => {
      const res = await request
        .get(`/api/supplier/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(rfq.id);
      expect(res.body.data.title).toBe('Test Published RFQ');
      expect(res.body.data.payment_terms).toBe('Net 30');
      expect(res.body.data.freight_terms).toBe('FOB');
      expect(res.body.data.delivery_lead_time_days).toBe(14);

      // Items should be present
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.items[0].description).toBe('Widget A');
      expect(res.body.data.items[1].description).toBe('Widget B');
    });

    it('should include assignment field with own status and declarations', async () => {
      const res = await request
        .get(`/api/supplier/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Assignment field should exist with own data
      expect(res.body.data.assignment).toBeDefined();
      expect(res.body.data.assignment.status).toBe('PENDING');
      expect(res.body.data.assignment.declaration_rfq_terms).toBeDefined();
      expect(res.body.data.assignment.declaration_no_collusion).toBeDefined();
      expect(res.body.data.assignment.declaration_confidentiality).toBeDefined();
    });

    it('should NOT include suppliers array (no competitor data)', async () => {
      const res = await request
        .get(`/api/supplier/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${supplier1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Must NOT expose other suppliers
      expect(res.body.data.suppliers).toBeUndefined();
    });

    it('should return 403 for a supplier not assigned to the RFQ', async () => {
      // Arrange: create supplier3 who is NOT assigned to the RFQ
      const supplier3 = await createTestSupplier({ email: 'supplier3@test.com', company_name: 'Gamma Co' });
      const supplier3Token = getAccessToken(supplier3.userId, UserRole.SUPPLIER);

      const res = await request
        .get(`/api/supplier/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${supplier3Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 401 when no auth token is provided', async () => {
      const res = await request.get(`/api/supplier/rfqs/${rfq.id}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/supplier/rfqs/:id/accept — Accept RFQ
  // ---------------------------------------------------------------------------
  describe('POST /api/supplier/rfqs/:id/accept', () => {
    const validDeclarations = {
      declaration_rfq_terms: true,
      declaration_no_collusion: true,
      declaration_confidentiality: true,
    };

    it('should return 200 and set assignment status to ACCEPTED with all 3 declarations true', async () => {
      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send(validDeclarations);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACCEPTED');
      expect(res.body.data.supplier_id).toBe(supplier1.supplierId);
      expect(res.body.data.declaration_rfq_terms).toBe(true);
      expect(res.body.data.declaration_no_collusion).toBe(true);
      expect(res.body.data.declaration_confidentiality).toBe(true);
      expect(res.body.data.accepted_at).toBeDefined();
    });

    it('should trigger commercial lock on first acceptance (commercial_locked_at set)', async () => {
      // Arrange: verify no lock initially
      const db = getTestDb();
      const beforeRfq = await db('rfqs').where('id', rfq.id).first();
      expect(beforeRfq.commercial_locked_at).toBeNull();

      // Act
      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send(validDeclarations);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Assert: commercial lock is now set
      const afterRfq = await db('rfqs').where('id', rfq.id).first();
      expect(afterRfq.commercial_locked_at).not.toBeNull();
      expect(afterRfq.commercial_locked_by_supplier_code).toBe(supplier1.uniqueCode);
    });

    it('should allow second supplier acceptance but NOT change lock timestamp', async () => {
      // Arrange: supplier1 accepts first
      await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send(validDeclarations);

      const db = getTestDb();
      const afterFirstAccept = await db('rfqs').where('id', rfq.id).first();
      const firstLockTimestamp = afterFirstAccept.commercial_locked_at;
      const firstLockedBy = afterFirstAccept.commercial_locked_by_supplier_code;

      expect(firstLockTimestamp).not.toBeNull();

      // Act: supplier2 accepts second
      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier2Token}`)
        .send(validDeclarations);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACCEPTED');

      // Assert: lock timestamp and locked_by remain unchanged
      const afterSecondAccept = await db('rfqs').where('id', rfq.id).first();
      expect(new Date(afterSecondAccept.commercial_locked_at).getTime())
        .toBe(new Date(firstLockTimestamp).getTime());
      expect(afterSecondAccept.commercial_locked_by_supplier_code).toBe(firstLockedBy);
    });

    it('should return 422 VALIDATION_ERROR when a declaration is false', async () => {
      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          declaration_rfq_terms: true,
          declaration_no_collusion: false,
          declaration_confidentiality: true,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 VALIDATION_ERROR when a declaration is missing', async () => {
      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          declaration_rfq_terms: true,
          declaration_no_collusion: true,
          // declaration_confidentiality is missing
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 ALREADY_RESPONDED when supplier has already accepted', async () => {
      // Arrange: accept first
      await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send(validDeclarations);

      // Act: try to accept again
      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send(validDeclarations);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ALREADY_RESPONDED');
    });

    it('should return 409 ALREADY_RESPONDED when supplier has already declined', async () => {
      // Arrange: decline first
      await request
        .post(`/api/supplier/rfqs/${rfq.id}/decline`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ reason: 'We cannot fulfill this order at this time due to capacity constraints' });

      // Act: try to accept after declining
      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send(validDeclarations);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ALREADY_RESPONDED');
    });

    it('should return 403 for a supplier not assigned to the RFQ', async () => {
      // Arrange: create unassigned supplier
      const supplier3 = await createTestSupplier({ email: 'supplier3@test.com', company_name: 'Gamma Co' });
      const supplier3Token = getAccessToken(supplier3.userId, UserRole.SUPPLIER);

      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier3Token}`)
        .send(validDeclarations);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/supplier/rfqs/:id/decline — Decline RFQ
  // ---------------------------------------------------------------------------
  describe('POST /api/supplier/rfqs/:id/decline', () => {
    const validDeclineReason = 'We are unable to participate in this RFQ due to existing commitments and resource limitations';

    it('should return 200 and set assignment status to DECLINED with valid reason', async () => {
      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/decline`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ reason: validDeclineReason });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DECLINED');
      expect(res.body.data.decline_reason).toBe(validDeclineReason);
      expect(res.body.data.supplier_id).toBe(supplier1.supplierId);
    });

    it('should return 422 VALIDATION_ERROR when reason is less than 20 characters', async () => {
      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/decline`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ reason: 'Too short' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 VALIDATION_ERROR when reason is missing', async () => {
      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/decline`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 ALREADY_RESPONDED when supplier has already accepted', async () => {
      // Arrange: accept first
      await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          declaration_rfq_terms: true,
          declaration_no_collusion: true,
          declaration_confidentiality: true,
        });

      // Act: try to decline after accepting
      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/decline`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ reason: validDeclineReason });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ALREADY_RESPONDED');
    });

    it('should return 409 ALREADY_RESPONDED when supplier has already declined', async () => {
      // Arrange: decline first
      await request
        .post(`/api/supplier/rfqs/${rfq.id}/decline`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ reason: validDeclineReason });

      // Act: try to decline again
      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/decline`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ reason: 'Another long reason that exceeds twenty characters for sure' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ALREADY_RESPONDED');
    });

    it('should return 403 for a supplier not assigned to the RFQ', async () => {
      // Arrange: create unassigned supplier
      const supplier3 = await createTestSupplier({ email: 'supplier3@test.com', company_name: 'Gamma Co' });
      const supplier3Token = getAccessToken(supplier3.userId, UserRole.SUPPLIER);

      const res = await request
        .post(`/api/supplier/rfqs/${rfq.id}/decline`)
        .set('Authorization', `Bearer ${supplier3Token}`)
        .send({ reason: validDeclineReason });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should create a SUPPLIER_DECLINED audit log entry', async () => {
      // Act
      await request
        .post(`/api/supplier/rfqs/${rfq.id}/decline`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ reason: validDeclineReason });

      // Assert: check audit_log table
      const db = getTestDb();
      const auditEntries = await db('audit_log')
        .where({ rfq_id: rfq.id, event_type: 'SUPPLIER_DECLINED' })
        .select('*');

      expect(auditEntries.length).toBe(1);
      expect(auditEntries[0].actor_id).toBe(supplier1.supplierId);
      expect(auditEntries[0].actor_code).toBe(supplier1.uniqueCode);

      const eventData = typeof auditEntries[0].event_data === 'string'
        ? JSON.parse(auditEntries[0].event_data)
        : auditEntries[0].event_data;
      expect(eventData.reason).toBe(validDeclineReason);
      expect(eventData.supplierCode).toBe(supplier1.uniqueCode);
    });
  });

  // ---------------------------------------------------------------------------
  // Commercial Lock cross-endpoint interaction
  // ---------------------------------------------------------------------------
  describe('Commercial Lock cross-endpoint interaction', () => {
    it('should block buyer from changing commercial fields after supplier acceptance', async () => {
      // Arrange: supplier1 accepts, triggering commercial lock
      const acceptRes = await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          declaration_rfq_terms: true,
          declaration_no_collusion: true,
          declaration_confidentiality: true,
        });

      expect(acceptRes.status).toBe(200);

      // Verify the commercial lock was set
      const db = getTestDb();
      const lockedRfq = await db('rfqs').where('id', rfq.id).first();
      expect(lockedRfq.commercial_locked_at).not.toBeNull();

      // Set the RFQ back to DRAFT status to allow PUT updates
      // (PUT only works in DRAFT), while keeping commercial_locked_at set
      await db('rfqs').where('id', rfq.id).update({ status: 'DRAFT' });

      // Act & Assert: buyer tries to change payment_terms (commercial field) -> 409
      const paymentRes = await request
        .put(`/api/buyer/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ payment_terms: 'Net 60' });

      expect(paymentRes.status).toBe(409);
      expect(paymentRes.body.success).toBe(false);
      expect(paymentRes.body.error.code).toBe('COMMERCIAL_LOCKED');
    });

    it('should block buyer from changing items after supplier acceptance', async () => {
      // Arrange: supplier1 accepts, triggering commercial lock
      await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          declaration_rfq_terms: true,
          declaration_no_collusion: true,
          declaration_confidentiality: true,
        });

      // Set the RFQ back to DRAFT for update testing
      const db = getTestDb();
      await db('rfqs').where('id', rfq.id).update({ status: 'DRAFT' });

      // Act & Assert: buyer tries to change items (commercial field) -> 409
      const itemsRes = await request
        .put(`/api/buyer/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [
            { sl_no: 1, description: 'New Widget', uom: 'PCS', quantity: 999 },
          ],
        });

      expect(itemsRes.status).toBe(409);
      expect(itemsRes.body.success).toBe(false);
      expect(itemsRes.body.error.code).toBe('COMMERCIAL_LOCKED');
    });

    it('should still allow buyer to change non-commercial fields (title) after commercial lock', async () => {
      // Arrange: supplier1 accepts, triggering commercial lock
      await request
        .post(`/api/supplier/rfqs/${rfq.id}/accept`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({
          declaration_rfq_terms: true,
          declaration_no_collusion: true,
          declaration_confidentiality: true,
        });

      // Set the RFQ back to DRAFT for update testing
      const db = getTestDb();
      await db('rfqs').where('id', rfq.id).update({ status: 'DRAFT' });

      // Act: buyer changes only the title (not a commercial field) -> should succeed
      const titleRes = await request
        .put(`/api/buyer/rfqs/${rfq.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ title: 'Updated Non-Commercial Title' });

      expect(titleRes.status).toBe(200);
      expect(titleRes.body.success).toBe(true);
      expect(titleRes.body.data.title).toBe('Updated Non-Commercial Title');

      // Verify commercial lock is still intact
      const afterUpdate = await db('rfqs').where('id', rfq.id).first();
      expect(afterUpdate.commercial_locked_at).not.toBeNull();
    });
  });
});
