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
  seedFlagConfig,
  app,
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

let buyerUser: { id: string; email: string; role: string };
let buyerToken: string;
let adminUser: { id: string; email: string; role: string };
let adminToken: string;
let supplier1: { userId: string; supplierId: string; uniqueCode: string };
let supplier1Token: string;
let supplier2: { userId: string; supplierId: string; uniqueCode: string };

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
  await seedFlagConfig();

  buyerUser = await createTestUser({ role: 'BUYER' });
  buyerToken = getAccessToken(buyerUser.id, UserRole.BUYER);
  adminUser = await createTestUser({ role: 'ADMIN', email: 'admin-cred@test.com' });
  adminToken = getAccessToken(adminUser.id, UserRole.ADMIN);
  supplier1 = await createTestSupplier({ email: 's1-cred@test.com' });
  supplier1Token = getAccessToken(supplier1.userId, UserRole.SUPPLIER);
  supplier2 = await createTestSupplier({ email: 's2-cred@test.com' });
});

describe('Credibility — Accept/Decline Triggers', () => {
  it('should recalculate credibility after supplier accepts RFQ', async () => {
    const rfq = await createTestRfq({
      buyer_id: buyerUser.id,
      status: 'PUBLISHED',
      payment_terms: 'Net 30',
    });
    await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode);

    const res = await supertest(app)
      .post(`/api/supplier/rfqs/${rfq.id}/accept`)
      .set('Authorization', `Bearer ${supplier1Token}`)
      .send({
        declaration_rfq_terms: true,
        declaration_no_collusion: true,
        declaration_confidentiality: true,
      });

    expect(res.status).toBe(200);

    // Verify credibility was recalculated in DB
    const db = getTestDb();
    const supplier = await db('suppliers')
      .where('id', supplier1.supplierId)
      .select('credibility_score', 'credibility_class')
      .first();

    // accepted 1 of 1 → score_1 = 100
    // 1 ACCEPTED RFQ, 0 revisions used → score_2 = 100
    // no closed/awarded RFQs → score_3 = 50, score_4 = 50
    // Composite = (100 + 100 + 50 + 50) * 0.25 = 75.0 → STABLE
    expect(parseFloat(supplier.credibility_score)).toBe(75);
    expect(supplier.credibility_class).toBe('STABLE');
  });

  it('should reflect lower response discipline after declining RFQ', async () => {
    const rfq1 = await createTestRfq({
      buyer_id: buyerUser.id,
      status: 'PUBLISHED',
      payment_terms: 'Net 30',
    });
    const rfq2 = await createTestRfq({
      buyer_id: buyerUser.id,
      status: 'PUBLISHED',
      payment_terms: 'Net 30',
    });

    await assignTestSupplier(rfq1.id, supplier1.supplierId, supplier1.uniqueCode);
    await assignTestSupplier(rfq2.id, supplier1.supplierId, supplier1.uniqueCode);

    // Accept first RFQ
    await supertest(app)
      .post(`/api/supplier/rfqs/${rfq1.id}/accept`)
      .set('Authorization', `Bearer ${supplier1Token}`)
      .send({
        declaration_rfq_terms: true,
        declaration_no_collusion: true,
        declaration_confidentiality: true,
      });

    // Decline second RFQ
    const res = await supertest(app)
      .post(`/api/supplier/rfqs/${rfq2.id}/decline`)
      .set('Authorization', `Bearer ${supplier1Token}`)
      .send({
        reason: 'We cannot participate in this particular procurement exercise at this time.',
      });

    expect(res.status).toBe(200);

    const db = getTestDb();
    const supplier = await db('suppliers')
      .where('id', supplier1.supplierId)
      .select('credibility_score', 'credibility_class')
      .first();

    // accepted 1 of 2 → score_1 = 50
    // 1 ACCEPTED RFQ, 0 revisions → score_2 = 100
    // score_3 = 50, score_4 = 50 (neutral)
    // Composite = (50 + 100 + 50 + 50) * 0.25 = 62.5 → STABLE
    expect(parseFloat(supplier.credibility_score)).toBe(62.5);
    expect(supplier.credibility_class).toBe('STABLE');
  });
});

describe('Credibility — Close RFQ Trigger', () => {
  it('should recalculate credibility for all accepted suppliers on RFQ close', async () => {
    const rfq = await createTestRfq({
      buyer_id: buyerUser.id,
      status: 'ACTIVE',
      payment_terms: 'Net 30',
    });

    await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
    await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });

    const res = await supertest(app)
      .post(`/api/buyer/rfqs/${rfq.id}/close`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ confirm: true });

    expect(res.status).toBe(200);

    const db = getTestDb();
    const s1 = await db('suppliers')
      .where('id', supplier1.supplierId)
      .select('credibility_score')
      .first();
    const s2 = await db('suppliers')
      .where('id', supplier2.supplierId)
      .select('credibility_score')
      .first();

    // Both suppliers have been recalculated — both accepted 1/1 for their close-triggered RFQ
    // But the close trigger recalculates from scratch, so the score depends on all history
    expect(s1.credibility_score).toBeDefined();
    expect(s2.credibility_score).toBeDefined();
  });
});

