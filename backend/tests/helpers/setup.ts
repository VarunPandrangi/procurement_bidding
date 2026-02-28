import path from 'path';

import knex, { Knex } from 'knex';
import Redis from 'ioredis';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import app from '../../src/app';
import { generateUniqueSupplierCode } from '../../src/shared/utils/supplier-code';
import { signAccessToken } from '../../src/shared/utils/token';
import { computeBidHash } from '../../src/shared/utils/hash';
import { UserRole } from '../../src/shared/types/enums';

let db: Knex;
let redis: Redis;

export function getTestDb(): Knex {
  if (!db) {
    db = knex({
      client: 'pg',
      connection: process.env.DATABASE_URL,
      pool: { min: 1, max: 5 },
      migrations: {
        directory: path.resolve(__dirname, '../../src/database/migrations'),
        extension: 'ts',
      },
    });
  }
  return db;
}

export function getTestRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
    });
  }
  return redis;
}

export async function setupTestDatabase(): Promise<void> {
  const testDb = getTestDb();
  await testDb.migrate.forceFreeMigrationsLock();
  await testDb.migrate.latest();
}

export async function teardownTestDatabase(): Promise<void> {
  const testDb = getTestDb();
  await testDb.destroy();
}

export async function cleanDatabase(): Promise<void> {
  const testDb = getTestDb();
  await testDb.raw(`
    TRUNCATE TABLE
      bid_items,
      bids,
      negotiation_suppliers,
      negotiation_events,
      rfq_flags,
      rfq_suppliers,
      rfq_items,
      rfqs,
      audit_log,
      suppliers,
      system_config,
      users
    CASCADE
  `);
}

export async function connectTestRedis(): Promise<void> {
  const testRedis = getTestRedis();
  if (testRedis.status === 'wait') {
    await testRedis.connect();
  }
}

export async function cleanRedis(): Promise<void> {
  const testRedis = getTestRedis();
  await testRedis.flushdb();
}

export async function closeTestRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
  }
}

// Helper to create test users directly in DB
export async function createTestUser(overrides?: Partial<{
  email: string;
  password: string;
  full_name: string;
  role: string;
  is_active: boolean;
}>): Promise<{ id: string; email: string; role: string; password: string }> {
  const testDb = getTestDb();
  const password = overrides?.password || 'TestPassword123';
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '4', 10);
  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  const id = uuidv4();

  await testDb('users').insert({
    id,
    email: overrides?.email || `test-${id}@test.com`,
    password_hash: passwordHash,
    full_name: overrides?.full_name || 'Test User',
    role: overrides?.role || 'ADMIN',
    is_active: overrides?.is_active !== undefined ? overrides.is_active : true,
  });

  return {
    id,
    email: overrides?.email || `test-${id}@test.com`,
    role: overrides?.role || 'ADMIN',
    password,
  };
}

// Helper to create a test supplier (user + supplier record)
export async function createTestSupplier(overrides?: Partial<{
  email: string;
  password: string;
  company_name: string;
}>): Promise<{
  userId: string;
  supplierId: string;
  email: string;
  uniqueCode: string;
  password: string;
}> {
  const testDb = getTestDb();
  const password = overrides?.password || 'SupplierTest123';
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '4', 10);
  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  const userId = uuidv4();
  const supplierId = uuidv4();

  const existingCodes = await testDb('suppliers').select('unique_code');
  const codeSet = new Set(existingCodes.map((r: { unique_code: string }) => r.unique_code));
  const uniqueCode = generateUniqueSupplierCode(codeSet);

  await testDb('users').insert({
    id: userId,
    email: overrides?.email || `supplier-${userId}@test.com`,
    password_hash: passwordHash,
    full_name: 'Test Supplier',
    role: 'SUPPLIER',
    is_active: true,
  });

  await testDb('suppliers').insert({
    id: supplierId,
    user_id: userId,
    company_name: overrides?.company_name || 'Test Supplier Co',
    unique_code: uniqueCode,
    is_active: true,
  });

  return {
    userId,
    supplierId,
    email: overrides?.email || `supplier-${userId}@test.com`,
    uniqueCode,
    password,
  };
}

