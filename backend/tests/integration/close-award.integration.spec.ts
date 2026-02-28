import supertest from 'supertest';
import {
  getTestDb,
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  connectTestRedis,
  cleanRedis,
  closeTestRedis,
  createTestUser,
  createTestSupplier,
  getAccessToken,
  createTestRfq,
  createTestRfqItem,
  assignTestSupplier,
  createTestBid,
  app,
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

let buyerUser: { id: string; email: string; role: string };
let buyerToken: string;
let supplierToken: string;
let supplier: { userId: string; supplierId: string; uniqueCode: string };

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

  buyerUser = await createTestUser({ role: 'BUYER' });
  buyerToken = getAccessToken(buyerUser.id, UserRole.BUYER);
  supplier = await createTestSupplier();
  supplierToken = getAccessToken(supplier.userId, UserRole.SUPPLIER);
});

describe('POST /api/buyer/rfqs/:id/close', () => {
  it('should close an ACTIVE RFQ', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'ACTIVE' });

    const res = await supertest(app)
      .post(`/api/buyer/rfqs/${rfq.id}/close`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ confirm: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('CLOSED');
  });

  it('should reject closing a DRAFT RFQ with 409', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'DRAFT' });

    const res = await supertest(app)
      .post(`/api/buyer/rfqs/${rfq.id}/close`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ confirm: true });

    expect(res.status).toBe(409);
  });

  it('should reject closing an already CLOSED RFQ with 409', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'CLOSED' });

    const res = await supertest(app)
      .post(`/api/buyer/rfqs/${rfq.id}/close`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ confirm: true });

    expect(res.status).toBe(409);
  });

  it('should require confirm: true in body (Zod validation)', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'ACTIVE' });

    const res = await supertest(app)
      .post(`/api/buyer/rfqs/${rfq.id}/close`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({});

    expect(res.status).toBe(422);
  });

  it('should create RFQ_CLOSED audit entry with close_method=manual', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'ACTIVE' });

    await supertest(app)
      .post(`/api/buyer/rfqs/${rfq.id}/close`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ confirm: true });

    const db = getTestDb();
    const auditEntry = await db('audit_log')
      .where({ rfq_id: rfq.id, event_type: 'RFQ_CLOSED' })
      .first();

    expect(auditEntry).toBeDefined();
    const eventData = typeof auditEntry.event_data === 'string'
      ? JSON.parse(auditEntry.event_data)
      : auditEntry.event_data;
    expect(eventData.close_method).toBe('manual');
    expect(eventData.closed_by).toBe(buyerUser.id);
  });

  it('should return 404 for non-owned RFQ', async () => {
    const otherBuyer = await createTestUser({ role: 'BUYER' });
    const rfq = await createTestRfq({ buyer_id: otherBuyer.id, status: 'ACTIVE' });

    const res = await supertest(app)
      .post(`/api/buyer/rfqs/${rfq.id}/close`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ confirm: true });

    expect(res.status).toBe(404);
  });

  it('should reject with 403 for SUPPLIER role', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'ACTIVE' });

    const res = await supertest(app)
      .post(`/api/buyer/rfqs/${rfq.id}/close`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({ confirm: true });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/buyer/rfqs/:id/award', () => {
  it('should award a CLOSED RFQ', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'CLOSED' });
    const item = await createTestRfqItem(rfq.id);
    await assignTestSupplier(rfq.id, supplier.supplierId, supplier.uniqueCode, { status: 'ACCEPTED' });
    await createTestBid({
      rfq_id: rfq.id,
      supplier_id: supplier.supplierId,
      supplier_code: supplier.uniqueCode,
      items: [{ rfq_item_id: item.id, unit_price: 100, quantity: 10 }],
    });

    const res = await supertest(app)
      .post(`/api/buyer/rfqs/${rfq.id}/award`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        type: 'single',
        allocations: [{ supplier_id: supplier.supplierId }],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('AWARDED');
  });

  it('should reject awarding an ACTIVE RFQ with 409', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'ACTIVE' });

    const res = await supertest(app)
      .post(`/api/buyer/rfqs/${rfq.id}/award`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        type: 'single',
        allocations: [{ supplier_id: supplier.supplierId }],
      });

    expect(res.status).toBe(409);
  });

  it('should create AWARD_FINALIZED audit entry', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'CLOSED' });
    const item = await createTestRfqItem(rfq.id);
    await assignTestSupplier(rfq.id, supplier.supplierId, supplier.uniqueCode, { status: 'ACCEPTED' });
    await createTestBid({
      rfq_id: rfq.id,
      supplier_id: supplier.supplierId,
      supplier_code: supplier.uniqueCode,
      items: [{ rfq_item_id: item.id, unit_price: 100, quantity: 10 }],
    });

    await supertest(app)
      .post(`/api/buyer/rfqs/${rfq.id}/award`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        type: 'single',
        allocations: [{ supplier_id: supplier.supplierId }],
      });

    const db = getTestDb();
    const auditEntry = await db('audit_log')
      .where({ rfq_id: rfq.id, event_type: 'AWARD_FINALIZED' })
      .first();

    expect(auditEntry).toBeDefined();
    const eventData = typeof auditEntry.event_data === 'string'
      ? JSON.parse(auditEntry.event_data)
      : auditEntry.event_data;
    expect(eventData.award_type).toBe('single');
    expect(eventData.awarded_by).toBe(buyerUser.id);
  });

  it('should require allocations in body', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'CLOSED' });

    const res = await supertest(app)
      .post(`/api/buyer/rfqs/${rfq.id}/award`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ type: 'single' });

    expect(res.status).toBe(422);
  });
});
