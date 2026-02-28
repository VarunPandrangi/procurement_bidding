import { getDb } from '../../config/database';
import { AuditEventType } from '../../shared/types/enums';

// ── Pure functions (exported for unit testing) ──

/**
 * Calculate coefficient of variation from an array of prices.
 * Returns CV as a percentage (std_dev / mean * 100).
 */
export function calculateCV(prices: number[]): number | null {
  if (prices.length < 2) return null;

  const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  if (mean === 0) return null;

  const squaredDiffs = prices.map((p) => (p - mean) ** 2);
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / prices.length;
  const stdDev = Math.sqrt(variance);

  return (stdDev / mean) * 100;
}

/**
 * Calculate savings percentage: (reference - awarded) / reference * 100.
 */
export function calculateSavingsPct(
  items: Array<{ last_price: number; quantity: number; awarded_unit_price: number }>,
): number | null {
  if (items.length === 0) return null;

  let referenceTotal = 0;
  let awardedTotal = 0;

  for (const item of items) {
    referenceTotal += item.last_price * item.quantity;
    awardedTotal += item.awarded_unit_price * item.quantity;
  }

  if (referenceTotal === 0) return null;

  return ((referenceTotal - awardedTotal) / referenceTotal) * 100;
}

/**
 * Calculate participation ratio: accepted / assigned * 100.
 */
export function calculateParticipationRatio(
  accepted: number,
  assigned: number,
): number | null {
  if (assigned === 0) return null;
  return (accepted / assigned) * 100;
}

/**
 * Calculate cycle time in hours from two dates.
 */
export function calculateCycleTimeHours(
  publishedAt: Date,
  awardedAt: Date,
): number {
  const diffMs = awardedAt.getTime() - publishedAt.getTime();
  return diffMs / (1000 * 60 * 60);
}

// ── DB orchestrators ──

interface KpiFilters {
  buyerId?: string;
  from?: Date;
  to?: Date;
}

/**
 * Average cycle time (hours) from RFQ_PUBLISHED to AWARD_FINALIZED.
 */
export async function rfqCycleTimeHours(
  filters?: KpiFilters,
): Promise<{ value: number | null; count: number }> {
  const db = getDb();

  // Get published events
  let publishedQuery = db('audit_log as al')
    .where('al.event_type', AuditEventType.RFQ_PUBLISHED)
    .select('al.rfq_id', 'al.created_at as published_at');

  if (filters?.buyerId) {
    publishedQuery = publishedQuery
      .join('rfqs', 'al.rfq_id', 'rfqs.id')
      .where('rfqs.buyer_id', filters.buyerId);
  }

  if (filters?.from) {
    publishedQuery = publishedQuery.where('al.created_at', '>=', filters.from);
  }
  if (filters?.to) {
    publishedQuery = publishedQuery.where('al.created_at', '<=', filters.to);
  }

  const publishedEvents = await publishedQuery;

  if (publishedEvents.length === 0) {
    return { value: null, count: 0 };
  }

  const rfqIds = publishedEvents.map((e: Record<string, unknown>) => e.rfq_id as string);

  // Get award events for those same RFQs
  const awardEvents = await db('audit_log')
    .where('event_type', AuditEventType.AWARD_FINALIZED)
    .whereIn('rfq_id', rfqIds)
    .select('rfq_id', 'created_at as awarded_at');

  const awardMap = new Map<string, Date>();
  for (const a of awardEvents) {
    awardMap.set(a.rfq_id as string, new Date(a.awarded_at as string));
  }

  let totalHours = 0;
  let count = 0;

  for (const p of publishedEvents) {
    const awardedAt = awardMap.get(p.rfq_id as string);
    if (awardedAt) {
      const publishedAt = new Date(p.published_at as string);
      totalHours += calculateCycleTimeHours(publishedAt, awardedAt);
      count++;
    }
  }

  if (count === 0) {
    return { value: null, count: 0 };
  }

  return {
    value: parseFloat((totalHours / count).toFixed(2)),
    count,
  };
}

/**
 * Average savings vs last_price for AWARDED RFQs.
 */