// Helper to get an access token for a test user
export function getAccessToken(userId: string, role: UserRole): string {
  return signAccessToken(userId, role);
}

// Helper to create a test RFQ directly in the DB
export async function createTestRfq(overrides?: Partial<{
  buyer_id: string;
  title: string;
  status: string;
  payment_terms: string;
  freight_terms: string;
  delivery_lead_time_days: number;
  offer_validity_days: number;
  max_revisions: number;
  min_change_percent: number;
  cooling_time_minutes: number;
  bid_open_at: string;
  bid_close_at: string;
  weight_price: number;
  weight_delivery: number;
  weight_payment: number;
}>): Promise<{
  id: string;
  rfq_number: string;
  buyer_id: string;
  status: string;
}> {
  const testDb = getTestDb();
  const id = uuidv4();
  const buyerId = overrides?.buyer_id || uuidv4();
  const year = new Date().getFullYear();

  const existing = await testDb('rfqs')
    .where('rfq_number', 'like', `RFQ-${year}-%`)
    .max('rfq_number as max_number')
    .first();

  let seq = 1;
  if (existing?.max_number) {
    const current = parseInt((existing.max_number as string).split('-')[2], 10);
    if (!isNaN(current)) seq = current + 1;
  }

  const rfqNumber = `RFQ-${year}-${String(seq).padStart(4, '0')}`;

  await testDb('rfqs').insert({
    id,
    rfq_number: rfqNumber,
    buyer_id: buyerId,
    title: overrides?.title || 'Test RFQ',
    status: overrides?.status || 'DRAFT',
    payment_terms: overrides?.payment_terms || null,
    freight_terms: overrides?.freight_terms || null,
    delivery_lead_time_days: overrides?.delivery_lead_time_days || null,
    offer_validity_days: overrides?.offer_validity_days || null,
    max_revisions: overrides?.max_revisions ?? 5,
    min_change_percent: overrides?.min_change_percent ?? 1.0,
    cooling_time_minutes: overrides?.cooling_time_minutes ?? 5,
    bid_open_at: overrides?.bid_open_at || null,
    bid_close_at: overrides?.bid_close_at || null,
    weight_price: overrides?.weight_price ?? 100.0,
    weight_delivery: overrides?.weight_delivery ?? 0.0,
    weight_payment: overrides?.weight_payment ?? 0.0,
  });

  return {
    id,
    rfq_number: rfqNumber,
    buyer_id: buyerId,
    status: overrides?.status || 'DRAFT',
  };
}

// Helper to add items to a test RFQ
export async function createTestRfqItem(
  rfqId: string,
  overrides?: Partial<{
    sl_no: number;
    description: string;
    uom: string;
    quantity: number;
    last_price: number;
  }>,
): Promise<{ id: string }> {
  const testDb = getTestDb();
  const id = uuidv4();
  await testDb('rfq_items').insert({
    id,
    rfq_id: rfqId,
    sl_no: overrides?.sl_no || 1,
    description: overrides?.description || 'Test Item',
    uom: overrides?.uom || 'PCS',
    quantity: overrides?.quantity || 100,
    last_price: overrides?.last_price ?? null,
  });
  return { id };
}

// Helper to assign a supplier to a test RFQ
export async function assignTestSupplier(
  rfqId: string,
  supplierId: string,
  supplierCode: string,
  overrides?: Partial<{
    status: string;
    supplier_delivery_days: number;
    supplier_payment_terms: string;
  }>,
): Promise<{ id: string }> {
  const testDb = getTestDb();
  const id = uuidv4();
  await testDb('rfq_suppliers').insert({
    id,
    rfq_id: rfqId,
    supplier_id: supplierId,
    supplier_code: supplierCode,
    status: overrides?.status || 'PENDING',
    supplier_delivery_days: overrides?.supplier_delivery_days ?? null,
    supplier_payment_terms: overrides?.supplier_payment_terms ?? null,
  });
  return { id };
}

