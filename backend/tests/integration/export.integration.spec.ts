import supertest from 'supertest';
import {
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
let supplier: { userId: string; supplierId: string; uniqueCode: string };
let supplierToken: string;

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

async function createClosedRfqWithBid() {
  const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'CLOSED' });
  const item = await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Test Item', quantity: 100 });

  await assignTestSupplier(rfq.id, supplier.supplierId, supplier.uniqueCode, { status: 'ACCEPTED' });
  await createTestBid({
    rfq_id: rfq.id,
    supplier_id: supplier.supplierId,
    supplier_code: supplier.uniqueCode,
    items: [{ rfq_item_id: item.id, unit_price: 50, quantity: 100 }],
  });

  return { rfq, item };
}

describe('GET /api/supplier/rfqs/:id/receipt', () => {
  it('should return a PDF receipt for a supplier with a bid', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'ACTIVE' });
    const item = await createTestRfqItem(rfq.id);
    await assignTestSupplier(rfq.id, supplier.supplierId, supplier.uniqueCode, { status: 'ACCEPTED' });
    await createTestBid({
      rfq_id: rfq.id,
      supplier_id: supplier.supplierId,
      supplier_code: supplier.uniqueCode,
      items: [{ rfq_item_id: item.id, unit_price: 100, quantity: 100 }],
    });

    const res = await supertest(app)
      .get(`/api/supplier/rfqs/${rfq.id}/receipt`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should return 404 when supplier has no bid', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'ACTIVE' });
    await createTestRfqItem(rfq.id);
    await assignTestSupplier(rfq.id, supplier.supplierId, supplier.uniqueCode, { status: 'ACCEPTED' });

    const res = await supertest(app)
      .get(`/api/supplier/rfqs/${rfq.id}/receipt`)
      .set('Authorization', `Bearer ${supplierToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 403 for unassigned supplier', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'ACTIVE' });
    await createTestRfqItem(rfq.id);
    // Do NOT assign supplier

    const res = await supertest(app)
      .get(`/api/supplier/rfqs/${rfq.id}/receipt`)
      .set('Authorization', `Bearer ${supplierToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/buyer/rfqs/:id/export/excel', () => {
  it('should return XLSX for a CLOSED RFQ', async () => {
    const { rfq } = await createClosedRfqWithBid();

    const res = await supertest(app)
      .get(`/api/buyer/rfqs/${rfq.id}/export/excel`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should reject export for an ACTIVE RFQ with 409', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'ACTIVE' });

    const res = await supertest(app)
      .get(`/api/buyer/rfqs/${rfq.id}/export/excel`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(409);
  });

  it('should return 404 for non-owned RFQ', async () => {
    const otherBuyer = await createTestUser({ role: 'BUYER' });
    const rfq = await createTestRfq({ buyer_id: otherBuyer.id, status: 'CLOSED' });

    const res = await supertest(app)
      .get(`/api/buyer/rfqs/${rfq.id}/export/excel`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/buyer/rfqs/:id/export/pdf', () => {
  it('should return PDF for a CLOSED RFQ', async () => {
    const { rfq } = await createClosedRfqWithBid();

    const res = await supertest(app)
      .get(`/api/buyer/rfqs/${rfq.id}/export/pdf`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should reject export for DRAFT RFQ with 409', async () => {
    const rfq = await createTestRfq({ buyer_id: buyerUser.id, status: 'DRAFT' });

    const res = await supertest(app)
      .get(`/api/buyer/rfqs/${rfq.id}/export/pdf`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(409);
  });
});
