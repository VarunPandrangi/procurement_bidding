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
  createTestNegotiation,
  addNegotiationSupplier,
  createTestNegotiationBid,
  app,
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

let buyerUser: { id: string; email: string; role: string };
let buyerToken: string;
let supplier1: { userId: string; supplierId: string; uniqueCode: string };
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

  buyerUser = await createTestUser({ role: 'BUYER' });
  buyerToken = getAccessToken(buyerUser.id, UserRole.BUYER);
  supplier1 = await createTestSupplier();
  supplier2 = await createTestSupplier();
});

/**
 * Create a CLOSED RFQ with 3 items, 2 suppliers (with bids on the RFQ),
 * then create an ACTIVE negotiation with the same suppliers and negotiation bids.
 *
 * Supplier 1 negotiation prices: [10, 20, 30]
 * Supplier 2 negotiation prices: [15, 18, 25]
 * Quantities: [100, 50, 200]
 * Supplier 1 delivery_days: 5
 * Supplier 2 delivery_days: 10
 */
async function createNegotiationWithBids() {
  // 1. Create CLOSED parent RFQ with items
  const rfq = await createTestRfq({
    buyer_id: buyerUser.id,
    status: 'CLOSED',
    bid_open_at: new Date(Date.now() - 7200000).toISOString(),
    bid_close_at: new Date(Date.now() - 3600000).toISOString(),
  });
  const item1 = await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Item A', quantity: 100 });
  const item2 = await createTestRfqItem(rfq.id, { sl_no: 2, description: 'Item B', quantity: 50 });
  const item3 = await createTestRfqItem(rfq.id, { sl_no: 3, description: 'Item C', quantity: 200 });

  // 2. Assign suppliers to parent RFQ with delivery days
  await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, {
    status: 'ACCEPTED',
    supplier_delivery_days: 5,
  });
  await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, {
    status: 'ACCEPTED',
    supplier_delivery_days: 10,
  });

  // 3. Create ACTIVE negotiation
  const negotiation = await createTestNegotiation({
    parent_rfq_id: rfq.id,
    buyer_id: buyerUser.id,
    status: 'ACTIVE',
    bid_open_at: new Date(Date.now() - 3600000).toISOString(),
    bid_close_at: new Date(Date.now() + 3600000).toISOString(),
    max_revisions: 5,
    min_change_percent: 1.0,
    cooling_time_minutes: 0,
    anti_snipe_window_minutes: 0,
    anti_snipe_extension_minutes: 0,
  });

  // 5. Add suppliers to negotiation
  await addNegotiationSupplier(negotiation.id, supplier1.supplierId, supplier1.uniqueCode);
  await addNegotiationSupplier(negotiation.id, supplier2.supplierId, supplier2.uniqueCode);

  // 6. Create negotiation bids with different prices from RFQ bids
  // Supplier 1 negotiation prices: [10, 20, 30]
  await createTestNegotiationBid({
    negotiation_id: negotiation.id,
    rfq_id: rfq.id,
    supplier_id: supplier1.supplierId,
    supplier_code: supplier1.uniqueCode,
    items: [
      { rfq_item_id: item1.id, unit_price: 10, quantity: 100 },
      { rfq_item_id: item2.id, unit_price: 20, quantity: 50 },
      { rfq_item_id: item3.id, unit_price: 30, quantity: 200 },
    ],
  });

  // Supplier 2 negotiation prices: [15, 18, 25]
  await createTestNegotiationBid({
    negotiation_id: negotiation.id,
    rfq_id: rfq.id,
    supplier_id: supplier2.supplierId,
    supplier_code: supplier2.uniqueCode,
    items: [
      { rfq_item_id: item1.id, unit_price: 15, quantity: 100 },
      { rfq_item_id: item2.id, unit_price: 18, quantity: 50 },
      { rfq_item_id: item3.id, unit_price: 25, quantity: 200 },
    ],
  });

  return { rfq, negotiation, item1, item2, item3 };
}