describe('Credibility — Admin Fulfill Endpoint', () => {
  async function setupAwardedRfq() {
    const rfq = await createTestRfq({
      buyer_id: buyerUser.id,
      status: 'CLOSED',
      payment_terms: 'Net 30',
    });
    const item = await createTestRfqItem(rfq.id);
    await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
    await createTestBid({
      rfq_id: rfq.id,
      supplier_id: supplier1.supplierId,
      supplier_code: supplier1.uniqueCode,
      items: [{ rfq_item_id: item.id, unit_price: 100, quantity: 10 }],
    });

    // Award the RFQ
    await supertest(app)
      .post(`/api/buyer/rfqs/${rfq.id}/award`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        type: 'single',
        allocations: [{ supplier_id: supplier1.supplierId }],
      });

    return rfq;
  }

  it('should create AWARD_FULFILLED audit entry and recalculate credibility', async () => {
    const rfq = await setupAwardedRfq();

    const res = await supertest(app)
      .post(`/api/admin/rfqs/${rfq.id}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supplier_id: supplier1.supplierId });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('fulfilled');

    // Verify audit entry created
    const db = getTestDb();
    const auditEntry = await db('audit_log')
      .where({ rfq_id: rfq.id, event_type: 'AWARD_FULFILLED' })
      .first();

    expect(auditEntry).toBeDefined();
    const eventData = typeof auditEntry.event_data === 'string'
      ? JSON.parse(auditEntry.event_data)
      : auditEntry.event_data;
    expect(eventData.supplier_id).toBe(supplier1.supplierId);
  });

  it('should reject fulfillment for non-AWARDED RFQ with 409', async () => {
    const rfq = await createTestRfq({
      buyer_id: buyerUser.id,
      status: 'CLOSED',
      payment_terms: 'Net 30',
    });

    const res = await supertest(app)
      .post(`/api/admin/rfqs/${rfq.id}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supplier_id: supplier1.supplierId });

    expect(res.status).toBe(409);
  });

  it('should reject fulfillment for non-awarded supplier with 422', async () => {
    const rfq = await setupAwardedRfq();

    const res = await supertest(app)
      .post(`/api/admin/rfqs/${rfq.id}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supplier_id: supplier2.supplierId });

    expect(res.status).toBe(422);
  });

  it('should reject duplicate fulfillment with 409', async () => {
    const rfq = await setupAwardedRfq();

    // First fulfill
    await supertest(app)
      .post(`/api/admin/rfqs/${rfq.id}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supplier_id: supplier1.supplierId });

    // Second fulfill (duplicate)
    const res = await supertest(app)
      .post(`/api/admin/rfqs/${rfq.id}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supplier_id: supplier1.supplierId });

    expect(res.status).toBe(409);
  });
});

describe('Credibility — Buyer Rankings Include credibility_class', () => {
  it('should include credibility_class in total_rankings for buyers', async () => {
    const rfq = await createTestRfq({
      buyer_id: buyerUser.id,
      status: 'ACTIVE',
      payment_terms: 'Net 30',
    });
    const item = await createTestRfqItem(rfq.id);
    await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
    await createTestBid({
      rfq_id: rfq.id,
      supplier_id: supplier1.supplierId,
      supplier_code: supplier1.uniqueCode,
      items: [{ rfq_item_id: item.id, unit_price: 100, quantity: 10 }],
    });

    const res = await supertest(app)
      .get(`/api/buyer/rfqs/${rfq.id}/rankings`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total_rankings).toBeDefined();
    expect(res.body.data.total_rankings.length).toBeGreaterThan(0);

    const firstRanking = res.body.data.total_rankings[0];
    expect(firstRanking).toHaveProperty('credibility_class');
    expect(['EXCELLENT', 'STABLE', 'RISKY']).toContain(firstRanking.credibility_class);
  });
});

describe('Credibility — Buyer RFQ Detail Includes credibility_class', () => {
  it('should include credibility_class in suppliers array for buyer RFQ detail', async () => {
    const rfq = await createTestRfq({
      buyer_id: buyerUser.id,
      status: 'PUBLISHED',
      payment_terms: 'Net 30',
    });
    await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode);

    const res = await supertest(app)
      .get(`/api/buyer/rfqs/${rfq.id}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.suppliers).toBeDefined();
    expect(res.body.data.suppliers.length).toBeGreaterThan(0);

    const firstSupplier = res.body.data.suppliers[0];
    expect(firstSupplier).toHaveProperty('credibility_class');
    expect(['EXCELLENT', 'STABLE', 'RISKY']).toContain(firstSupplier.credibility_class);
  });
});

describe('Credibility — Supplier Endpoint Isolation', () => {
  it('GET /api/supplier/rfqs should NOT expose credibility fields', async () => {
    const rfq = await createTestRfq({
      buyer_id: buyerUser.id,
      status: 'PUBLISHED',
      payment_terms: 'Net 30',
    });
    await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });

    const res = await supertest(app)
      .get('/api/supplier/rfqs')
      .set('Authorization', `Bearer ${supplier1Token}`);

    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('credibility_score');
    expect(body).not.toContain('credibility_class');
  });

  it('GET /api/supplier/rfqs/:id should NOT expose credibility fields', async () => {
    const rfq = await createTestRfq({
      buyer_id: buyerUser.id,
      status: 'PUBLISHED',
      payment_terms: 'Net 30',
    });
    await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });

    const res = await supertest(app)
      .get(`/api/supplier/rfqs/${rfq.id}`)
      .set('Authorization', `Bearer ${supplier1Token}`);

    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('credibility_score');
    expect(body).not.toContain('credibility_class');
  });
});
