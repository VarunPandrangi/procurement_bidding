import {
  checkRevisionLimit,
  checkMinimumChange,
  checkCoolingTime,
} from '../../src/modules/bidding/bid.service';

describe('Revision Rules', () => {
  describe('Rule A - Revision Count', () => {
    it('should accept when revision_number < max_revisions', () => {
      expect(checkRevisionLimit(2, 5)).toBe(true);
    });

    it('should accept at exactly max_revisions - 1 (boundary)', () => {
      expect(checkRevisionLimit(4, 5)).toBe(true);
    });

    it('should reject when revision_number >= max_revisions', () => {
      expect(checkRevisionLimit(5, 5)).toBe(false);
    });

    it('should reject when revision_number exceeds max_revisions', () => {
      expect(checkRevisionLimit(6, 5)).toBe(false);
    });

    it('should reject when max_revisions = 0 (only initial submission allowed)', () => {
      expect(checkRevisionLimit(0, 0)).toBe(false);
    });

    it('should accept first revision with max_revisions = 1', () => {
      expect(checkRevisionLimit(0, 1)).toBe(true);
    });

    it('should reject second revision with max_revisions = 1', () => {
      expect(checkRevisionLimit(1, 1)).toBe(false);
    });
  });

  describe('Rule B - Minimum Change %', () => {
    const baseItems = [
      { rfq_item_id: 'item1', unit_price: 100 },
      { rfq_item_id: 'item2', unit_price: 200 },
    ];

    it('should accept when change >= min_change_percent', () => {
      const newItems = [
        { rfq_item_id: 'item1', unit_price: 98 }, // 2% change
        { rfq_item_id: 'item2', unit_price: 196 }, // 2% change
      ];
      const result = checkMinimumChange(newItems, baseItems, 1.0);
      expect(result.passed).toBe(true);
      expect(result.failedItems).toHaveLength(0);
    });

    it('should accept at exactly the threshold (boundary: 1.00% when min is 1.00%)', () => {
      const newItems = [
        { rfq_item_id: 'item1', unit_price: 99 }, // exactly 1% change
        { rfq_item_id: 'item2', unit_price: 198 }, // exactly 1% change
      ];
      const result = checkMinimumChange(newItems, baseItems, 1.0);
      expect(result.passed).toBe(true);
    });

    it('should reject when change < min_change_percent', () => {
      const newItems = [
        { rfq_item_id: 'item1', unit_price: 99.5 }, // 0.5% change
        { rfq_item_id: 'item2', unit_price: 200 }, // 0% change (not revised)
      ];
      const result = checkMinimumChange(newItems, baseItems, 1.0);
      expect(result.passed).toBe(false);
      expect(result.failedItems.some((fi) => fi.rfq_item_id === 'item1')).toBe(true);
    });

    it('should reject at 0.01% below threshold', () => {
      // min = 1%, try 0.99% change: 100 * 0.0099 = 0.99, so new price = 99.01
      const newItems = [
        { rfq_item_id: 'item1', unit_price: 99.01 }, // 0.99% change
        { rfq_item_id: 'item2', unit_price: 190 }, // 5% change (ok)
      ];
      const result = checkMinimumChange(newItems, baseItems, 1.0);
      expect(result.passed).toBe(false);
      expect(result.failedItems.some((fi) => fi.rfq_item_id === 'item1')).toBe(true);
    });

    it('should reject when same prices submitted (0% change = nothing revised)', () => {
      const result = checkMinimumChange(baseItems, baseItems, 1.0);
      expect(result.passed).toBe(false);
    });

    it('should compute change correctly for upward revision', () => {
      const newItems = [
        { rfq_item_id: 'item1', unit_price: 102 }, // 2% increase
        { rfq_item_id: 'item2', unit_price: 204 }, // 2% increase
      ];
      const result = checkMinimumChange(newItems, baseItems, 1.0);
      expect(result.passed).toBe(true);
    });

    it('should compute change correctly for downward revision', () => {
      const newItems = [
        { rfq_item_id: 'item1', unit_price: 98 }, // 2% decrease
        { rfq_item_id: 'item2', unit_price: 196 }, // 2% decrease
      ];
      const result = checkMinimumChange(newItems, baseItems, 1.0);
      expect(result.passed).toBe(true);
    });

    it('should check ALL items and reject if ANY changed item fails', () => {
      const newItems = [
        { rfq_item_id: 'item1', unit_price: 95 }, // 5% change (ok)
        { rfq_item_id: 'item2', unit_price: 199.5 }, // 0.25% change (not enough)
      ];
      const result = checkMinimumChange(newItems, baseItems, 1.0);
      expect(result.passed).toBe(false);
      expect(result.failedItems.some((fi) => fi.rfq_item_id === 'item2')).toBe(true);
    });

    it('should allow unchanged items when other items meet the threshold', () => {
      const newItems = [
        { rfq_item_id: 'item1', unit_price: 95 }, // 5% change (ok)
        { rfq_item_id: 'item2', unit_price: 200 }, // 0% (not revised, allowed)
      ];
      const result = checkMinimumChange(newItems, baseItems, 1.0);
      expect(result.passed).toBe(true);
    });

    it('should return specific failing item IDs', () => {
      const newItems = [
        { rfq_item_id: 'item1', unit_price: 99.8 }, // 0.2% change
        { rfq_item_id: 'item2', unit_price: 199.5 }, // 0.25% change
      ];
      const result = checkMinimumChange(newItems, baseItems, 1.0);
      expect(result.passed).toBe(false);
      expect(result.failedItems).toHaveLength(2);
      const itemIds = result.failedItems.map((fi) => fi.rfq_item_id);
      expect(itemIds).toContain('item1');
      expect(itemIds).toContain('item2');
    });
  });

  describe('Rule C - Cooling Time', () => {
    it('should accept when elapsed time >= cooling_time_minutes', () => {
      const lastSubmitted = new Date('2026-01-01T10:00:00Z');
      const now = new Date('2026-01-01T10:06:00Z'); // 6 minutes later
      const result = checkCoolingTime(lastSubmitted, 5, now);
      expect(result.passed).toBe(true);
      expect(result.seconds_remaining).toBe(0);
    });

    it('should accept at exactly the boundary (cooling_time_minutes elapsed)', () => {
      const lastSubmitted = new Date('2026-01-01T10:00:00Z');
      const now = new Date('2026-01-01T10:05:00Z'); // exactly 5 minutes later
      const result = checkCoolingTime(lastSubmitted, 5, now);
      expect(result.passed).toBe(true);
      expect(result.seconds_remaining).toBe(0);
    });

    it('should reject when elapsed time < cooling_time_minutes', () => {
      const lastSubmitted = new Date('2026-01-01T10:00:00Z');
      const now = new Date('2026-01-01T10:03:00Z'); // 3 minutes later
      const result = checkCoolingTime(lastSubmitted, 5, now);
      expect(result.passed).toBe(false);
      expect(result.seconds_remaining).toBe(120); // 2 minutes remaining
    });

    it('should return seconds_remaining in rejection', () => {
      const lastSubmitted = new Date('2026-01-01T10:00:00Z');
      const now = new Date('2026-01-01T10:04:30Z'); // 4.5 minutes later
      const result = checkCoolingTime(lastSubmitted, 5, now);
      expect(result.passed).toBe(false);
      expect(result.seconds_remaining).toBe(30);
    });

    it('should reject at 1 second before cooling_time_minutes', () => {
      const lastSubmitted = new Date('2026-01-01T10:00:00Z');
      const now = new Date('2026-01-01T10:04:59Z'); // 4 min 59 sec later
      const result = checkCoolingTime(lastSubmitted, 5, now);
      expect(result.passed).toBe(false);
      expect(result.seconds_remaining).toBe(1);
    });

    it('should accept well after cooling period', () => {
      const lastSubmitted = new Date('2026-01-01T10:00:00Z');
      const now = new Date('2026-01-01T11:00:00Z'); // 1 hour later
      const result = checkCoolingTime(lastSubmitted, 5, now);
      expect(result.passed).toBe(true);
      expect(result.seconds_remaining).toBe(0);
    });

    it('should reject immediately after submission', () => {
      const lastSubmitted = new Date('2026-01-01T10:00:00Z');
      const now = new Date('2026-01-01T10:00:01Z'); // 1 second later
      const result = checkCoolingTime(lastSubmitted, 5, now);
      expect(result.passed).toBe(false);
      expect(result.seconds_remaining).toBe(299); // 4 min 59 sec
    });
  });
});