export async function savingsVsLastPrice(
  filters?: KpiFilters,
): Promise<number | null> {
  const db = getDb();

  // Find AWARDED RFQs
  let rfqQuery = db('rfqs').where('status', 'AWARDED');
  if (filters?.buyerId) {
    rfqQuery = rfqQuery.where('buyer_id', filters.buyerId);
  }
  if (filters?.from) {
    rfqQuery = rfqQuery.where('created_at', '>=', filters.from);
  }
  if (filters?.to) {
    rfqQuery = rfqQuery.where('created_at', '<=', filters.to);
  }

  const rfqs = await rfqQuery.select('id');

  if (rfqs.length === 0) return null;

  const savingsValues: number[] = [];

  for (const rfq of rfqs) {
    const rfqId = rfq.id as string;

    // Get items with last_price set
    const itemsWithLastPrice = await db('rfq_items')
      .where('rfq_id', rfqId)
      .whereNotNull('last_price')
      .select('id', 'last_price', 'quantity');

    if (itemsWithLastPrice.length === 0) continue;

    // Get award allocations from audit log
    const awardEntry = await db('audit_log')
      .where({ rfq_id: rfqId, event_type: AuditEventType.AWARD_FINALIZED })
      .select('event_data')
      .first();

    if (!awardEntry) continue;

    const eventData = typeof awardEntry.event_data === 'string'
      ? JSON.parse(awardEntry.event_data)
      : awardEntry.event_data;

    const allocations = eventData.allocations as Array<{ supplier_id: string; item_ids?: string[] }> | undefined;
    if (!allocations || allocations.length === 0) continue;

    // For single award: one supplier awarded all items
    // For split award: supplier_id + item_ids
    const itemPriceMap = new Map<string, number>();

    for (const alloc of allocations) {
      // Get supplier's latest bid items
      const latestBid = await db('bids')
        .where({ rfq_id: rfqId, supplier_id: alloc.supplier_id, is_latest: true })
        .first();

      if (!latestBid) continue;

      const bidItems = await db('bid_items')
        .where('bid_id', latestBid.id)
        .select('rfq_item_id', 'unit_price');

      for (const bi of bidItems) {
        // For split awards, only count items assigned to this supplier
        if (alloc.item_ids && alloc.item_ids.length > 0) {
          if (alloc.item_ids.includes(bi.rfq_item_id)) {
            itemPriceMap.set(bi.rfq_item_id as string, parseFloat(bi.unit_price as string));
          }
        } else {
          // Single award — all items from this supplier
          itemPriceMap.set(bi.rfq_item_id as string, parseFloat(bi.unit_price as string));
        }
      }
    }

    // Calculate savings for items that have both last_price and awarded price
    const savingsItems: Array<{ last_price: number; quantity: number; awarded_unit_price: number }> = [];

    for (const item of itemsWithLastPrice) {
      const awardedPrice = itemPriceMap.get(item.id as string);
      if (awardedPrice !== undefined) {
        savingsItems.push({
          last_price: parseFloat(item.last_price as string),
          quantity: parseFloat(item.quantity as string),
          awarded_unit_price: awardedPrice,
        });
      }
    }

    const savings = calculateSavingsPct(savingsItems);
    if (savings !== null) {
      savingsValues.push(savings);
    }
  }

  if (savingsValues.length === 0) return null;

  const avg = savingsValues.reduce((sum, v) => sum + v, 0) / savingsValues.length;
  return parseFloat(avg.toFixed(2));
}

/**
 * Average participation ratio (accepted/assigned) across qualifying RFQs.
 */
export async function participationRatio(
  filters?: KpiFilters,
): Promise<number | null> {
  const db = getDb();

  // RFQs that are PUBLISHED or beyond
  let rfqQuery = db('rfqs').whereIn('status', ['PUBLISHED', 'ACTIVE', 'CLOSED', 'AWARDED']);
  if (filters?.buyerId) {
    rfqQuery = rfqQuery.where('buyer_id', filters.buyerId);
  }
  if (filters?.from) {
    rfqQuery = rfqQuery.where('created_at', '>=', filters.from);
  }
  if (filters?.to) {
    rfqQuery = rfqQuery.where('created_at', '<=', filters.to);
  }

  const rfqs = await rfqQuery.select('id');

  if (rfqs.length === 0) return null;

  const ratios: number[] = [];

  for (const rfq of rfqs) {
    const rfqId = rfq.id as string;

    const counts = await db('rfq_suppliers')
      .where('rfq_id', rfqId)
      .select(
        db.raw('COUNT(*) as assigned'),
        db.raw("COUNT(*) FILTER (WHERE status = 'ACCEPTED') as accepted"),
      )
      .first();

    const assigned = parseInt(counts.assigned as string, 10);
    const accepted = parseInt(counts.accepted as string, 10);

    const ratio = calculateParticipationRatio(accepted, assigned);
    if (ratio !== null) {
      ratios.push(ratio);
    }
  }

  if (ratios.length === 0) return null;

  const avg = ratios.reduce((sum, v) => sum + v, 0) / ratios.length;
  return parseFloat(avg.toFixed(2));
}

