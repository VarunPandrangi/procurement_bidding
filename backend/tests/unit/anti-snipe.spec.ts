import { shouldTriggerAntiSnipe } from '../../src/modules/bidding/bid.service';

describe('Anti-Snipe — shouldTriggerAntiSnipe', () => {
  it('should return true when bid is within the anti-snipe window', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    const bidCloseAt = new Date('2025-01-15T12:04:00Z'); // 4 min remaining
    const windowMinutes = 5;

    expect(shouldTriggerAntiSnipe(bidCloseAt, now, windowMinutes)).toBe(true);
  });

  it('should return false when bid is outside the anti-snipe window', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    const bidCloseAt = new Date('2025-01-15T12:10:00Z'); // 10 min remaining
    const windowMinutes = 5;

    expect(shouldTriggerAntiSnipe(bidCloseAt, now, windowMinutes)).toBe(false);
  });

  it('should return true at the exact boundary (remaining == window)', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    const bidCloseAt = new Date('2025-01-15T12:05:00Z'); // exactly 5 min remaining
    const windowMinutes = 5;

    // remaining (300000ms) <= window (300000ms) AND remaining > 0 → true
    expect(shouldTriggerAntiSnipe(bidCloseAt, now, windowMinutes)).toBe(true);
  });

  it('should return false when window is zero', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    const bidCloseAt = new Date('2025-01-15T12:01:00Z');
    const windowMinutes = 0;

    expect(shouldTriggerAntiSnipe(bidCloseAt, now, windowMinutes)).toBe(false);
  });

  it('should return false when bidding has already closed (now >= bidCloseAt)', () => {
    const now = new Date('2025-01-15T12:06:00Z');
    const bidCloseAt = new Date('2025-01-15T12:05:00Z');
    const windowMinutes = 5;

    expect(shouldTriggerAntiSnipe(bidCloseAt, now, windowMinutes)).toBe(false);
  });

  it('should return false when now equals bidCloseAt exactly', () => {
    const ts = new Date('2025-01-15T12:05:00Z');
    const windowMinutes = 5;

    // remaining = 0, which is not > 0 → false
    expect(shouldTriggerAntiSnipe(ts, ts, windowMinutes)).toBe(false);
  });

  it('should return true with 1 second remaining inside a 1-minute window', () => {
    const now = new Date('2025-01-15T12:04:59Z');
    const bidCloseAt = new Date('2025-01-15T12:05:00Z'); // 1 sec remaining
    const windowMinutes = 1;

    expect(shouldTriggerAntiSnipe(bidCloseAt, now, windowMinutes)).toBe(true);
  });

  it('should return false with negative window minutes', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    const bidCloseAt = new Date('2025-01-15T12:05:00Z');

    expect(shouldTriggerAntiSnipe(bidCloseAt, now, -1)).toBe(false);
  });
});
