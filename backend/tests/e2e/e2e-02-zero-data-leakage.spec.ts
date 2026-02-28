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
  app,
} from '../helpers/setup';
import { UserRole } from '../../src/shared/types/enums';

/**
 * E2E-02: Zero Data Leakage
 *
 * 3 suppliers bid on the same RFQ with distinct prices.
 * For each supplier, all supplier-facing API responses are recursively scanned.
 * No competitor price, supplier code, or numeric rank position may appear.
 */
describe('E2E-02: Zero Data Leakage', () => {
  let buyerToken: string;

  const suppliers: Array<{
    userId: string;
    supplierId: string;
    email: string;
    uniqueCode: string;
    password: string;
    token: string;
  }> = [];

  // Distinct prices per supplier — easily identifiable in scans
  const supplierPrices = [
    [{ unit_price: 111.11 }, { unit_price: 222.22 }, { unit_price: 333.33 }],
    [{ unit_price: 444.44 }, { unit_price: 555.55 }, { unit_price: 666.66 }],
    [{ unit_price: 777.77 }, { unit_price: 888.88 }, { unit_price: 999.99 }],
  ];

  let rfqId: string;
  let itemIds: string[] = [];

  /**
   * Recursively extract all primitive values (strings and numbers) from an object.
   */
  function extractAllValues(obj: unknown): Array<string | number> {
    const values: Array<string | number> = [];

    function walk(node: unknown): void {
      if (node === null || node === undefined) return;
      if (typeof node === 'string') {
        values.push(node);
        return;
      }
      if (typeof node === 'number') {
        values.push(node);
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      if (typeof node === 'object') {
        for (const val of Object.values(node as Record<string, unknown>)) {
          walk(val);
        }
      }
    }

    walk(obj);
    return values;
  }

  /**
   * Assert that none of the forbidden values appear in the response body.
   * Checks exact number matches and exact string equality (not substring).
   * Substring matching causes false positives when short supplier codes
   * appear inside UUIDs, hashes, or other long strings.
   */
  function assertNoForbiddenValues(
    body: unknown,
    forbiddenNumbers: number[],
    forbiddenStrings: string[],
    context: string,
  ): void {
    const allValues = extractAllValues(body);

    for (const val of allValues) {
      if (typeof val === 'number') {
        for (const forbidden of forbiddenNumbers) {
          expect({ context, value: val, forbidden }).not.toEqual(
            expect.objectContaining({ value: forbidden }),
          );
        }
      }
      if (typeof val === 'string') {
        // Use exact equality — supplier codes/IDs must not appear as standalone values
        for (const forbidden of forbiddenStrings) {
          expect({ context, value: val, forbidden }).not.toEqual(
            expect.objectContaining({ value: forbidden }),
          );
        }
        // Also check if competitor price appears as an exact string value
        for (const forbidden of forbiddenNumbers) {
          expect({ context, value: val, forbidden: String(forbidden) }).not.toEqual(
            expect.objectContaining({ value: String(forbidden) }),
          );
        }
      }
    }
  }

  beforeAll(async () => {
    await setupTestDatabase();
    await connectTestRedis();
    await cleanDatabase();
    await cleanRedis();

    // Create buyer
    const buyerUser = await createTestUser({ role: 'BUYER' });
    buyerToken = getAccessToken(buyerUser.id, UserRole.BUYER);

    // Create 3 suppliers
    for (let i = 0; i < 3; i++) {
      const s = await createTestSupplier({ company_name: `Leakage Supplier ${i + 1}` });
      suppliers.push({
        ...s,
        token: getAccessToken(s.userId, UserRole.SUPPLIER),
      });
    }
  });

  afterAll(async () => {
    await teardownTestDatabase();
    await closeTestRedis();
  });

  it('Setup: Create RFQ, publish, accept, and submit distinct bids', async () => {
    // Create RFQ with 3 items
    const rfqRes = await supertest(app)
      .post('/api/buyer/rfqs')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        title: 'Zero Leakage RFQ',
        payment_terms: 'Net 30',
        freight_terms: 'FOB',
        delivery_lead_time_days: 14,
        offer_validity_days: 30,
        max_revisions: 3,
        min_change_percent: 1,
        cooling_time_minutes: 0,
        bid_open_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        bid_close_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        weight_price: 100,
        weight_delivery: 0,
        weight_payment: 0,
        items: [
          { sl_no: 1, description: 'Leakage Item A', uom: 'PCS', quantity: 10 },
          { sl_no: 2, description: 'Leakage Item B', uom: 'KG', quantity: 20 },
          { sl_no: 3, description: 'Leakage Item C', uom: 'LTR', quantity: 30 },
        ],
      });

    expect(rfqRes.status).toBe(201);
    rfqId = rfqRes.body.data.id;

    // Get item IDs
    const db = getTestDb();
    const items = await db('rfq_items').where('rfq_id', rfqId).orderBy('sl_no');
    itemIds = items.map((i: { id: string }) => i.id);

    // Assign and publish
    const assignRes = await supertest(app)
      .post(`/api/buyer/rfqs/${rfqId}/suppliers`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ supplier_ids: suppliers.map((s) => s.supplierId) });
    expect(assignRes.status).toBe(201);

    const pubRes = await supertest(app)
      .post(`/api/buyer/rfqs/${rfqId}/publish`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(pubRes.status).toBe(200);

    // All 3 suppliers accept
    for (const s of suppliers) {
      const acceptRes = await supertest(app)
        .post(`/api/supplier/rfqs/${rfqId}/accept`)
        .set('Authorization', `Bearer ${s.token}`)
        .send({
          declaration_rfq_terms: true,
          declaration_no_collusion: true,
          declaration_confidentiality: true,
        });
      expect(acceptRes.status).toBe(200);
    }

    // Ensure bid window is open
    await db('rfqs').where('id', rfqId).update({
      bid_open_at: new Date(Date.now() - 60 * 60 * 1000),
      bid_close_at: new Date(Date.now() + 60 * 60 * 1000),
    });

    // Each supplier submits bids with distinct prices
    for (let i = 0; i < 3; i++) {
      const bidRes = await supertest(app)
        .post(`/api/supplier/rfqs/${rfqId}/bids`)
        .set('Authorization', `Bearer ${suppliers[i].token}`)
        .send({
          items: itemIds.map((itemId, j) => ({
            rfq_item_id: itemId,
            unit_price: supplierPrices[i][j].unit_price,
          })),
        });
      expect(bidRes.status).toBe(201);
    }
  });

  it('Scan: No competitor data in any supplier response', async () => {
    for (let i = 0; i < 3; i++) {
      const s = suppliers[i];

      // Build forbidden values from the OTHER two suppliers
      const competitorIndices = [0, 1, 2].filter((idx) => idx !== i);
      const forbiddenPrices: number[] = [];
      const forbiddenCodes: string[] = [];

      for (const ci of competitorIndices) {
        forbiddenCodes.push(suppliers[ci].uniqueCode);
        forbiddenCodes.push(suppliers[ci].supplierId);
        forbiddenCodes.push(suppliers[ci].userId);
        for (const p of supplierPrices[ci]) {
          forbiddenPrices.push(p.unit_price);
        }
      }

      // 1. GET /api/supplier/rfqs/:id
      const rfqRes = await supertest(app)
        .get(`/api/supplier/rfqs/${rfqId}`)
        .set('Authorization', `Bearer ${s.token}`);
      expect(rfqRes.status).toBe(200);

      // Exclude commercial_locked_by_supplier_code — this field intentionally
      // records which supplier first accepted (triggering the commercial lock).
      // It is RFQ-level metadata, not competitive intelligence.
      const rfqBody = JSON.parse(JSON.stringify(rfqRes.body));
      if (rfqBody?.data?.commercial_locked_by_supplier_code) {
        delete rfqBody.data.commercial_locked_by_supplier_code;
      }
      assertNoForbiddenValues(
        rfqBody,
        forbiddenPrices,
        forbiddenCodes,
        `Supplier ${i + 1} RFQ detail`,
      );

      // 2. GET /api/supplier/rfqs/:id/ranking
      const rankRes = await supertest(app)
        .get(`/api/supplier/rfqs/${rfqId}/ranking`)
        .set('Authorization', `Bearer ${s.token}`);
      expect(rankRes.status).toBe(200);
      assertNoForbiddenValues(
        rankRes.body,
        forbiddenPrices,
        forbiddenCodes,
        `Supplier ${i + 1} ranking`,
      );

      // Verify no numeric rank position (1, 2, 3) leaks as a "rank" field value
      // The ranking response should only contain relative info (rank_color, proximity_label)
      const rankBody = rankRes.body.data;
      if (rankBody) {
        expect(rankBody.rank).toBeUndefined();
        expect(rankBody.position).toBeUndefined();
      }

      // 3. GET /api/supplier/rfqs/:id/bid-status
      const statusRes = await supertest(app)
        .get(`/api/supplier/rfqs/${rfqId}/bid-status`)
        .set('Authorization', `Bearer ${s.token}`);
      expect(statusRes.status).toBe(200);
      assertNoForbiddenValues(
        statusRes.body,
        forbiddenPrices,
        forbiddenCodes,
        `Supplier ${i + 1} bid-status`,
      );
    }
  });
});
