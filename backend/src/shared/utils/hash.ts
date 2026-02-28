import crypto from 'crypto';

const GENESIS_HASH = crypto.createHash('sha256').update('GENESIS').digest('hex');

export function computeSHA256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Canonical JSON stringify with sorted keys.
 * Ensures deterministic output regardless of object key insertion order.
 * Required because PostgreSQL JSONB does not preserve key order.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const parts = sortedKeys.map(
    (key) => JSON.stringify(key) + ':' + canonicalStringify(obj[key]),
  );
  return '{' + parts.join(',') + '}';
}

export function computeAuditChainHash(
  eventData: Record<string, unknown>,
  previousHash: string | null,
): string {
  const hashInput = canonicalStringify(eventData) + (previousHash || GENESIS_HASH);
  return computeSHA256(hashInput);
}

export function computeBidHash(params: {
  supplierCode: string;
  rfqId: string;
  revisionNumber: number;
  items: Array<{ rfqItemId: string; unitPrice: number }>;
  submittedAt: string;
  negotiationId?: string;
}): string {
  const canonical = JSON.stringify({
    supplier_code: params.supplierCode,
    rfq_id: params.rfqId,
    revision_number: params.revisionNumber,
    items: params.items.map((i) => ({
      rfq_item_id: i.rfqItemId,
      unit_price: i.unitPrice,
    })),
    submitted_at: params.submittedAt,
    ...(params.negotiationId ? { negotiation_id: params.negotiationId } : {}),
  });
  return computeSHA256(canonical);
}

export function getGenesisHash(): string {
  return GENESIS_HASH;
}
