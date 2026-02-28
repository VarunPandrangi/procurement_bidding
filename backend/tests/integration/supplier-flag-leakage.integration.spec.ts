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
  createTestRfq,
  createTestRfqItem,
  assignTestSupplier,
  createTestBid,
  getAccessToken,
  seedFlagConfig,
  app,
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

const request = supertest(app);

let buyer1: { id: string; email: string };
let supplier1: { userId: string; supplierId: string; uniqueCode: string };
let supplier1Token: string;
let supplier2: { userId: string; supplierId: string; uniqueCode: string };
let supplier3: { userId: string; supplierId: string; uniqueCode: string };

let rfqId: string;

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

  // Create buyer
  buyer1 = await createTestUser({ email: 'buyer1@test.com', role: 'BUYER' });

  // Create 3 suppliers
  supplier1 = await createTestSupplier({ email: 's1@test.com' });
  supplier1Token = getAccessToken(supplier1.userId, UserRole.SUPPLIER);
  supplier2 = await createTestSupplier({ email: 's2@test.com' });
  supplier3 = await createTestSupplier({ email: 's3@test.com' });

  // Create ACTIVE RFQ with items
  const rfq = await createTestRfq({
    buyer_id: buyer1.id,
    status: 'ACTIVE',
    payment_terms: 'Net 30',
    delivery_lead_time_days: 10,
    bid_open_at: new Date(Date.now() - 3600000).toISOString(),
    bid_close_at: new Date(Date.now() + 3600000).toISOString(),
  });
  rfqId = rfq.id;

  const item1 = await createTestRfqItem(rfqId, { sl_no: 1, description: 'Item A', quantity: 100 });
  const item2 = await createTestRfqItem(rfqId, { sl_no: 2, description: 'Item B', quantity: 50 });

  // Assign all 3 suppliers (ACCEPTED)
  await assignTestSupplier(rfqId, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
  await assignTestSupplier(rfqId, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });
  await assignTestSupplier(rfqId, supplier3.supplierId, supplier3.uniqueCode, { status: 'ACCEPTED' });

  // Supplier 1 and 2: normal prices
  await createTestBid({
    rfq_id: rfqId,
    supplier_id: supplier1.supplierId,
    supplier_code: supplier1.uniqueCode,
    items: [
      { rfq_item_id: item1.id, unit_price: 100, quantity: 100 },
      { rfq_item_id: item2.id, unit_price: 100, quantity: 50 },
    ],
  });

  await createTestBid({
    rfq_id: rfqId,
    supplier_id: supplier2.supplierId,
    supplier_code: supplier2.uniqueCode,
    items: [
      { rfq_item_id: item1.id, unit_price: 100, quantity: 100 },
      { rfq_item_id: item2.id, unit_price: 100, quantity: 50 },
    ],
  });

  // Supplier 3: abnormally low price → triggers FLAG-03
  await createTestBid({
    rfq_id: rfqId,
    supplier_id: supplier3.supplierId,
    supplier_code: supplier3.uniqueCode,
    items: [
      { rfq_item_id: item1.id, unit_price: 10, quantity: 100 },
      { rfq_item_id: item2.id, unit_price: 10, quantity: 50 },
    ],
  });

  // Run flag evaluation
  const { evaluateFlags } = await import('../../src/modules/flags/flag.service');
  await evaluateFlags(rfqId);
});

describe('Supplier Flag Leakage Prevention', () => {
  it('GET /api/supplier/rfqs/:id should NOT contain any flag-related keys', async () => {
    const res = await request
      .get(`/api/supplier/rfqs/${rfqId}`)
      .set('Authorization', `Bearer ${supplier1Token}`);

    expect(res.status).toBe(200);

    // Stringify entire response and check for flag-related keywords
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('"flag_id"');
    expect(bodyStr).not.toContain('"flag_type"');
    expect(bodyStr).not.toContain('"rfq_flags"');
    expect(bodyStr).not.toContain('"is_active"');
    expect(bodyStr).not.toContain('"detail_text"');
    expect(bodyStr).not.toContain('"recommendation_text"');
    expect(bodyStr).not.toContain('"affected_supplier_code"');
    expect(bodyStr).not.toContain('"affected_item_ids"');
    expect(bodyStr).not.toContain('FLAG-03');
    expect(bodyStr).not.toContain('abnormal_price');
  });

  it('GET /api/supplier/rfqs/:id/ranking should NOT contain any flag-related keys', async () => {
    const res = await request
      .get(`/api/supplier/rfqs/${rfqId}/ranking`)
      .set('Authorization', `Bearer ${supplier1Token}`);

    expect(res.status).toBe(200);

    // Stringify entire response and check for flag-related keywords
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('"flag_id"');
    expect(bodyStr).not.toContain('"flag_type"');
    expect(bodyStr).not.toContain('"rfq_flags"');
    expect(bodyStr).not.toContain('"detail_text"');
    expect(bodyStr).not.toContain('"recommendation_text"');
    expect(bodyStr).not.toContain('"affected_supplier_code"');
    expect(bodyStr).not.toContain('"affected_item_ids"');
    expect(bodyStr).not.toContain('FLAG-03');
    expect(bodyStr).not.toContain('abnormal_price');
  });

  it('supplier response body should contain no mentions of "flag" or "recommendation"', async () => {
    // GET supplier RFQ detail
    const rfqRes = await request
      .get(`/api/supplier/rfqs/${rfqId}`)
      .set('Authorization', `Bearer ${supplier1Token}`);

    expect(rfqRes.status).toBe(200);

    // Search for any form of "flag" or "recommendation" (case insensitive)
    const rfqBodyStr = JSON.stringify(rfqRes.body).toLowerCase();
    expect(rfqBodyStr).not.toContain('flag');
    expect(rfqBodyStr).not.toContain('recommendation');

    // GET supplier ranking
    const rankRes = await request
      .get(`/api/supplier/rfqs/${rfqId}/ranking`)
      .set('Authorization', `Bearer ${supplier1Token}`);

    expect(rankRes.status).toBe(200);

    const rankBodyStr = JSON.stringify(rankRes.body).toLowerCase();
    expect(rankBodyStr).not.toContain('flag');
    expect(rankBodyStr).not.toContain('recommendation');
  });

  it('supplier should get 403 attempting to access buyer flags endpoint', async () => {
    const res = await request
      .get(`/api/buyer/rfqs/${rfqId}/flags`)
      .set('Authorization', `Bearer ${supplier1Token}`);

    expect(res.status).toBe(403);
  });
});
