import { getDb } from '../../config/database';
import { FlagType } from '../../shared/types/enums';
import { calculateItemRankings } from '../ranking/ranking.service';
import { logger } from '../../config/logger';

// ── Types ──

interface FlagResult {
  flag_id: string;
  flag_type: string;
  affected_supplier_code: string | null;
  affected_item_ids: string[] | null;
  detail_text: string;
  recommendation_text: string;
}

// ── Pure evaluation functions (exported for unit testing) ──

export function evaluateDeliveryDeviation(
  supplierDeliveryDays: number | null,
  rfqDeliveryDays: number | null,
  thresholdPct: number,
): FlagResult | null {
  if (supplierDeliveryDays === null || supplierDeliveryDays === undefined) return null;
  if (rfqDeliveryDays === null || rfqDeliveryDays === undefined) return null;
  if (rfqDeliveryDays <= 0) return null;

  const maxAllowed = rfqDeliveryDays * (1 + thresholdPct / 100);

  if (supplierDeliveryDays >= maxAllowed) {
    return {
      flag_id: 'FLAG-01',
      flag_type: FlagType.DELIVERY_DEVIATION,
      affected_supplier_code: null, // set by caller
      affected_item_ids: null,
      detail_text: `Supplier stated delivery of ${supplierDeliveryDays} days exceeds RFQ target of ${rfqDeliveryDays} days by ${thresholdPct}% or more (max allowed: ${maxAllowed} days).`,
      recommendation_text: 'Review supplier delivery capability. Consider negotiating delivery terms or selecting an alternative supplier with shorter lead time.',
    };
  }

  return null;
}

export function evaluatePaymentDeviation(
  supplierPaymentTerms: string | null,
  rfqPaymentTerms: string | null,
): FlagResult | null {
  if (!supplierPaymentTerms || !rfqPaymentTerms) return null;

  const supplierNormalized = supplierPaymentTerms.trim().toLowerCase();
  const rfqNormalized = rfqPaymentTerms.trim().toLowerCase();

  if (supplierNormalized !== rfqNormalized) {
    return {
      flag_id: 'FLAG-02',
      flag_type: FlagType.PAYMENT_DEVIATION,
      affected_supplier_code: null, // set by caller
      affected_item_ids: null,
      detail_text: `Supplier payment terms "${supplierPaymentTerms.trim()}" do not match RFQ payment terms "${rfqPaymentTerms.trim()}".`,
      recommendation_text: 'Verify payment terms alignment with supplier. Mismatched terms may affect cash flow and contract compliance.',
    };
  }

  return null;
}

export function evaluateAbnormalPrice(
  itemBids: Array<{
    rfq_item_id: string;
    supplier_code: string;
    unit_price: number;
  }>,
  thresholdPct: number,
): FlagResult[] {
  const flags: FlagResult[] = [];

  // Group bids by item
  const bidsByItem = new Map<string, Array<{ supplier_code: string; unit_price: number }>>();
  for (const bid of itemBids) {
    const existing = bidsByItem.get(bid.rfq_item_id) || [];
    existing.push({ supplier_code: bid.supplier_code, unit_price: bid.unit_price });
    bidsByItem.set(bid.rfq_item_id, existing);
  }

  for (const [itemId, bids] of bidsByItem.entries()) {
    // Single bidder → no meaningful average → skip
    if (bids.length < 2) continue;

    const average = bids.reduce((sum, b) => sum + b.unit_price, 0) / bids.length;
    const lowerBound = average * (1 - thresholdPct / 100);

    // Use epsilon for floating-point tolerance (e.g. 250/3 * 0.6 = 49.9999... not 50)
    const EPSILON = 1e-9;

    for (const bid of bids) {
      if (bid.unit_price <= lowerBound + EPSILON) {
        flags.push({
          flag_id: 'FLAG-03',
          flag_type: FlagType.ABNORMAL_PRICE,
          affected_supplier_code: bid.supplier_code,
          affected_item_ids: [itemId],
          detail_text: `Supplier ${bid.supplier_code} unit price ${bid.unit_price} for item is ${thresholdPct}% or more below the average price of ${average.toFixed(2)}.`,
          recommendation_text: 'Investigate abnormally low price. This may indicate an error, unsustainable pricing, or quality concerns.',
        });
      }
    }
  }

  return flags;
}