// Helper to create a bid directly in the DB (bypasses service validation)
export async function createTestBid(params: {
  rfq_id: string;
  supplier_id: string;
  supplier_code: string;
  revision_number?: number;
  items: Array<{ rfq_item_id: string; unit_price: number; quantity: number }>;
  is_latest?: boolean;
  submitted_at?: Date;
}): Promise<{ id: string; total_price: number; submission_hash: string }> {
  const testDb = getTestDb();
  const bidId = uuidv4();
  const revisionNumber = params.revision_number ?? 0;
  const submittedAt = params.submitted_at || new Date();
  const isLatest = params.is_latest !== undefined ? params.is_latest : true;

  // Calculate total price server-side
  let totalPrice = 0;
  const bidItems = params.items.map((item) => {
    const itemTotal = item.unit_price * item.quantity;
    totalPrice += itemTotal;
    return {
      id: uuidv4(),
      bid_id: bidId,
      rfq_item_id: item.rfq_item_id,
      unit_price: item.unit_price,
      total_price: itemTotal,
    };
  });

  // Compute hash
  const submissionHash = computeBidHash({
    supplierCode: params.supplier_code,
    rfqId: params.rfq_id,
    revisionNumber,
    items: params.items.map((i) => ({
      rfqItemId: i.rfq_item_id,
      unitPrice: i.unit_price,
    })),
    submittedAt: submittedAt.toISOString(),
  });

  // Insert bid
  await testDb('bids').insert({
    id: bidId,
    rfq_id: params.rfq_id,
    supplier_id: params.supplier_id,
    supplier_code: params.supplier_code,
    revision_number: revisionNumber,
    submitted_at: submittedAt,
    total_price: totalPrice,
    submission_hash: submissionHash,
    is_latest: isLatest,
  });

  // Insert bid items
  if (bidItems.length > 0) {
    await testDb('bid_items').insert(bidItems);
  }

  return { id: bidId, total_price: totalPrice, submission_hash: submissionHash };
}

export { app };

// Helper to seed flag-related system config values (needed after cleanDatabase truncates system_config)
export async function seedFlagConfig(overrides?: Partial<{
  flag_delivery_deviation_threshold: string;
  flag_abnormal_low_price_threshold: string;
  flag_supplier_dominance_threshold: string;
  flag_late_revision_count: string;
  flag_late_revision_window_percent: string;
}>): Promise<void> {
  const testDb = getTestDb();
  const configs = [
    {
      key: 'flag_delivery_deviation_threshold',
      value: overrides?.flag_delivery_deviation_threshold || '20',
      description: 'Percentage threshold for delivery deviation risk flag (FLAG-01)',
    },
    {
      key: 'flag_abnormal_low_price_threshold',
      value: overrides?.flag_abnormal_low_price_threshold || '40',
      description: 'Percentage below average threshold for abnormally low price flag (FLAG-03)',
    },
    {
      key: 'flag_supplier_dominance_threshold',
      value: overrides?.flag_supplier_dominance_threshold || '80',
      description: 'Percentage of L1 positions for supplier dominance flag (FLAG-04)',
    },
    {
      key: 'flag_late_revision_count',
      value: overrides?.flag_late_revision_count || '3',
      description: 'Number of late revisions to trigger excessive late revisions flag (FLAG-05)',
    },
    {
      key: 'flag_late_revision_window_percent',
      value: overrides?.flag_late_revision_window_percent || '20',
      description: 'Percentage of bid window considered late for FLAG-05',
    },
  ];

  for (const config of configs) {
    await testDb.raw(
      `INSERT INTO system_config (key, value, description)
       VALUES (?, ?, ?)
       ON CONFLICT (key) DO NOTHING`,
      [config.key, config.value, config.description],
    );
  }
}

