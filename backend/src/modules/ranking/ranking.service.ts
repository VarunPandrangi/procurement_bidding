import { getDb } from '../../config/database';
import {
  RankColor,
  ProximityLabel,
} from '../../shared/types/enums';
import {
  ItemRanking,
  ItemRankingEntry,
  TotalRanking,
  WeightedRanking,
  RankingResult,
} from '../../shared/types/interfaces';
import { logger } from '../../config/logger';

// ── Pure functions (exported for unit testing) ──

export function getRankColor(rank: number): RankColor {
  if (rank === 1) return RankColor.GREEN;
  if (rank === 2) return RankColor.YELLOW;
  return RankColor.RED;
}

export function calculateProximity(
  supplierTotal: number,
  l1Total: number,
): ProximityLabel | null {
  if (supplierTotal === l1Total) return null; // Supplier IS L1
  const gap = ((supplierTotal - l1Total) / l1Total) * 100;
  if (gap <= 2) return ProximityLabel.VERY_CLOSE;
  if (gap <= 10) return ProximityLabel.CLOSE;
  return ProximityLabel.FAR;
}

export function calculateItemRankings(
  bidData: Array<{
    supplier_id: string;
    supplier_code: string;
    rfq_item_id: string;
    unit_price: number;
    total_price: number;
  }>,
  rfqItemIds: string[],
): ItemRanking[] {
  const itemRankings: ItemRanking[] = [];

  for (const itemId of rfqItemIds) {
    const itemBids = bidData
      .filter((b) => b.rfq_item_id === itemId)
      .sort((a, b) => a.unit_price - b.unit_price);

    const rankings: ItemRankingEntry[] = [];
    let currentRank = 0;
    let previousPrice = -1;

    for (let i = 0; i < itemBids.length; i++) {
      if (itemBids[i].unit_price !== previousPrice) {
        currentRank = i + 1;
        previousPrice = itemBids[i].unit_price;
      }
      rankings.push({
        supplier_code: itemBids[i].supplier_code,
        supplier_id: itemBids[i].supplier_id,
        unit_price: itemBids[i].unit_price,
        total_price: itemBids[i].total_price,
        rank: currentRank,
      });
    }

    itemRankings.push({ rfq_item_id: itemId, rankings });
  }

  return itemRankings;
}

export function calculateTotalRankings(
  supplierTotals: Array<{
    supplier_id: string;
    supplier_code: string;
    total_price: number;
  }>,
): TotalRanking[] {
  const sorted = [...supplierTotals].sort((a, b) => a.total_price - b.total_price);
  const rankings: TotalRanking[] = [];
  let currentRank = 0;
  let previousTotal = -1;

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].total_price !== previousTotal) {
      currentRank = i + 1;
      previousTotal = sorted[i].total_price;
    }
    rankings.push({
      supplier_code: sorted[i].supplier_code,
      supplier_id: sorted[i].supplier_id,
      total_price: sorted[i].total_price,
      rank: currentRank,
    });
  }

  return rankings;
}

