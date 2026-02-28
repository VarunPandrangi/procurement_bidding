import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../config/database';
import { AuditEventType, ActorType } from '../../shared/types/enums';
import { computeAuditChainHash } from '../../shared/utils/hash';
import { logger } from '../../config/logger';

interface CreateAuditEntryParams {
  rfqId?: string | null;
  eventType: AuditEventType;
  actorType: ActorType;
  actorId?: string | null;
  actorCode?: string | null;
  eventData: Record<string, unknown>;
}

export async function createAuditEntry(
  params: CreateAuditEntryParams,
  trx?: Knex,
): Promise<string> {
  const db = trx || getDb();
  const id = uuidv4();

  // Get the last audit entry's hash for chain integrity
  const lastEntry = await db('audit_log')
    .select('event_hash')
    .orderBy('created_at', 'desc')
    .first();

  const previousHash = lastEntry?.event_hash || null;
  const eventHash = computeAuditChainHash(params.eventData, previousHash);

  const entry = {
    id,
    rfq_id: params.rfqId || null,
    event_type: params.eventType,
    actor_type: params.actorType,
    actor_id: params.actorId || null,
    actor_code: params.actorCode || null,
    event_data: JSON.stringify(params.eventData),
    event_hash: eventHash,
    created_at: new Date(),
  };

  await db('audit_log').insert(entry);

  logger.info('Audit entry created', {
    id,
    eventType: params.eventType,
    actorType: params.actorType,
    rfqId: params.rfqId,
  });

  return id;
}

export async function getAuditEntries(filters?: {
  rfqId?: string;
  eventType?: AuditEventType;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}): Promise<{ entries: Record<string, unknown>[]; total: number }> {
  const db = getDb();
  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const offset = (page - 1) * limit;

  let query = db('audit_log');
  let countQuery = db('audit_log');

  if (filters?.rfqId) {
    query = query.where('rfq_id', filters.rfqId);
    countQuery = countQuery.where('rfq_id', filters.rfqId);
  }

  if (filters?.eventType) {
    query = query.where('event_type', filters.eventType);
    countQuery = countQuery.where('event_type', filters.eventType);
  }

  if (filters?.startDate) {
    query = query.where('created_at', '>=', filters.startDate);
    countQuery = countQuery.where('created_at', '>=', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.where('created_at', '<=', filters.endDate);
    countQuery = countQuery.where('created_at', '<=', filters.endDate);
  }

  const [entries, [{ count }]] = await Promise.all([
    query.orderBy('created_at', 'desc').offset(offset).limit(limit),
    countQuery.count('id as count'),
  ]);

  return {
    entries,
    total: parseInt(count as string, 10),
  };
}

export async function verifyAuditChain(rfqId?: string): Promise<{
  valid: boolean;
  brokenAt?: number;
  totalEntries: number;
}> {
  const db = getDb();

  let query = db('audit_log').orderBy('created_at', 'asc');
  if (rfqId) {
    query = query.where('rfq_id', rfqId);
  }

  const entries = await query;

  if (entries.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const previousHash = i > 0 ? entries[i - 1].event_hash : null;
    const eventData =
      typeof entry.event_data === 'string' ? JSON.parse(entry.event_data) : entry.event_data;
    const expectedHash = computeAuditChainHash(eventData, previousHash);

    if (expectedHash !== entry.event_hash) {
      return { valid: false, brokenAt: i, totalEntries: entries.length };
    }
  }

  return { valid: true, totalEntries: entries.length };
}
