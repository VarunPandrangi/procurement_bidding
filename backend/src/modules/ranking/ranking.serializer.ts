import { RankColor, ProximityLabel } from '../../shared/types/enums';
import {
  ItemRanking,
  TotalRanking,
  WeightedRanking,
  SupplierRankView,
} from '../../shared/types/interfaces';
import { getRankColor, calculateProximity } from './ranking.service';

/**
 * SECURITY BOUNDARY — Supplier Ranking Serializer
 *
 * This function is the ONLY way supplier ranking data is serialized for the response.
 * It uses an EXPLICIT ALLOWLIST — fields are constructed one by one.
 * NEVER spread, copy, or pass through full ranking objects.
 *
 * Allowed response fields:
 *   - rank_color (GREEN/YELLOW/RED)
 *   - proximity_label (VERY_CLOSE/CLOSE/FAR/null)
 *   - own_items (supplier's OWN prices only)
 *   - own_total_price
 *
 * NEVER include:
 *   - competitor prices, competitor codes, competitor IDs
 *   - numeric rank position, bidder count
 *   - full ranking arrays (item_rankings, total_rankings, weighted_rankings)
 */
export function serializeSupplierRanking(
  supplierId: string,
  totalRankings: TotalRanking[],
  itemRankings: ItemRanking[],
): SupplierRankView {
  // Find this supplier's entry in total rankings
  const ownTotalRanking = totalRankings.find((r) => r.supplier_id === supplierId);

  if (!ownTotalRanking) {
    // Supplier has not bid yet — return safe defaults
    return {
      rank_color: RankColor.RED,
      proximity_label: null,
      own_items: [],
      own_total_price: 0,
    };
  }

  // Determine rank color using ONLY the rank number
  const rank_color: RankColor = getRankColor(ownTotalRanking.rank);

  // Determine proximity using ONLY own total and L1 total
  const l1 = totalRankings.find((r) => r.rank === 1);
  let proximity_label: ProximityLabel | null = null;

  if (l1 && ownTotalRanking.supplier_id !== l1.supplier_id) {
    proximity_label = calculateProximity(ownTotalRanking.total_price, l1.total_price);
  }

  // Extract ONLY own item prices — explicit field construction
  const own_items: Array<{ rfq_item_id: string; unit_price: number; total_price: number }> = [];

  for (const ir of itemRankings) {
    const ownEntry = ir.rankings.find((r) => r.supplier_id === supplierId);
    if (ownEntry) {
      own_items.push({
        rfq_item_id: ir.rfq_item_id,
        unit_price: ownEntry.unit_price,
        total_price: ownEntry.total_price,
      });
    }
  }

  // EXPLICIT ALLOWLIST construction — NEVER spread full objects
  return {
    rank_color,
    proximity_label,
    own_items,
    own_total_price: ownTotalRanking.total_price,
  };
}

/**
 * Buyer Ranking Serializer — returns full ranking data for buyers.
 * Buyers can see all supplier codes, prices, and rankings.
 */
export function serializeBuyerRanking(
  itemRankings: ItemRanking[],
  totalRankings: TotalRanking[],
  weightedRankings: WeightedRanking[],
  supplierCredibility?: Map<string, string>,
): {
  item_rankings: Array<{
    rfq_item_id: string;
    l1_supplier_code: string | null;
    l1_price: number | null;
    bidder_count: number;
    rankings: Array<{
      supplier_code: string;
      unit_price: number;
      total_price: number;
      rank: number;
    }>;
  }>;
  total_rankings: Array<{
    supplier_code: string;
    total_price: number;
    rank: number;
    credibility_class: string | null;
  }>;
  weighted_rankings: Array<{
    supplier_code: string;
    score: number;
    rank: number;
    score_breakdown: {
      price_score: number;
      delivery_score: number;
      payment_score: number;
    };
  }>;
} {
  const item_rankings = itemRankings.map((ir) => {
    const l1Entry = ir.rankings.find((r) => r.rank === 1);
    return {
      rfq_item_id: ir.rfq_item_id,
      l1_supplier_code: l1Entry ? l1Entry.supplier_code : null,
      l1_price: l1Entry ? l1Entry.unit_price : null,
      bidder_count: ir.rankings.length,
      rankings: ir.rankings.map((r) => ({
        supplier_code: r.supplier_code,
        unit_price: r.unit_price,
        total_price: r.total_price,
        rank: r.rank,
      })),
    };
  });

  const total_rankings = totalRankings.map((tr) => ({
    supplier_code: tr.supplier_code,
    total_price: tr.total_price,
    rank: tr.rank,
    credibility_class: supplierCredibility?.get(tr.supplier_id) || null,
  }));

  const weighted_rankings = weightedRankings.map((wr) => ({
    supplier_code: wr.supplier_code,
    score: wr.weighted_score,
    rank: wr.rank,
    score_breakdown: {
      price_score: wr.price_score,
      delivery_score: wr.delivery_score,
      payment_score: wr.payment_score,
    },
  }));

  return { item_rankings, total_rankings, weighted_rankings };
}