export function calculateWeightedRankings(
  supplierTotals: Array<{
    supplier_id: string;
    supplier_code: string;
    total_price: number;
  }>,
  weights: {
    weight_price: number;
    weight_delivery: number;
    weight_payment: number;
  },
): WeightedRanking[] {
  if (supplierTotals.length === 0) return [];

  const totalWeight = weights.weight_price + weights.weight_delivery + weights.weight_payment;

  // Default behavior when all weights are 0: treat as price-only (weight_price = 100)
  const effectiveWeights = totalWeight === 0
    ? { weight_price: 100, weight_delivery: 0, weight_payment: 0 }
    : weights;
  const effectiveTotalWeight = totalWeight === 0 ? 100 : totalWeight;

  // Normalize price scores to 0-100
  const prices = supplierTotals.map((s) => s.total_price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;

  const scored = supplierTotals.map((s) => {
    // Price score: lower is better, normalized to 0-100
    // Best price (min) gets 100, worst price (max) gets 0
    const priceScore = priceRange === 0 ? 100 : ((maxPrice - s.total_price) / priceRange) * 100;

    // Delivery and payment scores default to neutral (50) for Sprint 3
    // These will be populated with real data in Sprint 7
    const deliveryScore = 50;
    const paymentScore = 50;

    const weightedScore =
      (priceScore * effectiveWeights.weight_price +
        deliveryScore * effectiveWeights.weight_delivery +
        paymentScore * effectiveWeights.weight_payment) /
      effectiveTotalWeight;

    return {
      supplier_code: s.supplier_code,
      supplier_id: s.supplier_id,
      price_score: parseFloat(priceScore.toFixed(2)),
      delivery_score: deliveryScore,
      payment_score: paymentScore,
      weighted_score: parseFloat(weightedScore.toFixed(2)),
      rank: 0, // assigned after sort
    };
  });

  // Sort descending by weighted score
  scored.sort((a, b) => b.weighted_score - a.weighted_score);

  // Assign ranks with tie handling
  let currentRank = 0;
  let previousScore = -1;

  for (let i = 0; i < scored.length; i++) {
    if (scored[i].weighted_score !== previousScore) {
      currentRank = i + 1;
      previousScore = scored[i].weighted_score;
    }
    scored[i].rank = currentRank;
  }

  return scored;
}

// ── Main ranking calculation function ──

export async function calculateRankings(rfqId: string): Promise<RankingResult> {
  const db = getDb();

  // Get all latest bids with their items
  const bidData = await db('bids')
    .join('bid_items', 'bids.id', 'bid_items.bid_id')
    .where({ 'bids.rfq_id': rfqId, 'bids.is_latest': true })
    .select(
      'bids.supplier_id',
      'bids.supplier_code',
      'bids.total_price as bid_total_price',
      'bid_items.rfq_item_id',
      'bid_items.unit_price',
      'bid_items.total_price',
    );

  // Get RFQ item IDs for ordering
  const rfqItems = await db('rfq_items')
    .where('rfq_id', rfqId)
    .orderBy('sl_no')
    .select('id');

  const rfqItemIds = rfqItems.map((i: { id: string }) => i.id);

  // Get RFQ weights
  const rfq = await db('rfqs')
    .where('id', rfqId)
    .select('weight_price', 'weight_delivery', 'weight_payment')
    .first();

  if (!rfq) {
    return { item_rankings: [], total_rankings: [], weighted_rankings: [] };
  }

  // Parse numeric values from DB
  const parsedBidData = bidData.map((row: Record<string, unknown>) => ({
    supplier_id: row.supplier_id as string,
    supplier_code: row.supplier_code as string,
    rfq_item_id: row.rfq_item_id as string,
    unit_price: parseFloat(row.unit_price as string),
    total_price: parseFloat(row.total_price as string),
    bid_total_price: parseFloat(row.bid_total_price as string),
  }));

  // Item-level rankings
  const item_rankings = calculateItemRankings(parsedBidData, rfqItemIds);

  // Build supplier totals for total and weighted rankings
  const supplierTotalMap = new Map<string, { supplier_id: string; supplier_code: string; total_price: number }>();
  for (const row of parsedBidData) {
    if (!supplierTotalMap.has(row.supplier_id)) {
      supplierTotalMap.set(row.supplier_id, {
        supplier_id: row.supplier_id,
        supplier_code: row.supplier_code,
        total_price: row.bid_total_price,
      });
    }
  }
  const supplierTotals = Array.from(supplierTotalMap.values());

  // Total rankings
  const total_rankings = calculateTotalRankings(supplierTotals);

  // Weighted rankings
  const weighted_rankings = calculateWeightedRankings(supplierTotals, {
    weight_price: parseFloat(rfq.weight_price as string),
    weight_delivery: parseFloat(rfq.weight_delivery as string),
    weight_payment: parseFloat(rfq.weight_payment as string),
  });

  logger.info('Rankings calculated', {
    rfqId,
    bidderCount: supplierTotals.length,
    itemCount: rfqItemIds.length,
  });

  return { item_rankings, total_rankings, weighted_rankings };
}

// ── Negotiation ranking calculation ──

export async function calculateNegotiationRankings(negotiationId: string): Promise<RankingResult> {
  const db = getDb();

  // Get negotiation to find parent RFQ
  const negotiation = await db('negotiation_events')
    .where('id', negotiationId)
    .select('parent_rfq_id')
    .first();

  if (!negotiation) {
    return { item_rankings: [], total_rankings: [], weighted_rankings: [] };
  }

  const parentRfqId = negotiation.parent_rfq_id as string;

  // Get all latest bids for this negotiation with their items
  const bidData = await db('bids')
    .join('bid_items', 'bids.id', 'bid_items.bid_id')
    .where({ 'bids.negotiation_id': negotiationId, 'bids.is_latest': true })
    .select(
      'bids.supplier_id',
      'bids.supplier_code',
      'bids.total_price as bid_total_price',
      'bid_items.rfq_item_id',
      'bid_items.unit_price',
      'bid_items.total_price',
    );

  // Get parent RFQ item IDs for ordering
  const rfqItems = await db('rfq_items')
    .where('rfq_id', parentRfqId)
    .orderBy('sl_no')
    .select('id');

  const rfqItemIds = rfqItems.map((i: { id: string }) => i.id);

  // Get parent RFQ weights
  const rfq = await db('rfqs')
    .where('id', parentRfqId)
    .select('weight_price', 'weight_delivery', 'weight_payment')
    .first();

  if (!rfq) {
    return { item_rankings: [], total_rankings: [], weighted_rankings: [] };
  }

  // Parse numeric values from DB
  const parsedBidData = bidData.map((row: Record<string, unknown>) => ({
    supplier_id: row.supplier_id as string,
    supplier_code: row.supplier_code as string,
    rfq_item_id: row.rfq_item_id as string,
    unit_price: parseFloat(row.unit_price as string),
    total_price: parseFloat(row.total_price as string),
    bid_total_price: parseFloat(row.bid_total_price as string),
  }));

  // Item-level rankings
  const item_rankings = calculateItemRankings(parsedBidData, rfqItemIds);

  // Build supplier totals
  const supplierTotalMap = new Map<string, { supplier_id: string; supplier_code: string; total_price: number }>();
  for (const row of parsedBidData) {
    if (!supplierTotalMap.has(row.supplier_id)) {
      supplierTotalMap.set(row.supplier_id, {
        supplier_id: row.supplier_id,
        supplier_code: row.supplier_code,
        total_price: row.bid_total_price,
      });
    }
  }
  const supplierTotals = Array.from(supplierTotalMap.values());

  // Total rankings
  const total_rankings = calculateTotalRankings(supplierTotals);

  // Weighted rankings
  const weighted_rankings = calculateWeightedRankings(supplierTotals, {
    weight_price: parseFloat(rfq.weight_price as string),
    weight_delivery: parseFloat(rfq.weight_delivery as string),
    weight_payment: parseFloat(rfq.weight_payment as string),
  });

  logger.info('Negotiation rankings calculated', {
    negotiationId,
    bidderCount: supplierTotals.length,
    itemCount: rfqItemIds.length,
  });

  return { item_rankings, total_rankings, weighted_rankings };
}
