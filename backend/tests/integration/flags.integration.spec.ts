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
let buyer1Token: string;
let buyer2: { id: string; email: string };
let buyer2Token: string;
let supplier1: { userId: string; supplierId: string; uniqueCode: string };
let supplier1Token: string;
let supplier2: { userId: string; supplierId: string; uniqueCode: string };
let supplier3: { userId: string; supplierId: string; uniqueCode: string };

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

  // Create buyers
  buyer1 = await createTestUser({ email: 'buyer1@test.com', role: 'BUYER' });
  buyer1Token = getAccessToken(buyer1.id, UserRole.BUYER);
  buyer2 = await createTestUser({ email: 'buyer2@test.com', role: 'BUYER' });
  buyer2Token = getAccessToken(buyer2.id, UserRole.BUYER);

  // Create suppliers
  supplier1 = await createTestSupplier({ email: 's1@test.com' });
  supplier1Token = getAccessToken(supplier1.userId, UserRole.SUPPLIER);
  supplier2 = await createTestSupplier({ email: 's2@test.com' });
  supplier3 = await createTestSupplier({ email: 's3@test.com' });
});

describe('GET /api/buyer/rfqs/:id/flags', () => {
  it('should return 200 with empty array when no flags exist', async () => {
    const rfq = await createTestRfq({
      buyer_id: buyer1.id,
      status: 'ACTIVE',
      payment_terms: 'Net 30',
      delivery_lead_time_days: 10,
      bid_open_at: new Date(Date.now() - 3600000).toISOString(),
      bid_close_at: new Date(Date.now() + 3600000).toISOString(),
    });

    const res = await request
      .get(`/api/buyer/rfqs/${rfq.id}/flags`)
      .set('Authorization', `Bearer ${buyer1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('should return FLAG-03 after abnormally low price bid is submitted', async () => {
    // Create RFQ with 2 items
    const rfq = await createTestRfq({
      buyer_id: buyer1.id,
      status: 'ACTIVE',
      payment_terms: 'Net 30',
      delivery_lead_time_days: 10,
      bid_open_at: new Date(Date.now() - 3600000).toISOString(),
      bid_close_at: new Date(Date.now() + 3600000).toISOString(),
    });

    const item1 = await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Item A', quantity: 100 });
    const item2 = await createTestRfqItem(rfq.id, { sl_no: 2, description: 'Item B', quantity: 50 });

    // Assign 3 suppliers (all ACCEPTED)
    await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
    await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });
    await assignTestSupplier(rfq.id, supplier3.supplierId, supplier3.uniqueCode, { status: 'ACCEPTED' });

    // Supplier 1: normal prices (100 per unit)
    await createTestBid({
      rfq_id: rfq.id,
      supplier_id: supplier1.supplierId,
      supplier_code: supplier1.uniqueCode,
      items: [
        { rfq_item_id: item1.id, unit_price: 100, quantity: 100 },
        { rfq_item_id: item2.id, unit_price: 100, quantity: 50 },
      ],
    });

    // Supplier 2: normal prices (100 per unit)
    await createTestBid({
      rfq_id: rfq.id,
      supplier_id: supplier2.supplierId,
      supplier_code: supplier2.uniqueCode,
      items: [
        { rfq_item_id: item1.id, unit_price: 100, quantity: 100 },
        { rfq_item_id: item2.id, unit_price: 100, quantity: 50 },
      ],
    });

    // Supplier 3: abnormally low prices (10 per unit)
    // avg = (100 + 100 + 10) / 3 = 70, boundary = 70 * 0.6 = 42, 10 < 42 → FLAG-03
    await createTestBid({
      rfq_id: rfq.id,
      supplier_id: supplier3.supplierId,
      supplier_code: supplier3.uniqueCode,
      items: [
        { rfq_item_id: item1.id, unit_price: 10, quantity: 100 },
        { rfq_item_id: item2.id, unit_price: 10, quantity: 50 },
      ],
    });

    // Trigger flag evaluation manually (since createTestBid bypasses bid.service)
    const { evaluateFlags } = await import('../../src/modules/flags/flag.service');
    await evaluateFlags(rfq.id);

    // GET flags
    const res = await request
      .get(`/api/buyer/rfqs/${rfq.id}/flags`)
      .set('Authorization', `Bearer ${buyer1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    // Find FLAG-03 entries
    const flag03Entries = res.body.data.filter(
      (f: Record<string, unknown>) => f.flag_id === 'FLAG-03',
    );
    expect(flag03Entries.length).toBeGreaterThanOrEqual(1);

    // Check the flag has correct data
    const flag = flag03Entries[0];
    expect(flag.flag_type).toBe('abnormal_price');
    expect(flag.affected_supplier_code).toBe(supplier3.uniqueCode);
    expect(flag.is_active).toBe(true);
    expect(flag.detail_text).toBeTruthy();
    expect(flag.recommendation_text).toBeTruthy();
  });

  it('should return 403 when supplier tries to access buyer flags endpoint', async () => {
    const rfq = await createTestRfq({
      buyer_id: buyer1.id,
      status: 'ACTIVE',
    });

    const res = await request
      .get(`/api/buyer/rfqs/${rfq.id}/flags`)
      .set('Authorization', `Bearer ${supplier1Token}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 when non-owner buyer tries to access flags', async () => {
    const rfq = await createTestRfq({
      buyer_id: buyer1.id,
      status: 'ACTIVE',
    });

    const res = await request
      .get(`/api/buyer/rfqs/${rfq.id}/flags`)
      .set('Authorization', `Bearer ${buyer2Token}`);

    expect(res.status).toBe(404);
  });

  it('should return 401 when no auth token is provided', async () => {
    const rfq = await createTestRfq({
      buyer_id: buyer1.id,
      status: 'ACTIVE',
    });

    const res = await request.get(`/api/buyer/rfqs/${rfq.id}/flags`);

    expect(res.status).toBe(401);
  });

  it('should deactivate old flags when new evaluation runs', async () => {
    // Create RFQ and items
    const rfq = await createTestRfq({
      buyer_id: buyer1.id,
      status: 'ACTIVE',
      payment_terms: 'Net 30',
      delivery_lead_time_days: 10,
      bid_open_at: new Date(Date.now() - 3600000).toISOString(),
      bid_close_at: new Date(Date.now() + 3600000).toISOString(),
    });


    const item1 = await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Item A', quantity: 100 });

    await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
    await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });
    await assignTestSupplier(rfq.id, supplier3.supplierId, supplier3.uniqueCode, { status: 'ACCEPTED' });

    // First evaluation: abnormally low price
    await createTestBid({
      rfq_id: rfq.id,
      supplier_id: supplier1.supplierId,
      supplier_code: supplier1.uniqueCode,
      items: [{ rfq_item_id: item1.id, unit_price: 100, quantity: 100 }],
    });
    await createTestBid({
      rfq_id: rfq.id,
      supplier_id: supplier2.supplierId,
      supplier_code: supplier2.uniqueCode,
      items: [{ rfq_item_id: item1.id, unit_price: 100, quantity: 100 }],
    });
    await createTestBid({
      rfq_id: rfq.id,
      supplier_id: supplier3.supplierId,
      supplier_code: supplier3.uniqueCode,
      items: [{ rfq_item_id: item1.id, unit_price: 10, quantity: 100 }],
    });

    const { evaluateFlags } = await import('../../src/modules/flags/flag.service');
    await evaluateFlags(rfq.id);

    // First check: flags exist
    let res = await request
      .get(`/api/buyer/rfqs/${rfq.id}/flags`)
      .set('Authorization', `Bearer ${buyer1Token}`);
    expect(res.body.data.length).toBeGreaterThan(0);

    // Now all bids at same price → re-evaluation should clear flags
    const { getTestDb } = await import('../helpers/setup');
    const db = getTestDb();
    // Use raw SQL because Knex doesn't support JOIN-based UPDATE in PostgreSQL
    await db.raw(
      `UPDATE bid_items SET unit_price = 100
       WHERE bid_id IN (SELECT id FROM bids WHERE supplier_id = ?)`,
      [supplier3.supplierId],
    );

    await evaluateFlags(rfq.id);

    // Second check: flags should now be empty (since prices are normal)
    res = await request
      .get(`/api/buyer/rfqs/${rfq.id}/flags`)
      .set('Authorization', `Bearer ${buyer1Token}`);
    // FLAG-03 should no longer appear for abnormal price
    const flag03 = res.body.data.filter((f: Record<string, unknown>) => f.flag_id === 'FLAG-03');
    expect(flag03.length).toBe(0);
  });
});
