import {
  checkRevisionLimit,
  checkMinimumChange,
  checkCoolingTime,
} from '../../src/modules/bidding/bid.service';

describe('Bid Rules — Pure Function Tests', () => {
  describe('checkRevisionLimit', () => {
    it('should return true when current revision is below max', () => {
      expect(checkRevisionLimit(0, 5)).toBe(true);
      expect(checkRevisionLimit(4, 5)).toBe(true);
    });

    it('should return false when current revision equals max', () => {
      expect(checkRevisionLimit(5, 5)).toBe(false);
    });

    it('should return false when current revision exceeds max', () => {
      expect(checkRevisionLimit(6, 5)).toBe(false);
    });
  });

  describe('checkMinimumChange', () => {
    const oldItems = [
      { rfq_item_id: 'item-1', unit_price: 100 },
      { rfq_item_id: 'item-2', unit_price: 200 },
    ];

    it('should pass when all items change by at least the minimum %', () => {
      const newItems = [
        { rfq_item_id: 'item-1', unit_price: 95 }, // 5% change
        { rfq_item_id: 'item-2', unit_price: 190 }, // 5% change
      ];
      const result = checkMinimumChange(newItems, oldItems, 1);
      expect(result.passed).toBe(true);
      expect(result.failedItems).toHaveLength(0);
    });

    it('should fail when a changed item is below minimum %', () => {
      const newItems = [
        { rfq_item_id: 'item-1', unit_price: 99.5 }, // 0.5% change
        { rfq_item_id: 'item-2', unit_price: 190 }, // 5% change
      ];
      const result = checkMinimumChange(newItems, oldItems, 1);
      expect(result.passed).toBe(false);
      expect(result.failedItems).toHaveLength(1);
      expect(result.failedItems[0].rfq_item_id).toBe('item-1');
    });

    it('should fail when no items have changed at all', () => {
      const newItems = [
        { rfq_item_id: 'item-1', unit_price: 100 },
        { rfq_item_id: 'item-2', unit_price: 200 },
      ];
      const result = checkMinimumChange(newItems, oldItems, 1);
      expect(result.passed).toBe(false);
      // When no items changed, all items are reported as failed
      expect(result.failedItems).toHaveLength(2);
    });

    it('should handle old price of 0 with 100% change', () => {
      const oldZero = [{ rfq_item_id: 'item-1', unit_price: 0 }];
      const newItems = [{ rfq_item_id: 'item-1', unit_price: 10 }];
      const result = checkMinimumChange(newItems, oldZero, 1);
      expect(result.passed).toBe(true);
    });
  });

  describe('checkCoolingTime', () => {
    it('should pass when cooling time has elapsed', () => {
      const lastSubmitted = new Date('2025-01-15T12:00:00Z');
      const now = new Date('2025-01-15T12:06:00Z'); // 6 min later
      const result = checkCoolingTime(lastSubmitted, 5, now);
      expect(result.passed).toBe(true);
      expect(result.seconds_remaining).toBe(0);
    });

    it('should fail when within cooling time', () => {
      const lastSubmitted = new Date('2025-01-15T12:00:00Z');
      const now = new Date('2025-01-15T12:03:00Z'); // 3 min later, need 5
      const result = checkCoolingTime(lastSubmitted, 5, now);
      expect(result.passed).toBe(false);
      expect(result.seconds_remaining).toBe(120); // 2 min = 120 sec
    });

    it('should pass when exactly at boundary', () => {
      const lastSubmitted = new Date('2025-01-15T12:00:00Z');
      const now = new Date('2025-01-15T12:05:00Z'); // exactly 5 min later
      const result = checkCoolingTime(lastSubmitted, 5, now);
      expect(result.passed).toBe(true);
      expect(result.seconds_remaining).toBe(0);
    });

    it('should handle zero cooling time', () => {
      const lastSubmitted = new Date('2025-01-15T12:00:00Z');
      const now = new Date('2025-01-15T12:00:01Z');
      const result = checkCoolingTime(lastSubmitted, 0, now);
      expect(result.passed).toBe(true);
    });
  });
});
