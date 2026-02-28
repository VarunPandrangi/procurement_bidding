import {
  serializeSupplierRanking,
  serializeBuyerRanking,
} from '../../src/modules/ranking/ranking.serializer';
import { RankColor, ProximityLabel } from '../../src/shared/types/enums';
import { ItemRanking, TotalRanking, WeightedRanking } from '../../src/shared/types/interfaces';

describe('Ranking Serializer — Security Boundary', () => {
  // Test data setup
  const supplier1Id = 'supplier-1';
  const supplier2Id = 'supplier-2';
  const supplier3Id = 'supplier-3';

  const totalRankings: TotalRanking[] = [
    { supplier_code: 'SUP01', supplier_id: supplier1Id, total_price: 10000, rank: 1 },
    { supplier_code: 'SUP02', supplier_id: supplier2Id, total_price: 10100, rank: 2 },
    { supplier_code: 'SUP03', supplier_id: supplier3Id, total_price: 12000, rank: 3 },
  ];

  const itemRankings: ItemRanking[] = [
    {
      rfq_item_id: 'item-1',
      rankings: [
        { supplier_code: 'SUP01', supplier_id: supplier1Id, unit_price: 50, total_price: 5000, rank: 1 },
        { supplier_code: 'SUP02', supplier_id: supplier2Id, unit_price: 52, total_price: 5200, rank: 2 },
        { supplier_code: 'SUP03', supplier_id: supplier3Id, unit_price: 60, total_price: 6000, rank: 3 },
      ],
    },
    {
      rfq_item_id: 'item-2',
      rankings: [
        { supplier_code: 'SUP01', supplier_id: supplier1Id, unit_price: 50, total_price: 5000, rank: 1 },
        { supplier_code: 'SUP02', supplier_id: supplier2Id, unit_price: 49, total_price: 4900, rank: 1 },
        { supplier_code: 'SUP03', supplier_id: supplier3Id, unit_price: 60, total_price: 6000, rank: 3 },
      ],
    },
  ];

  describe('serializeSupplierRanking — ALLOWLIST enforcement', () => {
    it('should return EXACTLY 4 allowed keys: rank_color, proximity_label, own_items, own_total_price', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      const keys = Object.keys(result);
      expect(keys).toHaveLength(4);
      expect(keys.sort()).toEqual(['own_items', 'own_total_price', 'proximity_label', 'rank_color'].sort());
    });

    it('should NOT contain competitor_price in response', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('competitor_price');
    });

    it('should NOT contain competitor_code in response', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('competitor_code');
    });

    it('should NOT contain numeric rank (rank_position) in response', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('rank_position');
      expect(serialized).not.toContain('numeric_rank');
    });

    it('should NOT contain total_bidders count in response', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('total_bidders');
      expect(serialized).not.toContain('bidder_count');
    });

    it('should NOT contain full ranking arrays (item_rankings, total_rankings)', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('"item_rankings"');
      expect(serialized).not.toContain('"total_rankings"');
      expect(serialized).not.toContain('"weighted_rankings"');
    });

    it('should NOT contain any other supplier codes', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('SUP01');
      expect(serialized).not.toContain('SUP03');
      expect(serialized).not.toContain(supplier1Id);
      expect(serialized).not.toContain(supplier3Id);
    });

    it('should NOT contain any other supplier prices', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      const serialized = JSON.stringify(result);
      // Supplier1 prices
      expect(serialized).not.toContain('"10000"');
      // Supplier3 prices
      expect(serialized).not.toContain('"12000"');
      expect(serialized).not.toContain('"6000"');
    });

    it('own_items inner objects should have EXACTLY 3 keys: rfq_item_id, unit_price, total_price', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      for (const item of result.own_items) {
        const itemKeys = Object.keys(item);
        expect(itemKeys).toHaveLength(3);
        expect(itemKeys.sort()).toEqual(['rfq_item_id', 'total_price', 'unit_price'].sort());
      }
    });

    it('should NOT expose supplier_code in own_items', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      for (const item of result.own_items) {
        expect((item as Record<string, unknown>)['supplier_code']).toBeUndefined();
        expect((item as Record<string, unknown>)['supplier_id']).toBeUndefined();
        expect((item as Record<string, unknown>)['rank']).toBeUndefined();
      }
    });
  });

  describe('serializeSupplierRanking — correct data values', () => {
    it('should return GREEN rank_color for L1 supplier', () => {
      const result = serializeSupplierRanking(supplier1Id, totalRankings, itemRankings);
      expect(result.rank_color).toBe(RankColor.GREEN);
    });

    it('should return YELLOW rank_color for L2 supplier', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      expect(result.rank_color).toBe(RankColor.YELLOW);
    });

    it('should return RED rank_color for L3+ supplier', () => {
      const result = serializeSupplierRanking(supplier3Id, totalRankings, itemRankings);
      expect(result.rank_color).toBe(RankColor.RED);
    });

    it('should return null proximity_label for L1 supplier', () => {
      const result = serializeSupplierRanking(supplier1Id, totalRankings, itemRankings);
      expect(result.proximity_label).toBeNull();
    });

    it('should return VERY_CLOSE proximity_label for L2 within 2%', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      // 10100 vs 10000 = 1% difference
      expect(result.proximity_label).toBe(ProximityLabel.VERY_CLOSE);
    });

    it('should return FAR proximity_label for L3+ beyond 10%', () => {
      const result = serializeSupplierRanking(supplier3Id, totalRankings, itemRankings);
      // 12000 vs 10000 = 20% difference
      expect(result.proximity_label).toBe(ProximityLabel.FAR);
    });

    it('should return correct own_total_price', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      expect(result.own_total_price).toBe(10100);
    });

    it('should return correct own_items with ONLY own prices', () => {
      const result = serializeSupplierRanking(supplier2Id, totalRankings, itemRankings);
      expect(result.own_items).toHaveLength(2);

      const item1 = result.own_items.find((i) => i.rfq_item_id === 'item-1');
      expect(item1).toBeDefined();
      expect(item1!.unit_price).toBe(52);
      expect(item1!.total_price).toBe(5200);

      const item2 = result.own_items.find((i) => i.rfq_item_id === 'item-2');
      expect(item2).toBeDefined();
      expect(item2!.unit_price).toBe(49);
      expect(item2!.total_price).toBe(4900);
    });

    it('should return safe defaults when supplier has not bid', () => {
      const result = serializeSupplierRanking('non-existent-supplier', totalRankings, itemRankings);
      expect(result.rank_color).toBe(RankColor.RED);
      expect(result.proximity_label).toBeNull();
      expect(result.own_items).toHaveLength(0);
      expect(result.own_total_price).toBe(0);
    });
  });

  describe('serializeBuyerRanking — full data for buyers', () => {
    const weightedRankings: WeightedRanking[] = [
      {
        supplier_code: 'SUP01', supplier_id: supplier1Id,
        price_score: 100, delivery_score: 50, payment_score: 50,
        weighted_score: 100, rank: 1,
      },
      {
        supplier_code: 'SUP02', supplier_id: supplier2Id,
        price_score: 95, delivery_score: 50, payment_score: 50,
        weighted_score: 95, rank: 2,
      },
      {
        supplier_code: 'SUP03', supplier_id: supplier3Id,
        price_score: 0, delivery_score: 50, payment_score: 50,
        weighted_score: 0, rank: 3,
      },
    ];

    it('should return full item_rankings with supplier codes and prices', () => {
      const result = serializeBuyerRanking(itemRankings, totalRankings, weightedRankings);
      expect(result.item_rankings).toHaveLength(2);

      const firstItem = result.item_rankings[0];
      expect(firstItem.rfq_item_id).toBe('item-1');
      expect(firstItem.l1_supplier_code).toBe('SUP01');
      expect(firstItem.l1_price).toBe(50);
      expect(firstItem.bidder_count).toBe(3);
      expect(firstItem.rankings).toHaveLength(3);
    });

    it('should return full total_rankings with all supplier data', () => {
      const result = serializeBuyerRanking(itemRankings, totalRankings, weightedRankings);
      expect(result.total_rankings).toHaveLength(3);
      expect(result.total_rankings[0].supplier_code).toBe('SUP01');
      expect(result.total_rankings[0].total_price).toBe(10000);
      expect(result.total_rankings[0].rank).toBe(1);
    });

    it('should return full weighted_rankings with scores and breakdown', () => {
      const result = serializeBuyerRanking(itemRankings, totalRankings, weightedRankings);
      expect(result.weighted_rankings).toHaveLength(3);

      const first = result.weighted_rankings[0];
      expect(first.supplier_code).toBe('SUP01');
      expect(first.score).toBe(100);
      expect(first.rank).toBe(1);
      expect(first.score_breakdown.price_score).toBe(100);
      expect(first.score_breakdown.delivery_score).toBe(50);
      expect(first.score_breakdown.payment_score).toBe(50);
    });

    it('buyer ranking should NOT contain supplier_id (only supplier_code)', () => {
      const result = serializeBuyerRanking(itemRankings, totalRankings, weightedRankings);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('supplier_id');
    });
  });
});