/**
 * Average price convergence (coefficient of variation) across CLOSED/AWARDED RFQs.
 */
export async function priceConvergenceCV(
  filters?: KpiFilters,
): Promise<number | null> {
  const db = getDb();

  let rfqQuery = db('rfqs').whereIn('status', ['CLOSED', 'AWARDED']);
  if (filters?.buyerId) {
    rfqQuery = rfqQuery.where('buyer_id', filters.buyerId);
  }
  if (filters?.from) {
    rfqQuery = rfqQuery.where('created_at', '>=', filters.from);
  }
  if (filters?.to) {
    rfqQuery = rfqQuery.where('created_at', '<=', filters.to);
  }

  const rfqs = await rfqQuery.select('id');

  if (rfqs.length === 0) return null;

  const cvValues: number[] = [];

  for (const rfq of rfqs) {
    const rfqId = rfq.id as string;

    const latestBids = await db('bids')
      .where({ rfq_id: rfqId, is_latest: true })
      .select('total_price');

    const prices = latestBids.map((b: Record<string, unknown>) =>
      parseFloat(b.total_price as string),
    );

    const cv = calculateCV(prices);
    if (cv !== null) {
      cvValues.push(cv);
    }
  }

  if (cvValues.length === 0) return null;

  const avg = cvValues.reduce((sum, v) => sum + v, 0) / cvValues.length;
  return parseFloat(avg.toFixed(2));
}

/**
 * Supplier competitiveness index.
 * For each supplier: (count RFQs where they were L1) / (count RFQs where they bid) * 100.
 * Returns top 10 sorted descending.
 */
export async function supplierCompetitivenessIndex(): Promise<
  Array<{ supplier_code: string; index_pct: number }>
> {
  const db = getDb();

  // Get all latest bids in CLOSED/AWARDED RFQs
  const latestBids = await db('bids')
    .join('rfqs', 'bids.rfq_id', 'rfqs.id')
    .where('bids.is_latest', true)
    .whereIn('rfqs.status', ['CLOSED', 'AWARDED'])
    .select('bids.rfq_id', 'bids.supplier_id', 'bids.supplier_code', 'bids.total_price');

  if (latestBids.length === 0) return [];

  // Group by RFQ to find L1 per RFQ
  const rfqBids = new Map<string, Array<{ supplier_id: string; supplier_code: string; total_price: number }>>();

  for (const bid of latestBids) {
    const rfqId = bid.rfq_id as string;
    if (!rfqBids.has(rfqId)) {
      rfqBids.set(rfqId, []);
    }
    rfqBids.get(rfqId)!.push({
      supplier_id: bid.supplier_id as string,
      supplier_code: bid.supplier_code as string,
      total_price: parseFloat(bid.total_price as string),
    });
  }

  // Count per supplier: submitted and L1
  const supplierStats = new Map<string, { supplier_code: string; submitted: number; l1: number }>();

  for (const [, bids] of rfqBids.entries()) {
    // Find L1 (lowest total_price)
    const minPrice = Math.min(...bids.map((b) => b.total_price));

    for (const bid of bids) {
      if (!supplierStats.has(bid.supplier_id)) {
        supplierStats.set(bid.supplier_id, {
          supplier_code: bid.supplier_code,
          submitted: 0,
          l1: 0,
        });
      }
      const stats = supplierStats.get(bid.supplier_id)!;
      stats.submitted++;
      if (bid.total_price === minPrice) {
        stats.l1++;
      }
    }
  }

  // Calculate index and sort
  const results = Array.from(supplierStats.values())
    .map((s) => ({
      supplier_code: s.supplier_code,
      index_pct: parseFloat(((s.l1 / s.submitted) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.index_pct - a.index_pct)
    .slice(0, 10);

  return results;
}

/**
 * Count qualifying RFQs for a buyer (or all if no buyerId).
 */
export async function rfqCount(filters?: KpiFilters): Promise<number> {
  const db = getDb();

  let query = db('rfqs').whereIn('status', ['PUBLISHED', 'ACTIVE', 'CLOSED', 'AWARDED']);
  if (filters?.buyerId) {
    query = query.where('buyer_id', filters.buyerId);
  }
  if (filters?.from) {
    query = query.where('created_at', '>=', filters.from);
  }
  if (filters?.to) {
    query = query.where('created_at', '<=', filters.to);
  }

  const result = await query.count('id as count').first();
  return parseInt(result?.count as string || '0', 10);
}
