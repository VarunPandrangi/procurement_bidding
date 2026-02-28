import {
  checkRevisionLimit,
  checkMinimumChange,
  checkCoolingTime,
  shouldTriggerAntiSnipe,
} from '../../src/modules/bidding/bid.service';

describe('Negotiation Bid Rules — Pure Function Tests', () => {
  describe('checkRevisionLimit (negotiation context)', () => {
    it('should return true when current revision is below negotiation max (2 < 3)', () => {
      expect(checkRevisionLimit(2, 3)).toBe(true);
    });

    it('should return true for first revision (0 < 3)', () => {
      expect(checkRevisionLimit(0, 3)).toBe(true);
    });

    it('should return false when current revision equals negotiation max', () => {
      expect(checkRevisionLimit(3, 3)).toBe(false);
    });

    it('should return false when current revision exceeds negotiation max', () => {
      expect(checkRevisionLimit(4, 3)).toBe(false);
    });

    it('should return false when max revisions is zero (no revisions allowed)', () => {
      expect(checkRevisionLimit(0, 0)).toBe(false);
    });
  });

  describe('checkMinimumChange (negotiation context)', () => {
    const oldItems = [
      { rfq_item_id: 'neg-item-1', unit_price: 500 },
      { rfq_item_id: 'neg-item-2', unit_price: 1000 },
    ];

    it('should pass when price change meets negotiation minimum percent', () => {
      const newItems = [
        { rfq_item_id: 'neg-item-1', unit_price: 475 },
        { rfq_item_id: 'neg-item-2', unit_price: 950 },
      ];
      const result = checkMinimumChange(newItems, oldItems, 2);
      expect(result.passed).toBe(true);
      expect(result.failedItems).toHaveLength(0);
    });

    it('should fail with failedItems when change is below negotiation minimum', () => {
      const newItems = [
        { rfq_item_id: 'neg-item-1', unit_price: 498 },
        { rfq_item_id: 'neg-item-2', unit_price: 950 },
      ];
      const result = checkMinimumChange(newItems, oldItems, 2);
      expect(result.passed).toBe(false);
      expect(result.failedItems).toHaveLength(1);
      expect(result.failedItems[0].rfq_item_id).toBe('neg-item-1');
      expect(result.failedItems[0].change_percent).toBeLessThan(2);
    });

    it('should fail when all prices are unchanged (no revision made)', () => {
      const newItems = [
        { rfq_item_id: 'neg-item-1', unit_price: 500 },
        { rfq_item_id: 'neg-item-2', unit_price: 1000 },
      ];
      const result = checkMinimumChange(newItems, oldItems, 2);
      expect(result.passed).toBe(false);
      expect(result.failedItems).toHaveLength(2);
      expect(result.failedItems[0].change_percent).toBe(0);
      expect(result.failedItems[1].change_percent).toBe(0);
    });

    it('should pass when price increases meet the minimum change threshold', () => {
      const newItems = [
        { rfq_item_id: 'neg-item-1', unit_price: 525 },
        { rfq_item_id: 'neg-item-2', unit_price: 1050 },
      ];
      const result = checkMinimumChange(newItems, oldItems, 2);
      expect(result.passed).toBe(true);
      expect(result.failedItems).toHaveLength(0);
    });

    it('should handle old price of 0 gracefully (100% change)', () => {
      const oldZero = [{ rfq_item_id: 'neg-item-1', unit_price: 0 }];
      const newItems = [{ rfq_item_id: 'neg-item-1', unit_price: 50 }];
      const result = checkMinimumChange(newItems, oldZero, 2);
      expect(result.passed).toBe(true);
    });
  });

  describe('checkCoolingTime (negotiation context)', () => {
    it('should pass when sufficient time has elapsed since last negotiation bid', () => {
      const lastSubmitted = new Date('2025-06-01T10:00:00Z');
      const now = new Date('2025-06-01T10:04:00Z');
      const result = checkCoolingTime(lastSubmitted, 3, now);
      expect(result.passed).toBe(true);
      expect(result.seconds_remaining).toBe(0);
    });

    it('should fail with seconds_remaining when still in cooling period', () => {
      const lastSubmitted = new Date('2025-06-01T10:00:00Z');
      const now = new Date('2025-06-01T10:01:00Z');
      const result = checkCoolingTime(lastSubmitted, 3, now);
      expect(result.passed).toBe(false);
      expect(result.seconds_remaining).toBe(120);
    });

    it('should pass at exact cooling boundary', () => {
      const lastSubmitted = new Date('2025-06-01T10:00:00Z');
      const now = new Date('2025-06-01T10:03:00Z');
      const result = checkCoolingTime(lastSubmitted, 3, now);
      expect(result.passed).toBe(true);
      expect(result.seconds_remaining).toBe(0);
    });

    it('should pass immediately when cooling time is zero', () => {
      const lastSubmitted = new Date('2025-06-01T10:00:00Z');
      const now = new Date('2025-06-01T10:00:01Z');
      const result = checkCoolingTime(lastSubmitted, 0, now);
      expect(result.passed).toBe(true);
      expect(result.seconds_remaining).toBe(0);
    });
  });

  describe('shouldTriggerAntiSnipe (negotiation context)', () => {
    it('should return true when negotiation bid arrives within the anti-snipe window', () => {
      const now = new Date('2025-06-01T14:00:00Z');
      const bidCloseAt = new Date('2025-06-01T14:04:00Z');
      expect(shouldTriggerAntiSnipe(bidCloseAt, now, 5)).toBe(true);
    });

    it('should return false when bid is outside the anti-snipe window', () => {
      const now = new Date('2025-06-01T14:00:00Z');
      const bidCloseAt = new Date('2025-06-01T14:10:00Z');
      expect(shouldTriggerAntiSnipe(bidCloseAt, now, 5)).toBe(false);
    });

    it('should return false when windowMinutes is 0 (feature disabled)', () => {
      const now = new Date('2025-06-01T14:00:00Z');
      const bidCloseAt = new Date('2025-06-01T14:01:00Z');
      expect(shouldTriggerAntiSnipe(bidCloseAt, now, 0)).toBe(false);
    });

    it('should return false when negotiation bidding has already closed', () => {
      const now = new Date('2025-06-01T14:06:00Z');
      const bidCloseAt = new Date('2025-06-01T14:05:00Z');
      expect(shouldTriggerAntiSnipe(bidCloseAt, now, 5)).toBe(false);
    });

    it('should return true at the exact boundary (remaining == window)', () => {
      const now = new Date('2025-06-01T14:00:00Z');
      const bidCloseAt = new Date('2025-06-01T14:05:00Z');
      expect(shouldTriggerAntiSnipe(bidCloseAt, now, 5)).toBe(true);
    });
  });
});
