import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  getTestDb,
  createTestUser,
} from '../helpers/setup';
import { generateRfqNumber } from '../../src/modules/rfq/rfq-number.service';

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await cleanDatabase();
});

describe('RFQ Number Generator', () => {
  const year = new Date().getFullYear();

  it('should generate RFQ-YYYY-0001 for the first RFQ of a buyer', async () => {
    const buyer = await createTestUser({ role: 'BUYER' });
    const db = getTestDb();
    const trx = await db.transaction();

    try {
      const number = await generateRfqNumber(buyer.id, trx);
      expect(number).toBe(`RFQ-${year}-0001`);
      await trx.rollback();
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  });

  it('should generate RFQ-YYYY-0002 when one RFQ already exists for that buyer', async () => {
    const buyer = await createTestUser({ role: 'BUYER' });
    const db = getTestDb();

    // Insert a first RFQ directly
    await db('rfqs').insert({
      rfq_number: `RFQ-${year}-0001`,
      buyer_id: buyer.id,
      title: 'First RFQ',
      status: 'DRAFT',
    });

    const trx = await db.transaction();
    try {
      const number = await generateRfqNumber(buyer.id, trx);
      expect(number).toBe(`RFQ-${year}-0002`);
      await trx.rollback();
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  });

  it('should use global sequence (not per-buyer)', async () => {
    const buyerA = await createTestUser({ role: 'BUYER', email: 'buyerA@test.com' });
    const buyerB = await createTestUser({ role: 'BUYER', email: 'buyerB@test.com' });
    const db = getTestDb();

    // Buyer A has 3 RFQs
    for (let i = 1; i <= 3; i++) {
      await db('rfqs').insert({
        rfq_number: `RFQ-${year}-${String(i).padStart(4, '0')}`,
        buyer_id: buyerA.id,
        title: `RFQ ${i}`,
        status: 'DRAFT',
      });
    }

    // Buyer B should get 0004 (global next, not 0001)
    const trx = await db.transaction();
    try {
      const number = await generateRfqNumber(buyerB.id, trx);
      expect(number).toBe(`RFQ-${year}-0004`);
      await trx.rollback();
    } catch (err) {
      await trx.rollback();
      throw err;
    }

    // Buyer A should also get 0004
    const trx2 = await db.transaction();
    try {
      const number = await generateRfqNumber(buyerA.id, trx2);
      expect(number).toBe(`RFQ-${year}-0004`);
      await trx2.rollback();
    } catch (err) {
      await trx2.rollback();
      throw err;
    }
  });

  it('should zero-pad correctly', async () => {
    const buyer = await createTestUser({ role: 'BUYER' });
    const db = getTestDb();

    // Insert 41 RFQs
    for (let i = 1; i <= 41; i++) {
      await db('rfqs').insert({
        rfq_number: `RFQ-${year}-${String(i).padStart(4, '0')}`,
        buyer_id: buyer.id,
        title: `RFQ ${i}`,
        status: 'DRAFT',
      });
    }

    const trx = await db.transaction();
    try {
      const number = await generateRfqNumber(buyer.id, trx);
      expect(number).toBe(`RFQ-${year}-0042`);
      await trx.rollback();
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  });

  it('should use the current year in the format', async () => {
    const buyer = await createTestUser({ role: 'BUYER' });
    const db = getTestDb();
    const trx = await db.transaction();

    try {
      const number = await generateRfqNumber(buyer.id, trx);
      expect(number).toMatch(new RegExp(`^RFQ-${year}-\\d{4}$`));
      await trx.rollback();
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  });
});
