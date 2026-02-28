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
  createTestSupplier,
  getAccessToken,
  app,
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

const request = supertest(app);

describe('PATCH /api/buyer/rfqs/:id/weights', () => {
  let buyer: { id: string; email: string; role: string; password: string };
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
    buyer = await createTestUser({ role: 'BUYER' });
    buyerToken = getAccessToken(buyer.id, UserRole.BUYER);
  });

  it('should update weights on DRAFT RFQ with valid sum=100', async () => {
    const rfq = await createTestRfq({ buyer_id: buyer.id, status: 'DRAFT' });

    const res = await request
      .patch(`/api/buyer/rfqs/${rfq.id}/weights`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ weight_price: 40, weight_delivery: 40, weight_payment: 20 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(parseFloat(res.body.data.weight_price)).toBe(40);
    expect(parseFloat(res.body.data.weight_delivery)).toBe(40);
    expect(parseFloat(res.body.data.weight_payment)).toBe(20);
  });

  it('should reject weights that do not sum to 100 with 422', async () => {
    const rfq = await createTestRfq({ buyer_id: buyer.id, status: 'DRAFT' });

    const res = await request
      .patch(`/api/buyer/rfqs/${rfq.id}/weights`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ weight_price: 40, weight_delivery: 40, weight_payment: 21 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should allow weight update on PUBLISHED RFQ', async () => {
    const rfq = await createTestRfq({ buyer_id: buyer.id, status: 'PUBLISHED' });

    const res = await request
      .patch(`/api/buyer/rfqs/${rfq.id}/weights`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ weight_price: 50, weight_delivery: 30, weight_payment: 20 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject weight update on ACTIVE RFQ with 409', async () => {
    const rfq = await createTestRfq({ buyer_id: buyer.id, status: 'ACTIVE' });

    const res = await request
      .patch(`/api/buyer/rfqs/${rfq.id}/weights`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ weight_price: 40, weight_delivery: 40, weight_payment: 20 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('should reject weight update on CLOSED RFQ with 409', async () => {
    const rfq = await createTestRfq({ buyer_id: buyer.id, status: 'CLOSED' });

    const res = await request
      .patch(`/api/buyer/rfqs/${rfq.id}/weights`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ weight_price: 40, weight_delivery: 40, weight_payment: 20 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('should reject weight update on AWARDED RFQ with 409', async () => {
    const rfq = await createTestRfq({ buyer_id: buyer.id, status: 'AWARDED' });

    const res = await request
      .patch(`/api/buyer/rfqs/${rfq.id}/weights`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ weight_price: 40, weight_delivery: 40, weight_payment: 20 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('should accept weight {100, 0, 0}', async () => {
    const rfq = await createTestRfq({ buyer_id: buyer.id, status: 'DRAFT' });

    const res = await request
      .patch(`/api/buyer/rfqs/${rfq.id}/weights`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ weight_price: 100, weight_delivery: 0, weight_payment: 0 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth token', async () => {
    const rfq = await createTestRfq({ buyer_id: buyer.id, status: 'DRAFT' });

    const res = await request
      .patch(`/api/buyer/rfqs/${rfq.id}/weights`)
      .send({ weight_price: 40, weight_delivery: 40, weight_payment: 20 });

    expect(res.status).toBe(401);
  });

  it('should return 403 for supplier role', async () => {
    const supplier = await createTestSupplier();
    const supplierToken = getAccessToken(supplier.userId, UserRole.SUPPLIER);
    const rfq = await createTestRfq({ buyer_id: buyer.id, status: 'DRAFT' });

    const res = await request
      .patch(`/api/buyer/rfqs/${rfq.id}/weights`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({ weight_price: 40, weight_delivery: 40, weight_payment: 20 });

    expect(res.status).toBe(403);
  });

  it('should return 404 for non-owner buyer', async () => {
    const otherBuyer = await createTestUser({ role: 'BUYER' });
    const otherToken = getAccessToken(otherBuyer.id, UserRole.BUYER);
    const rfq = await createTestRfq({ buyer_id: buyer.id, status: 'DRAFT' });

    const res = await request
      .patch(`/api/buyer/rfqs/${rfq.id}/weights`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ weight_price: 40, weight_delivery: 40, weight_payment: 20 });

    expect(res.status).toBe(404);
  });
});
