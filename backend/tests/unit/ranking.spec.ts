import {
  calculateItemRankings,
  calculateTotalRankings,
  calculateWeightedRankings,
  calculateProximity,
  getRankColor,
} from '../../src/modules/ranking/ranking.service';
import { RankColor, ProximityLabel } from '../../src/shared/types/enums';

describe('Ranking Engine', () => {
  describe('getRankColor', () => {
    it('should return GREEN for rank 1', () => {
      expect(getRankColor(1)).toBe(RankColor.GREEN);
    });

    it('should return YELLOW for rank 2', () => {
      expect(getRankColor(2)).toBe(RankColor.YELLOW);
    });

    it('should return RED for rank 3', () => {
      expect(getRankColor(3)).toBe(RankColor.RED);
    });

    it('should return RED for rank 10', () => {
      expect(getRankColor(10)).toBe(RankColor.RED);
    });
  });

  describe('calculateProximity', () => {
    it('should return null when supplier IS L1 (same total)', () => {
      expect(calculateProximity(1000, 1000)).toBeNull();
    });

    it('should return VERY_CLOSE for gap <= 2%', () => {
      expect(calculateProximity(1020, 1000)).toBe(ProximityLabel.VERY_CLOSE);
    });

    it('should return VERY_CLOSE at exactly 2% boundary', () => {
      expect(calculateProximity(1020, 1000)).toBe(ProximityLabel.VERY_CLOSE);
    });

    it('should return CLOSE for gap > 2% and <= 10%', () => {
      expect(calculateProximity(1050, 1000)).toBe(ProximityLabel.CLOSE);
    });

    it('should return CLOSE at exactly 10% boundary', () => {
      expect(calculateProximity(1100, 1000)).toBe(ProximityLabel.CLOSE);
    });

    it('should return FAR for gap > 10%', () => {
      expect(calculateProximity(1200, 1000)).toBe(ProximityLabel.FAR);
    });

    it('should return VERY_CLOSE for gap of 1%', () => {
      expect(calculateProximity(1010, 1000)).toBe(ProximityLabel.VERY_CLOSE);
    });

    it('should return CLOSE for gap of exactly 2.01%', () => {
      // 2.01% above 1000 = 1020.1
      expect(calculateProximity(1020.1, 1000)).toBe(ProximityLabel.CLOSE);
    });

    it('should return FAR for gap of 10.01%', () => {
      // 10.01% above 1000 = 1100.1
      expect(calculateProximity(1100.1, 1000)).toBe(ProximityLabel.FAR);
    });
  });

  describe('calculateItemRankings', () => {
    it('should rank suppliers by ascending unit price (L1 = lowest)', () => {
      const bidData = [
        { supplier_id: 's1', supplier_code: 'AAA11', rfq_item_id: 'item1', unit_price: 100, total_price: 10000 },
        { supplier_id: 's2', supplier_code: 'BBB22', rfq_item_id: 'item1', unit_price: 80, total_price: 8000 },
        { supplier_id: 's3', supplier_code: 'CCC33', rfq_item_id: 'item1', unit_price: 120, total_price: 12000 },
      ];

      const result = calculateItemRankings(bidData, ['item1']);
      expect(result).toHaveLength(1);
      expect(result[0].rankings[0].supplier_id).toBe('s2'); // L1
      expect(result[0].rankings[0].rank).toBe(1);
      expect(result[0].rankings[1].supplier_id).toBe('s1'); // L2
      expect(result[0].rankings[1].rank).toBe(2);
      expect(result[0].rankings[2].supplier_id).toBe('s3'); // L3
      expect(result[0].rankings[2].rank).toBe(3);
    });

    it('should handle ties: equal prices get same rank', () => {
      const bidData = [
        { supplier_id: 's1', supplier_code: 'AAA11', rfq_item_id: 'item1', unit_price: 100, total_price: 10000 },
        { supplier_id: 's2', supplier_code: 'BBB22', rfq_item_id: 'item1', unit_price: 100, total_price: 10000 },
        { supplier_id: 's3', supplier_code: 'CCC33', rfq_item_id: 'item1', unit_price: 120, total_price: 12000 },
      ];

      const result = calculateItemRankings(bidData, ['item1']);
      expect(result[0].rankings[0].rank).toBe(1);
      expect(result[0].rankings[1].rank).toBe(1); // Tie with rank 1
      expect(result[0].rankings[2].rank).toBe(3); // Skips to 3
    });

    it('should handle single bidder: bidder is L1', () => {
      const bidData = [
        { supplier_id: 's1', supplier_code: 'AAA11', rfq_item_id: 'item1', unit_price: 100, total_price: 10000 },
      ];

      const result = calculateItemRankings(bidData, ['item1']);
      expect(result[0].rankings).toHaveLength(1);
      expect(result[0].rankings[0].rank).toBe(1);
    });

    it('should handle all same price: all suppliers are L1', () => {
      const bidData = [
        { supplier_id: 's1', supplier_code: 'AAA11', rfq_item_id: 'item1', unit_price: 100, total_price: 10000 },
        { supplier_id: 's2', supplier_code: 'BBB22', rfq_item_id: 'item1', unit_price: 100, total_price: 10000 },
        { supplier_id: 's3', supplier_code: 'CCC33', rfq_item_id: 'item1', unit_price: 100, total_price: 10000 },
      ];

      const result = calculateItemRankings(bidData, ['item1']);
      expect(result[0].rankings[0].rank).toBe(1);
      expect(result[0].rankings[1].rank).toBe(1);
      expect(result[0].rankings[2].rank).toBe(1);
    });

    it('should handle multiple items correctly', () => {
      const bidData = [
        { supplier_id: 's1', supplier_code: 'AAA11', rfq_item_id: 'item1', unit_price: 100, total_price: 10000 },
        { supplier_id: 's2', supplier_code: 'BBB22', rfq_item_id: 'item1', unit_price: 80, total_price: 8000 },
        { supplier_id: 's1', supplier_code: 'AAA11', rfq_item_id: 'item2', unit_price: 50, total_price: 5000 },
        { supplier_id: 's2', supplier_code: 'BBB22', rfq_item_id: 'item2', unit_price: 60, total_price: 6000 },
      ];

      const result = calculateItemRankings(bidData, ['item1', 'item2']);
      expect(result).toHaveLength(2);
      // Item1: s2 is L1
      expect(result[0].rankings[0].supplier_id).toBe('s2');
      // Item2: s1 is L1
      expect(result[1].rankings[0].supplier_id).toBe('s1');
    });

    it('should rank correctly when L1 changes after revision (simulated by different prices)', () => {
      // Before revision: s1 was cheapest at 80, s2 at 100
      // After revision: s1 revised to 110, s2 stays at 100
      const bidDataAfterRevision = [
        { supplier_id: 's1', supplier_code: 'AAA11', rfq_item_id: 'item1', unit_price: 110, total_price: 11000 },
        { supplier_id: 's2', supplier_code: 'BBB22', rfq_item_id: 'item1', unit_price: 100, total_price: 10000 },
      ];

      const result = calculateItemRankings(bidDataAfterRevision, ['item1']);
      // Now s2 is L1
      expect(result[0].rankings[0].supplier_id).toBe('s2');
      expect(result[0].rankings[0].rank).toBe(1);
      // s1 is L2 (rank worsened)
      expect(result[0].rankings[1].supplier_id).toBe('s1');
      expect(result[0].rankings[1].rank).toBe(2);
    });
  });

  describe('calculateTotalRankings', () => {
    it('should rank by total price ascending', () => {
      const totals = [
        { supplier_id: 's1', supplier_code: 'AAA11', total_price: 50000 },
        { supplier_id: 's2', supplier_code: 'BBB22', total_price: 30000 },
        { supplier_id: 's3', supplier_code: 'CCC33', total_price: 70000 },
      ];

      const result = calculateTotalRankings(totals);
      expect(result[0].supplier_id).toBe('s2');
      expect(result[0].rank).toBe(1);
      expect(result[1].supplier_id).toBe('s1');
      expect(result[1].rank).toBe(2);
      expect(result[2].supplier_id).toBe('s3');
      expect(result[2].rank).toBe(3);
    });

    it('should handle ties in total price', () => {
      const totals = [
        { supplier_id: 's1', supplier_code: 'AAA11', total_price: 50000 },
        { supplier_id: 's2', supplier_code: 'BBB22', total_price: 50000 },
        { supplier_id: 's3', supplier_code: 'CCC33', total_price: 70000 },
      ];

      const result = calculateTotalRankings(totals);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(1);
      expect(result[2].rank).toBe(3);
    });

    it('should handle single bidder', () => {
      const totals = [
        { supplier_id: 's1', supplier_code: 'AAA11', total_price: 50000 },
      ];

      const result = calculateTotalRankings(totals);
      expect(result).toHaveLength(1);
      expect(result[0].rank).toBe(1);
    });

    it('should handle empty input', () => {
      const result = calculateTotalRankings([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('calculateWeightedRankings', () => {
    it('should normalize scores to 0-100 range', () => {
      const totals = [
        { supplier_id: 's1', supplier_code: 'AAA11', total_price: 50000 },
        { supplier_id: 's2', supplier_code: 'BBB22', total_price: 30000 },
        { supplier_id: 's3', supplier_code: 'CCC33', total_price: 70000 },
      ];

      const result = calculateWeightedRankings(totals, {
        weight_price: 100,
        weight_delivery: 0,
        weight_payment: 0,
      });

      // s2 has lowest price -> score 100
      const s2 = result.find((r) => r.supplier_id === 's2');
      expect(s2!.price_score).toBe(100);

      // s3 has highest price -> score 0
      const s3 = result.find((r) => r.supplier_id === 's3');
      expect(s3!.price_score).toBe(0);

      // s1 is in the middle -> score 50
      const s1 = result.find((r) => r.supplier_id === 's1');
      expect(s1!.price_score).toBe(50);
    });

    it('should apply buyer-configured weights correctly', () => {
      const totals = [
        { supplier_id: 's1', supplier_code: 'AAA11', total_price: 30000 },
        { supplier_id: 's2', supplier_code: 'BBB22', total_price: 50000 },
      ];

      const result = calculateWeightedRankings(totals, {
        weight_price: 70,
        weight_delivery: 15,
        weight_payment: 15,
      });

      // Both should have valid scores
      expect(result).toHaveLength(2);
      // s1 has best price, should have higher weighted score
      expect(result[0].supplier_id).toBe('s1');
      expect(result[0].rank).toBe(1);
    });

    it('should handle all same price (all get score 100)', () => {
      const totals = [
        { supplier_id: 's1', supplier_code: 'AAA11', total_price: 50000 },
        { supplier_id: 's2', supplier_code: 'BBB22', total_price: 50000 },
      ];

      const result = calculateWeightedRankings(totals, {
        weight_price: 100,
        weight_delivery: 0,
        weight_payment: 0,
      });

      expect(result[0].price_score).toBe(100);
      expect(result[1].price_score).toBe(100);
    });

    it('should rank by composite score descending', () => {
      const totals = [
        { supplier_id: 's1', supplier_code: 'AAA11', total_price: 70000 },
        { supplier_id: 's2', supplier_code: 'BBB22', total_price: 30000 },
      ];

      const result = calculateWeightedRankings(totals, {
        weight_price: 100,
        weight_delivery: 0,
        weight_payment: 0,
      });

      // s2 should be rank 1 (lower price = higher score)
      expect(result[0].supplier_id).toBe('s2');
      expect(result[0].rank).toBe(1);
      expect(result[1].supplier_id).toBe('s1');
      expect(result[1].rank).toBe(2);
    });

    it('should return empty for empty input', () => {
      const result = calculateWeightedRankings([], {
        weight_price: 100,
        weight_delivery: 0,
        weight_payment: 0,
      });
      expect(result).toHaveLength(0);
    });

    it('should default to price-only ranking when all weights are 0', () => {
      const totals = [
        { supplier_id: 's1', supplier_code: 'AAA11', total_price: 50000 },
      ];

      const result = calculateWeightedRankings(totals, {
        weight_price: 0,
        weight_delivery: 0,
        weight_payment: 0,
      });
      // Zero weights default to price-only (weight_price=100)
      expect(result).toHaveLength(1);
      expect(result[0].rank).toBe(1);
      expect(result[0].price_score).toBe(100);
      expect(result[0].weighted_score).toBe(100);
    });
  });
});
