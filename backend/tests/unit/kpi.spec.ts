import {
  calculateCV,
  calculateSavingsPct,
  calculateParticipationRatio,
  calculateCycleTimeHours,
} from '../../src/modules/kpi/kpi.service';

describe('KPI pure calculation functions', () => {
  describe('calculateCV', () => {
    it('should calculate CV for [100, 110, 120]: mean=110, std≈8.165, cv≈7.42', () => {
      const cv = calculateCV([100, 110, 120]);
      expect(cv).not.toBeNull();
      // mean = 110, variance = ((100-110)^2 + (110-110)^2 + (120-110)^2) / 3 = 200/3 ≈ 66.667
      // std = sqrt(66.667) ≈ 8.165
      // cv = 8.165 / 110 * 100 ≈ 7.42
      expect(cv!).toBeGreaterThanOrEqual(7.4);
      expect(cv!).toBeLessThanOrEqual(7.5);
    });

    it('should return CV=0 for identical prices [100, 100]', () => {
      const cv = calculateCV([100, 100]);
      expect(cv).toBe(0);
    });

    it('should return null for single price (need >= 2 bidders)', () => {
      const cv = calculateCV([100]);
      expect(cv).toBeNull();
    });

    it('should return null for empty array', () => {
      const cv = calculateCV([]);
      expect(cv).toBeNull();
    });

    it('should correctly calculate CV for [50, 150]', () => {
      const cv = calculateCV([50, 150]);
      expect(cv).not.toBeNull();
      // mean = 100, variance = ((50-100)^2 + (150-100)^2) / 2 = 2500
      // std = 50
      // cv = 50 / 100 * 100 = 50
      expect(cv!).toBeCloseTo(50, 1);
    });

    it('should handle large price arrays', () => {
      const cv = calculateCV([100, 105, 110, 95, 100]);
      expect(cv).not.toBeNull();
      expect(cv!).toBeGreaterThan(0);
    });
  });

  describe('calculateSavingsPct', () => {
    it('should return 20% savings: last_price=100, awarded=80, qty=10', () => {
      const savings = calculateSavingsPct([
        { last_price: 100, quantity: 10, awarded_unit_price: 80 },
      ]);
      expect(savings).toBe(20);
    });

    it('should return null for empty items array', () => {
      const savings = calculateSavingsPct([]);
      expect(savings).toBeNull();
    });

    it('should handle multiple items correctly', () => {
      const savings = calculateSavingsPct([
        { last_price: 100, quantity: 10, awarded_unit_price: 80 }, // ref=1000, awarded=800
        { last_price: 200, quantity: 5, awarded_unit_price: 150 }, // ref=1000, awarded=750
      ]);
      // total ref = 2000, total awarded = 1550
      // savings = (2000 - 1550) / 2000 * 100 = 22.5
      expect(savings).toBe(22.5);
    });

    it('should return 0% when awarded equals last_price', () => {
      const savings = calculateSavingsPct([
        { last_price: 100, quantity: 10, awarded_unit_price: 100 },
      ]);
      expect(savings).toBe(0);
    });

    it('should return negative savings when awarded exceeds last_price', () => {
      const savings = calculateSavingsPct([
        { last_price: 100, quantity: 10, awarded_unit_price: 120 },
      ]);
      expect(savings).toBe(-20);
    });

    it('should return null when reference total is 0', () => {
      const savings = calculateSavingsPct([
        { last_price: 0, quantity: 10, awarded_unit_price: 80 },
      ]);
      expect(savings).toBeNull();
    });
  });

  describe('calculateParticipationRatio', () => {
    it('should return 60% for 3 accepted / 5 assigned', () => {
      const ratio = calculateParticipationRatio(3, 5);
      expect(ratio).toBe(60);
    });

    it('should return 100% for 5 accepted / 5 assigned', () => {
      const ratio = calculateParticipationRatio(5, 5);
      expect(ratio).toBe(100);
    });

    it('should return 0% for 0 accepted / 5 assigned', () => {
      const ratio = calculateParticipationRatio(0, 5);
      expect(ratio).toBe(0);
    });

    it('should return null for 0 assigned', () => {
      const ratio = calculateParticipationRatio(0, 0);
      expect(ratio).toBeNull();
    });
  });

  describe('calculateCycleTimeHours', () => {
    it('should return 24 hours for 1 day apart', () => {
      const published = new Date('2026-01-01T00:00:00Z');
      const awarded = new Date('2026-01-02T00:00:00Z');
      const hours = calculateCycleTimeHours(published, awarded);
      expect(hours).toBe(24);
    });

    it('should return 0 for same timestamp', () => {
      const ts = new Date('2026-01-01T00:00:00Z');
      const hours = calculateCycleTimeHours(ts, ts);
      expect(hours).toBe(0);
    });

    it('should return 1 hour for 1 hour apart', () => {
      const published = new Date('2026-01-01T10:00:00Z');
      const awarded = new Date('2026-01-01T11:00:00Z');
      const hours = calculateCycleTimeHours(published, awarded);
      expect(hours).toBe(1);
    });

    it('should handle fractional hours correctly', () => {
      const published = new Date('2026-01-01T00:00:00Z');
      const awarded = new Date('2026-01-01T01:30:00Z');
      const hours = calculateCycleTimeHours(published, awarded);
      expect(hours).toBe(1.5);
    });
  });
});