describe('POST /api/buyer/negotiations/:id/simulation', () => {
  // ── Mode A: single_supplier ──

  it('should return correct response shape for single_supplier mode', async () => {
    const { negotiation } = await createNegotiationWithBids();

    const res = await supertest(app)
      .post(`/api/buyer/negotiations/${negotiation.id}/simulation`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ mode: 'single_supplier', supplier_id: supplier1.supplierId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.mode).toBe('single_supplier');
    expect(typeof data.total_procurement_cost).toBe('number');
    expect(typeof data.unique_supplier_count).toBe('number');
    expect(typeof data.delta_vs_l1_total).toBe('number');
    expect(typeof data.theoretical_minimum_cost).toBe('number');
    expect(Array.isArray(data.per_supplier_breakdown)).toBe(true);
    expect(typeof data.simulated_at).toBe('string');
    expect(data.delivery_outcome_days).toBeDefined();
  });

  it('should calculate correct costs for single_supplier mode', async () => {
    const { negotiation } = await createNegotiationWithBids();

    const res = await supertest(app)
      .post(`/api/buyer/negotiations/${negotiation.id}/simulation`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ mode: 'single_supplier', supplier_id: supplier1.supplierId });

    expect(res.status).toBe(200);
    const data = res.body.data;

    // Supplier 1 negotiation prices: 10*100 + 20*50 + 30*200 = 1000 + 1000 + 6000 = 8000
    expect(data.total_procurement_cost).toBe(8000);
    expect(data.unique_supplier_count).toBe(1);

    // Theoretical min per item (negotiation bids only):
    // min(10,15)*100 + min(20,18)*50 + min(30,25)*200
    // = 10*100 + 18*50 + 25*200 = 1000 + 900 + 5000 = 6900
    expect(data.theoretical_minimum_cost).toBe(6900);

    // Delta = 8000 - 6900 = 1100
    expect(data.delta_vs_l1_total).toBe(1100);

    // Delivery: supplier1 has 5 days on parent RFQ
    expect(data.delivery_outcome_days).toBe(5);

    // Breakdown
    expect(data.per_supplier_breakdown).toHaveLength(1);
    expect(data.per_supplier_breakdown[0].supplier_code).toBe(supplier1.uniqueCode);
    expect(data.per_supplier_breakdown[0].items_awarded_count).toBe(3);
    expect(data.per_supplier_breakdown[0].subtotal).toBe(8000);
  });

  // ── Mode B: item_split ──

  it('should calculate correct costs for item_split mode (valid split, L1 awards, delta=0)', async () => {
    const { negotiation, item1, item2, item3 } = await createNegotiationWithBids();

    // Award each item to its L1 supplier:
    // Item 1: sup1=10 (L1), sup2=15
    // Item 2: sup2=18 (L1), sup1=20
    // Item 3: sup2=25 (L1), sup1=30
    const res = await supertest(app)
      .post(`/api/buyer/negotiations/${negotiation.id}/simulation`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        mode: 'item_split',
        items: [
          { rfq_item_id: item1.id, supplier_id: supplier1.supplierId },
          { rfq_item_id: item2.id, supplier_id: supplier2.supplierId },
          { rfq_item_id: item3.id, supplier_id: supplier2.supplierId },
        ],
      });

    expect(res.status).toBe(200);
    const data = res.body.data;

    // Supplier 1: item1 = 10*100 = 1000
    // Supplier 2: item2 = 18*50 = 900, item3 = 25*200 = 5000 → subtotal = 5900
    // Total = 1000 + 5900 = 6900
    expect(data.total_procurement_cost).toBe(6900);
    expect(data.unique_supplier_count).toBe(2);

    // Theoretical min = 6900 (same since each item awarded to its L1)
    expect(data.theoretical_minimum_cost).toBe(6900);
    expect(data.delta_vs_l1_total).toBe(0);

    // Delivery: max(5, 10) = 10
    expect(data.delivery_outcome_days).toBe(10);

    // Per-supplier breakdown
    expect(data.per_supplier_breakdown).toHaveLength(2);

    const sup1Breakdown = data.per_supplier_breakdown.find(
      (b: any) => b.supplier_code === supplier1.uniqueCode,
    );
    const sup2Breakdown = data.per_supplier_breakdown.find(
      (b: any) => b.supplier_code === supplier2.uniqueCode,
    );

    expect(sup1Breakdown.items_awarded_count).toBe(1);
    expect(sup1Breakdown.subtotal).toBe(1000);
    expect(sup2Breakdown.items_awarded_count).toBe(2);
    expect(sup2Breakdown.subtotal).toBe(5900);
  });

  it('should return 422 ITEMS_NOT_FULLY_COVERED when item_split has missing items', async () => {
    const { negotiation, item1, item2 } = await createNegotiationWithBids();

    const res = await supertest(app)
      .post(`/api/buyer/negotiations/${negotiation.id}/simulation`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        mode: 'item_split',
        items: [
          { rfq_item_id: item1.id, supplier_id: supplier1.supplierId },
          { rfq_item_id: item2.id, supplier_id: supplier2.supplierId },
          // item3 missing
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ITEMS_NOT_FULLY_COVERED');
  });

  // ── Mode C: category_split ──

  it('should calculate correct costs for category_split mode', async () => {
    const { negotiation, item1, item2, item3 } = await createNegotiationWithBids();

    const res = await supertest(app)
      .post(`/api/buyer/negotiations/${negotiation.id}/simulation`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        mode: 'category_split',
        categories: [
          { item_ids: [item1.id, item2.id], supplier_id: supplier1.supplierId },
          { item_ids: [item3.id], supplier_id: supplier2.supplierId },
        ],
      });

    expect(res.status).toBe(200);
    const data = res.body.data;

    // Supplier 1: item1=10*100=1000, item2=20*50=1000 → subtotal=2000
    // Supplier 2: item3=25*200=5000
    // Total = 2000 + 5000 = 7000
    expect(data.total_procurement_cost).toBe(7000);
    expect(data.unique_supplier_count).toBe(2);
    expect(data.theoretical_minimum_cost).toBe(6900);
    expect(data.delta_vs_l1_total).toBe(100);
  });

  it('should return 422 ITEM_DUPLICATE_ALLOCATION when category_split has duplicate item', async () => {
    const { negotiation, item1, item2, item3 } = await createNegotiationWithBids();

    const res = await supertest(app)
      .post(`/api/buyer/negotiations/${negotiation.id}/simulation`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        mode: 'category_split',
        categories: [
          { item_ids: [item1.id, item2.id], supplier_id: supplier1.supplierId },
          { item_ids: [item2.id, item3.id], supplier_id: supplier2.supplierId },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ITEM_DUPLICATE_ALLOCATION');
  });

  // ── Zero-write invariant ──

  it('should not change negotiation status after simulation', async () => {
    const { negotiation } = await createNegotiationWithBids();

    await supertest(app)
      .post(`/api/buyer/negotiations/${negotiation.id}/simulation`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ mode: 'single_supplier', supplier_id: supplier1.supplierId });

    const db = getTestDb();
    const updatedNeg = await db('negotiation_events').where('id', negotiation.id).first();
    expect(updatedNeg.status).toBe('ACTIVE');
  });

  it('should not create any audit log entry after simulation', async () => {
    const { rfq, negotiation } = await createNegotiationWithBids();

    await supertest(app)
      .post(`/api/buyer/negotiations/${negotiation.id}/simulation`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ mode: 'single_supplier', supplier_id: supplier1.supplierId });

    const db = getTestDb();

    // No AWARD_FINALIZED or NEGOTIATION_AWARDED entries
    const finalized = await db('audit_log')
      .where({ rfq_id: rfq.id, event_type: 'AWARD_FINALIZED' })
      .first();
    expect(finalized).toBeUndefined();

    const awarded = await db('audit_log')
      .where({ rfq_id: rfq.id, event_type: 'NEGOTIATION_AWARDED' })
      .first();
    expect(awarded).toBeUndefined();

    // No AWARD_SIMULATED
    const simulated = await db('audit_log')
      .where({ rfq_id: rfq.id, event_type: 'AWARD_SIMULATED' })
      .first();
    expect(simulated).toBeUndefined();
  });

  it('should create NEGOTIATION_AWARDED audit entry when POST /award is used (contrast)', async () => {
    const { negotiation } = await createNegotiationWithBids();

    // Close the negotiation first (ACTIVE → CLOSED required before award)
    const db = getTestDb();
    await db('negotiation_events')
      .where('id', negotiation.id)
      .update({ status: 'CLOSED' });

    // First run simulation — no audit entry
    await supertest(app)
      .post(`/api/buyer/negotiations/${negotiation.id}/simulation`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ mode: 'single_supplier', supplier_id: supplier1.supplierId });

    // Then award — should create NEGOTIATION_AWARDED
    const awardRes = await supertest(app)
      .post(`/api/buyer/negotiations/${negotiation.id}/award`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        type: 'single',
        allocations: [{ supplier_id: supplier1.supplierId }],
      });

    expect(awardRes.status).toBe(200);

    const rfqId = negotiation.parent_rfq_id;
    const auditEntry = await db('audit_log')
      .where({ rfq_id: rfqId, event_type: 'NEGOTIATION_AWARDED' })
      .first();
    expect(auditEntry).toBeDefined();
  });

  // ── Supplier no bid ──

  it('should return 422 SUPPLIER_HAS_NO_BID when supplier has not submitted a bid', async () => {
    // Create negotiation with only supplier1 having a bid
    const rfq = await createTestRfq({
      buyer_id: buyerUser.id,
      status: 'CLOSED',
      bid_open_at: new Date(Date.now() - 7200000).toISOString(),
      bid_close_at: new Date(Date.now() - 3600000).toISOString(),
    });
    const item1 = await createTestRfqItem(rfq.id, { sl_no: 1, quantity: 100 });

    await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode, { status: 'ACCEPTED' });
    await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode, { status: 'ACCEPTED' });

    const negotiation = await createTestNegotiation({
      parent_rfq_id: rfq.id,
      buyer_id: buyerUser.id,
      status: 'ACTIVE',
      bid_open_at: new Date(Date.now() - 3600000).toISOString(),
      bid_close_at: new Date(Date.now() + 3600000).toISOString(),
      max_revisions: 5,
      min_change_percent: 1.0,
      cooling_time_minutes: 0,
    });

    await addNegotiationSupplier(negotiation.id, supplier1.supplierId, supplier1.uniqueCode);
    await addNegotiationSupplier(negotiation.id, supplier2.supplierId, supplier2.uniqueCode);

    // Only supplier1 submits a negotiation bid
    await createTestNegotiationBid({
      negotiation_id: negotiation.id,
      rfq_id: rfq.id,
      supplier_id: supplier1.supplierId,
      supplier_code: supplier1.uniqueCode,
      items: [{ rfq_item_id: item1.id, unit_price: 10, quantity: 100 }],
    });

    // Simulate with supplier2 who has NOT submitted a bid
    const res = await supertest(app)
      .post(`/api/buyer/negotiations/${negotiation.id}/simulation`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ mode: 'single_supplier', supplier_id: supplier2.supplierId });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SUPPLIER_HAS_NO_BID');
  });

  // ── Access control ──

  it('should return 404 for non-owned negotiation', async () => {
    const { negotiation } = await createNegotiationWithBids();

    const otherBuyer = await createTestUser({ role: 'BUYER' });
    const otherBuyerToken = getAccessToken(otherBuyer.id, UserRole.BUYER);

    const res = await supertest(app)
      .post(`/api/buyer/negotiations/${negotiation.id}/simulation`)
      .set('Authorization', `Bearer ${otherBuyerToken}`)
      .send({ mode: 'single_supplier', supplier_id: supplier1.supplierId });

    expect(res.status).toBe(404);
  });
});