// Helper to create a test negotiation directly in the DB
export async function createTestNegotiation(overrides?: Partial<{
  parent_rfq_id: string;
  buyer_id: string;
  status: string;
  max_revisions: number;
  min_change_percent: number;
  cooling_time_minutes: number;
  bid_open_at: string;
  bid_close_at: string;
  anti_snipe_window_minutes: number;
  anti_snipe_extension_minutes: number;
}>): Promise<{
  id: string;
  parent_rfq_id: string;
  buyer_id: string;
  status: string;
}> {
  const testDb = getTestDb();
  const id = uuidv4();

  await testDb('negotiation_events').insert({
    id,
    parent_rfq_id: overrides?.parent_rfq_id || uuidv4(),
    buyer_id: overrides?.buyer_id || uuidv4(),
    status: overrides?.status || 'DRAFT',
    max_revisions: overrides?.max_revisions ?? 5,
    min_change_percent: overrides?.min_change_percent ?? 1.0,
    cooling_time_minutes: overrides?.cooling_time_minutes ?? 5,
    bid_open_at: overrides?.bid_open_at || null,
    bid_close_at: overrides?.bid_close_at || null,
    anti_snipe_window_minutes: overrides?.anti_snipe_window_minutes ?? 10,
    anti_snipe_extension_minutes: overrides?.anti_snipe_extension_minutes ?? 5,
  });

  return {
    id,
    parent_rfq_id: overrides?.parent_rfq_id || '',
    buyer_id: overrides?.buyer_id || '',
    status: overrides?.status || 'DRAFT',
  };
}

// Helper to add a supplier to a test negotiation
export async function addNegotiationSupplier(
  negotiationId: string,
  supplierId: string,
  supplierCode: string,
  overrides?: Partial<{ status: string }>,
): Promise<{ id: string }> {
  const testDb = getTestDb();
  const id = uuidv4();
  await testDb('negotiation_suppliers').insert({
    id,
    negotiation_id: negotiationId,
    supplier_id: supplierId,
    supplier_code: supplierCode,
    status: overrides?.status || 'ACCEPTED',
  });
  return { id };
}

// Helper to create a bid for a negotiation directly in the DB
export async function createTestNegotiationBid(params: {
  negotiation_id: string;
  rfq_id: string;
  supplier_id: string;
  supplier_code: string;
  revision_number?: number;
  items: Array<{ rfq_item_id: string; unit_price: number; quantity: number }>;
  is_latest?: boolean;
  submitted_at?: Date;
}): Promise<{ id: string; total_price: number; submission_hash: string }> {
  const testDb = getTestDb();
  const bidId = uuidv4();
  const revisionNumber = params.revision_number ?? 0;
  const submittedAt = params.submitted_at || new Date();
  const isLatest = params.is_latest !== undefined ? params.is_latest : true;

  let totalPrice = 0;
  const bidItems = params.items.map((item) => {
    const itemTotal = item.unit_price * item.quantity;
    totalPrice += itemTotal;
    return {
      id: uuidv4(),
      bid_id: bidId,
      rfq_item_id: item.rfq_item_id,
      unit_price: item.unit_price,
      total_price: itemTotal,
    };
  });

  const submissionHash = computeBidHash({
    supplierCode: params.supplier_code,
    rfqId: params.rfq_id,
    revisionNumber,
    items: params.items.map((i) => ({
      rfqItemId: i.rfq_item_id,
      unitPrice: i.unit_price,
    })),
    submittedAt: submittedAt.toISOString(),
    negotiationId: params.negotiation_id,
  });

  await testDb('bids').insert({
    id: bidId,
    rfq_id: params.rfq_id,
    negotiation_id: params.negotiation_id,
    supplier_id: params.supplier_id,
    supplier_code: params.supplier_code,
    revision_number: revisionNumber,
    submitted_at: submittedAt,
    total_price: totalPrice,
    submission_hash: submissionHash,
    is_latest: isLatest,
  });

  if (bidItems.length > 0) {
    await testDb('bid_items').insert(bidItems);
  }

  return { id: bidId, total_price: totalPrice, submission_hash: submissionHash };
}
