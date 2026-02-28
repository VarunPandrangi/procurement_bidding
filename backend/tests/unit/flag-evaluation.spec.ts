import {
  evaluateDeliveryDeviation,
  evaluatePaymentDeviation,
  evaluateAbnormalPrice,
  evaluateSupplierDominance,
  evaluateLateRevisions,
} from '../../src/modules/flags/flag.service';

describe('Flag Evaluation — Pure Functions', () => {
  // ────────────────────────────────────────────────
  // FLAG-01: Delivery Deviation
  // ────────────────────────────────────────────────
  describe('FLAG-01: evaluateDeliveryDeviation', () => {
    const threshold = 20; // 20%

    it('should raise flag when supplier delivery is exactly at boundary (10 * 1.2 = 12)', () => {
      const result = evaluateDeliveryDeviation(12, 10, threshold);
      expect(result).not.toBeNull();
      expect(result!.flag_id).toBe('FLAG-01');
      expect(result!.flag_type).toBe('delivery_deviation');
    });

    it('should NOT raise flag when supplier delivery is one unit below boundary', () => {
      const result = evaluateDeliveryDeviation(11, 10, threshold);
      expect(result).toBeNull();
    });

    it('should raise flag when supplier delivery exceeds boundary', () => {
      const result = evaluateDeliveryDeviation(15, 10, threshold);
      expect(result).not.toBeNull();
      expect(result!.flag_id).toBe('FLAG-01');
    });

    it('should NOT raise flag when supplier delivery is null', () => {
      const result = evaluateDeliveryDeviation(null, 10, threshold);
      expect(result).toBeNull();
    });

    it('should NOT raise flag when RFQ delivery is null', () => {
      const result = evaluateDeliveryDeviation(12, null, threshold);
      expect(result).toBeNull();
    });

    it('should NOT raise flag when RFQ delivery is 0', () => {
      const result = evaluateDeliveryDeviation(5, 0, threshold);
      expect(result).toBeNull();
    });

    it('should include detail text with correct values', () => {
      const result = evaluateDeliveryDeviation(15, 10, threshold);
      expect(result).not.toBeNull();
      expect(result!.detail_text).toContain('15');
      expect(result!.detail_text).toContain('10');
      expect(result!.recommendation_text.length).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────────────────────────
  // FLAG-02: Payment Deviation
  // ────────────────────────────────────────────────
  describe('FLAG-02: evaluatePaymentDeviation', () => {
    it('should NOT raise flag when terms match (case-insensitive)', () => {
      const result = evaluatePaymentDeviation('net 30', 'Net 30');
      expect(result).toBeNull();
    });

    it('should raise flag when terms differ', () => {
      const result = evaluatePaymentDeviation('Net 60', 'Net 30');
      expect(result).not.toBeNull();
      expect(result!.flag_id).toBe('FLAG-02');
      expect(result!.flag_type).toBe('payment_deviation');
    });

    it('should NOT raise flag when terms match after trimming', () => {
      const result = evaluatePaymentDeviation(' Net 30 ', 'Net 30');
      expect(result).toBeNull();
    });

    it('should NOT raise flag when supplier terms are null', () => {
      const result = evaluatePaymentDeviation(null, 'Net 30');
      expect(result).toBeNull();
    });

    it('should NOT raise flag when RFQ terms are null', () => {
      const result = evaluatePaymentDeviation('Net 30', null);
      expect(result).toBeNull();
    });

    it('should NOT raise flag when both terms are null', () => {
      const result = evaluatePaymentDeviation(null, null);
      expect(result).toBeNull();
    });

    it('should include both terms in detail text when flag is raised', () => {
      const result = evaluatePaymentDeviation('Net 60', 'Net 30');
      expect(result).not.toBeNull();
      expect(result!.detail_text).toContain('Net 60');
      expect(result!.detail_text).toContain('Net 30');
    });
  });

  // ────────────────────────────────────────────────
  // FLAG-03: Abnormal Price
  // ────────────────────────────────────────────────
  describe('FLAG-03: evaluateAbnormalPrice', () => {
    const threshold = 40; // 40%

    it('should raise flag when price is exactly at boundary (avg * 0.6)', () => {
      // 3 suppliers: 100, 100, 50 → avg = 83.333, boundary = 83.333 * 0.6 = 50.0
      const itemBids = [
        { rfq_item_id: 'item1', supplier_code: 'SUP01', unit_price: 100 },
        { rfq_item_id: 'item1', supplier_code: 'SUP02', unit_price: 100 },
        { rfq_item_id: 'item1', supplier_code: 'SUP03', unit_price: 50 },
      ];
      const flags = evaluateAbnormalPrice(itemBids, threshold);
      expect(flags.length).toBe(1);
      expect(flags[0].flag_id).toBe('FLAG-03');
      expect(flags[0].affected_supplier_code).toBe('SUP03');
      expect(flags[0].affected_item_ids).toEqual(['item1']);
    });

    it('should NOT raise flag when price is one unit above boundary', () => {
      // 3 suppliers: 100, 100, 51 → avg = 83.667, boundary = 83.667 * 0.6 = 50.2
      // 51 > 50.2 → no flag
      const itemBids = [
        { rfq_item_id: 'item1', supplier_code: 'SUP01', unit_price: 100 },
        { rfq_item_id: 'item1', supplier_code: 'SUP02', unit_price: 100 },
        { rfq_item_id: 'item1', supplier_code: 'SUP03', unit_price: 51 },
      ];
      const flags = evaluateAbnormalPrice(itemBids, threshold);
      expect(flags.length).toBe(0);
    });

    it('should NOT raise flag with single bidder (no meaningful average)', () => {
      const itemBids = [
        { rfq_item_id: 'item1', supplier_code: 'SUP01', unit_price: 10 },
      ];
      const flags = evaluateAbnormalPrice(itemBids, threshold);
      expect(flags.length).toBe(0);
    });

    it('should raise flags per item+supplier combination for multiple items', () => {
      const itemBids = [
        // Item 1: 100, 100, 10 → avg=70, boundary=42, 10 < 42 → flag
        { rfq_item_id: 'item1', supplier_code: 'SUP01', unit_price: 100 },
        { rfq_item_id: 'item1', supplier_code: 'SUP02', unit_price: 100 },
        { rfq_item_id: 'item1', supplier_code: 'SUP03', unit_price: 10 },
        // Item 2: 200, 200, 20 → avg=140, boundary=84, 20 < 84 → flag
        { rfq_item_id: 'item2', supplier_code: 'SUP01', unit_price: 200 },
        { rfq_item_id: 'item2', supplier_code: 'SUP02', unit_price: 200 },
        { rfq_item_id: 'item2', supplier_code: 'SUP03', unit_price: 20 },
      ];
      const flags = evaluateAbnormalPrice(itemBids, threshold);
      expect(flags.length).toBe(2);
      expect(flags[0].affected_item_ids).toEqual(['item1']);
      expect(flags[1].affected_item_ids).toEqual(['item2']);
      expect(flags.every((f) => f.affected_supplier_code === 'SUP03')).toBe(true);
    });

    it('should NOT raise flag when all prices are equal', () => {
      const itemBids = [
        { rfq_item_id: 'item1', supplier_code: 'SUP01', unit_price: 100 },
        { rfq_item_id: 'item1', supplier_code: 'SUP02', unit_price: 100 },
        { rfq_item_id: 'item1', supplier_code: 'SUP03', unit_price: 100 },
      ];
      const flags = evaluateAbnormalPrice(itemBids, threshold);
      expect(flags.length).toBe(0);
    });

    it('should handle empty input', () => {
      const flags = evaluateAbnormalPrice([], threshold);
      expect(flags.length).toBe(0);
    });
  });

  // ────────────────────────────────────────────────
  // FLAG-04: Supplier Dominance
  // ────────────────────────────────────────────────
  describe('FLAG-04: evaluateSupplierDominance', () => {
    const threshold = 80; // 80%

    it('should raise flag when supplier has exactly 80% of L1 positions (boundary)', () => {
      // 10 items, supplier A is L1 in 8 (80%)
      const itemRankings = Array.from({ length: 10 }, (_, i) => ({
        rfq_item_id: `item${i}`,
        rankings: i < 8
          ? [
              { supplier_code: 'SUP_A', rank: 1 },
              { supplier_code: 'SUP_B', rank: 2 },
            ]
          : [
              { supplier_code: 'SUP_B', rank: 1 },
              { supplier_code: 'SUP_A', rank: 2 },
            ],
      }));
      const flags = evaluateSupplierDominance(itemRankings, 10, threshold);
      expect(flags.length).toBe(1);
      expect(flags[0].flag_id).toBe('FLAG-04');
      expect(flags[0].affected_supplier_code).toBe('SUP_A');
    });

    it('should NOT raise flag when supplier has 70% of L1 positions (below boundary)', () => {
      // 10 items, supplier A is L1 in 7 (70%)
      const itemRankings = Array.from({ length: 10 }, (_, i) => ({
        rfq_item_id: `item${i}`,
        rankings: i < 7
          ? [
              { supplier_code: 'SUP_A', rank: 1 },
              { supplier_code: 'SUP_B', rank: 2 },
            ]
          : [
              { supplier_code: 'SUP_B', rank: 1 },
              { supplier_code: 'SUP_A', rank: 2 },
            ],
      }));
      const flags = evaluateSupplierDominance(itemRankings, 10, threshold);
      expect(flags.length).toBe(0);
    });

    it('should NOT raise flag when two suppliers tied at 50% each', () => {
      // 10 items, A is L1 in 5, B is L1 in 5
      const itemRankings = Array.from({ length: 10 }, (_, i) => ({
        rfq_item_id: `item${i}`,
        rankings: i < 5
          ? [
              { supplier_code: 'SUP_A', rank: 1 },
              { supplier_code: 'SUP_B', rank: 2 },
            ]
          : [
              { supplier_code: 'SUP_B', rank: 1 },
              { supplier_code: 'SUP_A', rank: 2 },
            ],
      }));
      const flags = evaluateSupplierDominance(itemRankings, 10, threshold);
      expect(flags.length).toBe(0);
    });

    it('should raise flag when supplier has 85% of L1 positions', () => {
      // 20 items, supplier A is L1 in 17 (85%)
      const itemRankings = Array.from({ length: 20 }, (_, i) => ({
        rfq_item_id: `item${i}`,
        rankings: i < 17
          ? [
              { supplier_code: 'SUP_A', rank: 1 },
              { supplier_code: 'SUP_B', rank: 2 },
            ]
          : [
              { supplier_code: 'SUP_B', rank: 1 },
              { supplier_code: 'SUP_A', rank: 2 },
            ],
      }));
      const flags = evaluateSupplierDominance(itemRankings, 20, threshold);
      expect(flags.length).toBe(1);
      expect(flags[0].affected_supplier_code).toBe('SUP_A');
    });

    it('should raise flag when supplier has 90% of L1 positions', () => {
      // 10 items, supplier A is L1 in 9 (90%)
      const itemRankings = Array.from({ length: 10 }, (_, i) => ({
        rfq_item_id: `item${i}`,
        rankings: i < 9
          ? [
              { supplier_code: 'SUP_A', rank: 1 },
              { supplier_code: 'SUP_B', rank: 2 },
            ]
          : [
              { supplier_code: 'SUP_B', rank: 1 },
              { supplier_code: 'SUP_A', rank: 2 },
            ],
      }));
      const flags = evaluateSupplierDominance(itemRankings, 10, threshold);
      expect(flags.length).toBe(1);
      expect(flags[0].flag_id).toBe('FLAG-04');
    });

    it('should handle zero total items', () => {
      const flags = evaluateSupplierDominance([], 0, threshold);
      expect(flags.length).toBe(0);
    });

    it('should handle tied L1 positions (both get counted)', () => {
      // 10 items, all have A and B tied at rank 1
      const itemRankings = Array.from({ length: 10 }, (_, i) => ({
        rfq_item_id: `item${i}`,
        rankings: [
          { supplier_code: 'SUP_A', rank: 1 },
          { supplier_code: 'SUP_B', rank: 1 },
        ],
      }));
      // Both have 100% L1 → both flagged
      const flags = evaluateSupplierDominance(itemRankings, 10, threshold);
      expect(flags.length).toBe(2);
    });
  });

  // ────────────────────────────────────────────────
  // FLAG-05: Late Revisions
  // ────────────────────────────────────────────────
  describe('FLAG-05: evaluateLateRevisions', () => {
    const countThreshold = 3;
    const windowPct = 20; // 20%

    // Bid window: 100 minutes
    const bidOpenAt = new Date('2025-01-01T10:00:00Z');
    const bidCloseAt = new Date('2025-01-01T11:40:00Z'); // 100 min later
    // Late start: bid_close - (100 * 20/100) = bid_close - 20 min = 11:20:00

    it('should raise flag when supplier has 4 bids after late start (> threshold of 3)', () => {
      const supplierBids = [
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:21:00Z') },
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:25:00Z') },
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:30:00Z') },
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:35:00Z') },
      ];
      const flags = evaluateLateRevisions(supplierBids, bidOpenAt, bidCloseAt, countThreshold, windowPct);
      expect(flags.length).toBe(1);
      expect(flags[0].flag_id).toBe('FLAG-05');
      expect(flags[0].affected_supplier_code).toBe('SUP01');
    });

    it('should NOT raise flag when supplier has exactly 3 bids after late start (> not >=)', () => {
      const supplierBids = [
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:21:00Z') },
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:25:00Z') },
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:30:00Z') },
      ];
      const flags = evaluateLateRevisions(supplierBids, bidOpenAt, bidCloseAt, countThreshold, windowPct);
      expect(flags.length).toBe(0);
    });

    it('should NOT raise flag when supplier has 0 bids after late start', () => {
      const supplierBids = [
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T10:30:00Z') },
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:00:00Z') },
      ];
      const flags = evaluateLateRevisions(supplierBids, bidOpenAt, bidCloseAt, countThreshold, windowPct);
      expect(flags.length).toBe(0);
    });

    it('should NOT count bids exactly at late start boundary (not strictly after)', () => {
      // Late start is 11:20:00. Bid at 11:20:00 should NOT count (> lateStart, not >=)
      const supplierBids = [
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:20:00Z') },
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:21:00Z') },
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:25:00Z') },
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:30:00Z') },
      ];
      const flags = evaluateLateRevisions(supplierBids, bidOpenAt, bidCloseAt, countThreshold, windowPct);
      // Only 3 bids strictly after 11:20:00 → not > 3 → no flag
      expect(flags.length).toBe(0);
    });

    it('should evaluate each supplier independently', () => {
      const supplierBids = [
        // SUP01: 4 late bids → flag
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:21:00Z') },
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:25:00Z') },
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:30:00Z') },
        { supplier_code: 'SUP01', submitted_at: new Date('2025-01-01T11:35:00Z') },
        // SUP02: 2 late bids → no flag
        { supplier_code: 'SUP02', submitted_at: new Date('2025-01-01T11:25:00Z') },
        { supplier_code: 'SUP02', submitted_at: new Date('2025-01-01T11:30:00Z') },
      ];
      const flags = evaluateLateRevisions(supplierBids, bidOpenAt, bidCloseAt, countThreshold, windowPct);
      expect(flags.length).toBe(1);
      expect(flags[0].affected_supplier_code).toBe('SUP01');
    });

    it('should handle zero-length bid window', () => {
      const sameTime = new Date('2025-01-01T10:00:00Z');
      const flags = evaluateLateRevisions(
        [{ supplier_code: 'SUP01', submitted_at: sameTime }],
        sameTime,
        sameTime,
        countThreshold,
        windowPct,
      );
      expect(flags.length).toBe(0);
    });

    it('should handle empty supplier bids', () => {
      const flags = evaluateLateRevisions([], bidOpenAt, bidCloseAt, countThreshold, windowPct);
      expect(flags.length).toBe(0);
    });
  });
});