export function evaluateSupplierDominance(
  itemRankings: Array<{
    rfq_item_id: string;
    rankings: Array<{ supplier_code: string; rank: number }>;
  }>,
  totalItemCount: number,
  thresholdPct: number,
): FlagResult[] {
  if (totalItemCount === 0) return [];

  // Count L1 positions per supplier
  const l1Counts = new Map<string, number>();

  for (const item of itemRankings) {
    // Find L1 suppliers (rank === 1) for this item
    const l1Suppliers = item.rankings.filter((r) => r.rank === 1);
    for (const l1 of l1Suppliers) {
      l1Counts.set(l1.supplier_code, (l1Counts.get(l1.supplier_code) || 0) + 1);
    }
  }

  const flags: FlagResult[] = [];
  const threshold = thresholdPct / 100;

  for (const [supplierCode, count] of l1Counts.entries()) {
    if (count / totalItemCount >= threshold) {
      const percentage = ((count / totalItemCount) * 100).toFixed(1);
      flags.push({
        flag_id: 'FLAG-04',
        flag_type: FlagType.SUPPLIER_DOMINANCE,
        affected_supplier_code: supplierCode,
        affected_item_ids: null,
        detail_text: `Supplier ${supplierCode} is L1 in ${count} of ${totalItemCount} items (${percentage}%), exceeding the dominance threshold of ${thresholdPct}%.`,
        recommendation_text: 'Consider diversifying supplier allocation to reduce dependency on a single supplier. Review total cost of ownership and supply chain risk.',
      });
    }
  }

  return flags;
}

export function evaluateLateRevisions(
  supplierBids: Array<{
    supplier_code: string;
    submitted_at: Date;
  }>,
  bidOpenAt: Date,
  bidCloseAt: Date,
  countThreshold: number,
  windowPct: number,
): FlagResult[] {
  const windowDurationMs = bidCloseAt.getTime() - bidOpenAt.getTime();
  if (windowDurationMs <= 0) return [];

  const windowDurationMinutes = windowDurationMs / (60 * 1000);
  const lateWindowMinutes = windowDurationMinutes * (windowPct / 100);
  const lateStart = new Date(bidCloseAt.getTime() - lateWindowMinutes * 60 * 1000);

  // Count late bids per supplier
  const lateCounts = new Map<string, number>();
  for (const bid of supplierBids) {
    if (bid.submitted_at > lateStart) {
      lateCounts.set(bid.supplier_code, (lateCounts.get(bid.supplier_code) || 0) + 1);
    }
  }

  const flags: FlagResult[] = [];

  for (const [supplierCode, count] of lateCounts.entries()) {
    // Strict greater than per spec: "If count > flag_late_revision_count"
    if (count > countThreshold) {
      flags.push({
        flag_id: 'FLAG-05',
        flag_type: FlagType.LATE_REVISIONS,
        affected_supplier_code: supplierCode,
        affected_item_ids: null,
        detail_text: `Supplier ${supplierCode} submitted ${count} revisions in the final ${windowPct}% of the bidding window (threshold: ${countThreshold}).`,
        recommendation_text: 'Excessive late revisions may indicate strategic bidding behavior. Review bid history and consider adjusting anti-snipe or revision rules.',
      });
    }
  }

  return flags;
}

// ── Config loader ──

async function loadFlagThresholds(): Promise<{
  deliveryDeviationPct: number;
  abnormalPricePct: number;
  dominancePct: number;
  lateRevisionCount: number;
  lateRevisionWindowPct: number;
}> {
  const db = getDb();
  const defaults = {
    flag_delivery_deviation_threshold: '20',
    flag_abnormal_low_price_threshold: '40',
    flag_supplier_dominance_threshold: '80',
    flag_late_revision_count: '3',
    flag_late_revision_window_percent: '20',
  };

  const keys = Object.keys(defaults);
  const rows = await db('system_config').whereIn('key', keys).select('key', 'value');
  const configMap = new Map(rows.map((r: { key: string; value: string }) => [r.key, r.value]));

  return {
    deliveryDeviationPct: parseFloat(
      configMap.get('flag_delivery_deviation_threshold') || defaults.flag_delivery_deviation_threshold,
    ),
    abnormalPricePct: parseFloat(
      configMap.get('flag_abnormal_low_price_threshold') || defaults.flag_abnormal_low_price_threshold,
    ),
    dominancePct: parseFloat(
      configMap.get('flag_supplier_dominance_threshold') || defaults.flag_supplier_dominance_threshold,
    ),
    lateRevisionCount: parseInt(
      configMap.get('flag_late_revision_count') || defaults.flag_late_revision_count,
      10,
    ),
    lateRevisionWindowPct: parseFloat(
      configMap.get('flag_late_revision_window_percent') || defaults.flag_late_revision_window_percent,
    ),
  };
}

// ── Main orchestrator (DB-dependent) ──

