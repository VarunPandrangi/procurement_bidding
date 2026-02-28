import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  connectTestRedis,
  cleanRedis,
  closeTestRedis,
  getTestDb,
  createTestUser,
  createTestSupplier,
  createTestRfq,
  createTestRfqItem,
  assignTestSupplier,
} from '../helpers/setup';
import { acceptRfq } from '../../src/modules/rfq/rfq.service';
import { AuditEventType } from '../../src/shared/types/enums';

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
});

describe('Commercial Lock', () => {
  async function setupRfqWithSuppliers() {
    const buyer = await createTestUser({ role: 'BUYER', email: 'buyer@test.com' });
    const supplier1 = await createTestSupplier({ email: 'supplier1@test.com', company_name: 'Alpha Co' });
    const supplier2 = await createTestSupplier({ email: 'supplier2@test.com', company_name: 'Beta Co' });

    const rfq = await createTestRfq({
      buyer_id: buyer.id,
      title: 'Lock Test RFQ',
      status: 'PUBLISHED',
      payment_terms: 'Net 30',
      freight_terms: 'FOB Destination',
      delivery_lead_time_days: 15,
    });

    await createTestRfqItem(rfq.id, { sl_no: 1, description: 'Widget A', uom: 'PCS', quantity: 100 });
    await createTestRfqItem(rfq.id, { sl_no: 2, description: 'Widget B', uom: 'KG', quantity: 50 });

    await assignTestSupplier(rfq.id, supplier1.supplierId, supplier1.uniqueCode);
    await assignTestSupplier(rfq.id, supplier2.supplierId, supplier2.uniqueCode);

    return { buyer, supplier1, supplier2, rfq };
  }

  it('should set commercial_locked_at and commercial_locked_by_supplier_code on first acceptance', async () => {
    const { supplier1, rfq } = await setupRfqWithSuppliers();

    await acceptRfq(rfq.id, supplier1.supplierId, {
      declaration_rfq_terms: true,
      declaration_no_collusion: true,
      declaration_confidentiality: true,
    });

    const db = getTestDb();
    const updatedRfq = await db('rfqs').where('id', rfq.id).first();

    expect(updatedRfq.commercial_locked_at).not.toBeNull();
    expect(updatedRfq.commercial_locked_by_supplier_code.trim()).toBe(supplier1.uniqueCode);
  });

  it('should create COMMERCIAL_LOCK audit entry with terms and items snapshot', async () => {
    const { supplier1, rfq } = await setupRfqWithSuppliers();

    await acceptRfq(rfq.id, supplier1.supplierId, {
      declaration_rfq_terms: true,
      declaration_no_collusion: true,
      declaration_confidentiality: true,
    });

    const db = getTestDb();
    const auditEntries = await db('audit_log')
      .where({ event_type: AuditEventType.COMMERCIAL_LOCK, rfq_id: rfq.id });

    expect(auditEntries.length).toBe(1);

    const entry = auditEntries[0];
    const eventData = typeof entry.event_data === 'string'
      ? JSON.parse(entry.event_data)
      : entry.event_data;

    expect(eventData.locked_by_supplier_code).toBe(supplier1.uniqueCode);
    expect(eventData.commercial_terms_snapshot).toBeDefined();
    expect(eventData.commercial_terms_snapshot.payment_terms).toBe('Net 30');
    expect(eventData.commercial_terms_snapshot.freight_terms).toBe('FOB Destination');
    expect(eventData.commercial_terms_snapshot.delivery_lead_time_days).toBe(15);
    expect(eventData.commercial_terms_snapshot.items).toHaveLength(2);
    expect(eventData.commercial_terms_snapshot.items[0].description).toBe('Widget A');
    expect(eventData.commercial_terms_snapshot.items[1].description).toBe('Widget B');
  });

  it('should NOT change lock fields on second supplier acceptance', async () => {
    const { supplier1, supplier2, rfq } = await setupRfqWithSuppliers();
    const db = getTestDb();

    // First acceptance triggers the lock
    await acceptRfq(rfq.id, supplier1.supplierId, {
      declaration_rfq_terms: true,
      declaration_no_collusion: true,
      declaration_confidentiality: true,
    });

    const rfqAfterFirst = await db('rfqs').where('id', rfq.id).first();
    const firstLockTime = rfqAfterFirst.commercial_locked_at;
    const firstLockCode = rfqAfterFirst.commercial_locked_by_supplier_code;

    // Second acceptance should NOT change lock
    await acceptRfq(rfq.id, supplier2.supplierId, {
      declaration_rfq_terms: true,
      declaration_no_collusion: true,
      declaration_confidentiality: true,
    });

    const rfqAfterSecond = await db('rfqs').where('id', rfq.id).first();

    expect(rfqAfterSecond.commercial_locked_at.getTime()).toBe(firstLockTime.getTime());
    expect(rfqAfterSecond.commercial_locked_by_supplier_code).toBe(firstLockCode);
  });

  it('should create SUPPLIER_ACCEPTED audit entries for both acceptances', async () => {
    const { supplier1, supplier2, rfq } = await setupRfqWithSuppliers();
    const db = getTestDb();

    await acceptRfq(rfq.id, supplier1.supplierId, {
      declaration_rfq_terms: true,
      declaration_no_collusion: true,
      declaration_confidentiality: true,
    });

    await acceptRfq(rfq.id, supplier2.supplierId, {
      declaration_rfq_terms: true,
      declaration_no_collusion: true,
      declaration_confidentiality: true,
    });

    const acceptEntries = await db('audit_log')
      .where({ event_type: AuditEventType.SUPPLIER_ACCEPTED, rfq_id: rfq.id })
      .orderBy('created_at', 'asc');

    expect(acceptEntries.length).toBe(2);

    // Only one COMMERCIAL_LOCK entry
    const lockEntries = await db('audit_log')
      .where({ event_type: AuditEventType.COMMERCIAL_LOCK, rfq_id: rfq.id });

    expect(lockEntries.length).toBe(1);
  });

  it('should have a valid timestamp for commercial_locked_at', async () => {
    const { supplier1, rfq } = await setupRfqWithSuppliers();
    const before = new Date();

    await acceptRfq(rfq.id, supplier1.supplierId, {
      declaration_rfq_terms: true,
      declaration_no_collusion: true,
      declaration_confidentiality: true,
    });

    const after = new Date();
    const db = getTestDb();
    const updatedRfq = await db('rfqs').where('id', rfq.id).first();
    const lockTime = new Date(updatedRfq.commercial_locked_at);

    expect(lockTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(lockTime.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