export async function evaluateFlags(rfqId: string): Promise<void> {
  const db = getDb();

  // 1. Load RFQ
  const rfq = await db('rfqs')
    .where('id', rfqId)
    .select(
      'id',
      'delivery_lead_time_days',
      'payment_terms',
      'bid_open_at',
      'bid_close_at',
    )
    .first();

  if (!rfq) {
    logger.warn('Flag evaluation: RFQ not found', { rfqId });
    return;
  }

  // 2. Load thresholds from system_config
  const thresholds = await loadFlagThresholds();

  // 3. Load accepted suppliers with their delivery/payment data
  const suppliers = await db('rfq_suppliers')
    .where({ rfq_id: rfqId, status: 'ACCEPTED' })
    .select('supplier_id', 'supplier_code', 'supplier_delivery_days', 'supplier_payment_terms');

  // 4. Load all latest bids with bid_items (for FLAG-03 and FLAG-04)
  const latestBidItems = await db('bids')
    .join('bid_items', 'bids.id', 'bid_items.bid_id')
    .where({ 'bids.rfq_id': rfqId, 'bids.is_latest': true })
    .select(
      'bids.supplier_code',
      'bids.supplier_id',
      'bid_items.rfq_item_id',
      'bid_items.unit_price',
      'bid_items.total_price',
    );

  // 5. Load ALL bids for this RFQ (for FLAG-05 — late revision counting)
  const allBids = await db('bids')
    .where('rfq_id', rfqId)
    .select('supplier_code', 'submitted_at');

  // 6. Load RFQ item IDs for ranking calculation
  const rfqItems = await db('rfq_items')
    .where('rfq_id', rfqId)
    .orderBy('sl_no')
    .select('id');

  const rfqItemIds = rfqItems.map((i: { id: string }) => i.id);

  // Parse bid data for ranking
  const parsedBidData = latestBidItems.map((row: Record<string, unknown>) => ({
    supplier_id: row.supplier_id as string,
    supplier_code: row.supplier_code as string,
    rfq_item_id: row.rfq_item_id as string,
    unit_price: parseFloat(row.unit_price as string),
    total_price: parseFloat(row.total_price as string),
  }));

  // Calculate item rankings for FLAG-04
  const itemRankings = calculateItemRankings(parsedBidData, rfqItemIds);

  // ── Run all 5 flag evaluations ──

  const allFlags: FlagResult[] = [];

  // FLAG-01 & FLAG-02: Per-supplier checks
  for (const supplier of suppliers) {
    // FLAG-01: Delivery Deviation
    const deliveryFlag = evaluateDeliveryDeviation(
      supplier.supplier_delivery_days,
      rfq.delivery_lead_time_days,
      thresholds.deliveryDeviationPct,
    );
    if (deliveryFlag) {
      deliveryFlag.affected_supplier_code = supplier.supplier_code;
      allFlags.push(deliveryFlag);
    }

    // FLAG-02: Payment Deviation
    const paymentFlag = evaluatePaymentDeviation(
      supplier.supplier_payment_terms,
      rfq.payment_terms,
    );
    if (paymentFlag) {
      paymentFlag.affected_supplier_code = supplier.supplier_code;
      allFlags.push(paymentFlag);
    }
  }

  // FLAG-03: Abnormal Price
  const abnormalPriceFlags = evaluateAbnormalPrice(
    parsedBidData.map((b) => ({
      rfq_item_id: b.rfq_item_id,
      supplier_code: b.supplier_code,
      unit_price: b.unit_price,
    })),
    thresholds.abnormalPricePct,
  );
  allFlags.push(...abnormalPriceFlags);

  // FLAG-04: Supplier Dominance
  const dominanceFlags = evaluateSupplierDominance(
    itemRankings,
    rfqItemIds.length,
    thresholds.dominancePct,
  );
  allFlags.push(...dominanceFlags);

  // FLAG-05: Late Revisions
  if (rfq.bid_open_at && rfq.bid_close_at) {
    const lateRevisionFlags = evaluateLateRevisions(
      allBids.map((b: Record<string, unknown>) => ({
        supplier_code: b.supplier_code as string,
        submitted_at: new Date(b.submitted_at as string),
      })),
      new Date(rfq.bid_open_at),
      new Date(rfq.bid_close_at),
      thresholds.lateRevisionCount,
      thresholds.lateRevisionWindowPct,
    );
    allFlags.push(...lateRevisionFlags);
  }

  // 8. Transaction: deactivate old flags, insert new ones
  const trx = await db.transaction();
  try {
    // Deactivate all previous flags for this RFQ
    await trx('rfq_flags')
      .where({ rfq_id: rfqId, is_active: true })
      .update({ is_active: false });

    // Insert new active flags
    if (allFlags.length > 0) {
      const flagRows = allFlags.map((flag) => ({
        rfq_id: rfqId,
        flag_id: flag.flag_id,
        flag_type: flag.flag_type,
        affected_supplier_code: flag.affected_supplier_code,
        affected_item_ids: flag.affected_item_ids
          ? `{${flag.affected_item_ids.join(',')}}`
          : null,
        detail_text: flag.detail_text,
        recommendation_text: flag.recommendation_text,
        is_active: true,
        created_at: new Date(),
      }));

      await trx('rfq_flags').insert(flagRows);
    }

    await trx.commit();

    logger.info('Flag evaluation complete', {
      rfqId,
      flagCount: allFlags.length,
      flagTypes: [...new Set(allFlags.map((f) => f.flag_id))],
    });
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

// ── Getter ──

export async function getActiveFlags(
  rfqId: string,
): Promise<Record<string, unknown>[]> {
  const db = getDb();
  return db('rfq_flags')
    .where({ rfq_id: rfqId, is_active: true })
    .select(
      'id',
      'rfq_id',
      'flag_id',
      'flag_type',
      'affected_supplier_code',
      'affected_item_ids',
      'detail_text',
      'recommendation_text',
      'is_active',
      'created_at',
    )
    .orderBy('flag_id', 'asc');
}
