import {
  calculateResponseDiscipline,
  calculateRevisionBehavior,
  calculateWinVsDropout,
  calculatePostAwardAcceptance,
  calculateCompositeScore,
  deriveCredibilityClass,
} from '../../src/modules/credibility/credibility.service';
import { CredibilityClass } from '../../src/shared/types/enums';

describe('Credibility Score — Pure Functions', () => {
  // ── Dimension 1: Response Discipline ──

  describe('calculateResponseDiscipline', () => {
    it('should return 50 when zero assigned (neutral baseline)', () => {
      expect(calculateResponseDiscipline(0, 0)).toBe(50);
    });

    it('should return 100 when all assigned are accepted', () => {
      expect(calculateResponseDiscipline(5, 5)).toBe(100);
    });

    it('should return 50 when half are accepted', () => {
      expect(calculateResponseDiscipline(3, 6)).toBe(50);
    });

    it('should return 0 when none are accepted', () => {
      expect(calculateResponseDiscipline(0, 5)).toBe(0);
    });

    it('should handle 1 of 3 accepted', () => {
      expect(calculateResponseDiscipline(1, 3)).toBeCloseTo(33.33, 1);
    });
  });

  // ── Dimension 2: Revision Behavior ──

  describe('calculateRevisionBehavior', () => {
    it('should return 50 when no participations (neutral baseline)', () => {
      expect(calculateRevisionBehavior([])).toBe(50);
    });

    it('should return 100 when no revisions used and no late revisions', () => {
      const result = calculateRevisionBehavior([
        { revisionsUsed: 0, maxRevisions: 5, lateRevisions: 0 },
      ]);
      expect(result).toBe(100);
    });

    it('should return 0 when all revisions used and no late revisions', () => {
      const result = calculateRevisionBehavior([
        { revisionsUsed: 5, maxRevisions: 5, lateRevisions: 0 },
      ]);
      expect(result).toBe(0);
    });

    it('should handle maxRevisions = 0 (discipline = 1)', () => {
      const result = calculateRevisionBehavior([
        { revisionsUsed: 0, maxRevisions: 0, lateRevisions: 0 },
      ]);
      expect(result).toBe(100);
    });

    it('should apply late penalty correctly', () => {
      // discipline = 1 - (0/5) = 1
      // late_penalty = min(3/3, 1) * 0.5 = 0.5
      // rfq_score = max(0, 1 - 0.5) * 100 = 50
      const result = calculateRevisionBehavior([
        { revisionsUsed: 0, maxRevisions: 5, lateRevisions: 3 },
      ]);
      expect(result).toBe(50);
    });

    it('should cap late penalty at 0.5', () => {
      // lateRevisions = 10 → min(10/3, 1) * 0.5 = 0.5
      // discipline = 1, rfq_score = max(0, 1 - 0.5) * 100 = 50
      const result = calculateRevisionBehavior([
        { revisionsUsed: 0, maxRevisions: 5, lateRevisions: 10 },
      ]);
      expect(result).toBe(50);
    });

    it('should floor at 0 when discipline minus penalty is negative', () => {
      // discipline = 1 - (4/5) = 0.2
      // late_penalty = min(3/3, 1) * 0.5 = 0.5
      // rfq_score = max(0, 0.2 - 0.5) * 100 = 0
      const result = calculateRevisionBehavior([
        { revisionsUsed: 4, maxRevisions: 5, lateRevisions: 3 },
      ]);
      expect(result).toBe(0);
    });

    it('should average across multiple RFQs', () => {
      // RFQ 1: discipline = 1 - (0/5) = 1, no late → score = 100
      // RFQ 2: discipline = 1 - (5/5) = 0, no late → score = 0
      // Average = 50
      const result = calculateRevisionBehavior([
        { revisionsUsed: 0, maxRevisions: 5, lateRevisions: 0 },
        { revisionsUsed: 5, maxRevisions: 5, lateRevisions: 0 },
      ]);
      expect(result).toBe(50);
    });
  });

  // ── Dimension 3: Win vs Dropout ──

  describe('calculateWinVsDropout', () => {
    it('should return 50 when zero L1 count (neutral baseline)', () => {
      expect(calculateWinVsDropout(0, 0)).toBe(50);
    });

    it('should return 100 when all L1 were awarded', () => {
      expect(calculateWinVsDropout(3, 3)).toBe(100);
    });

    it('should return 0 when no L1 were awarded', () => {
      expect(calculateWinVsDropout(3, 0)).toBe(0);
    });

    it('should return 50 when half of L1 were awarded', () => {
      expect(calculateWinVsDropout(4, 2)).toBe(50);
    });
  });

  // ── Dimension 4: Post-Award Acceptance ──

  describe('calculatePostAwardAcceptance', () => {
    it('should return 50 when zero awarded count (neutral baseline)', () => {
      expect(calculatePostAwardAcceptance(0, 0)).toBe(50);
    });

    it('should return 100 when all awarded were fulfilled', () => {
      expect(calculatePostAwardAcceptance(2, 2)).toBe(100);
    });

    it('should return 0 when none were fulfilled', () => {
      expect(calculatePostAwardAcceptance(2, 0)).toBe(0);
    });

    it('should return 50 when half fulfilled', () => {
      expect(calculatePostAwardAcceptance(4, 2)).toBe(50);
    });
  });

  // ── Composite Score ──

  describe('calculateCompositeScore', () => {
    it('should return 100 when all scores are 100', () => {
      expect(calculateCompositeScore(100, 100, 100, 100)).toBe(100);
    });

    it('should return 50 when all scores are 50', () => {
      expect(calculateCompositeScore(50, 50, 50, 50)).toBe(50);
    });

    it('should return 0 when all scores are 0', () => {
      expect(calculateCompositeScore(0, 0, 0, 0)).toBe(0);
    });

    it('should return 50 for mixed scores (80+60+40+20)/4', () => {
      expect(calculateCompositeScore(80, 60, 40, 20)).toBe(50);
    });

    it('should round to 2 decimal places', () => {
      // (33.33 * 0.25) + (66.67 * 0.25) + (50 * 0.25) + (50 * 0.25)
      // = 8.3325 + 16.6675 + 12.5 + 12.5 = 50.0
      expect(calculateCompositeScore(33.33, 66.67, 50, 50)).toBe(50);
    });
  });

  // ── Credibility Classification ──

  describe('deriveCredibilityClass', () => {
    it('should return EXCELLENT for score 100', () => {
      expect(deriveCredibilityClass(100)).toBe(CredibilityClass.EXCELLENT);
    });

    it('should return EXCELLENT for exactly 80.0', () => {
      expect(deriveCredibilityClass(80.0)).toBe(CredibilityClass.EXCELLENT);
    });

    it('should return STABLE for 79.9 (boundary)', () => {
      expect(deriveCredibilityClass(79.9)).toBe(CredibilityClass.STABLE);
    });

    it('should return STABLE for exactly 50.0', () => {
      expect(deriveCredibilityClass(50.0)).toBe(CredibilityClass.STABLE);
    });

    it('should return RISKY for 49.9 (boundary)', () => {
      expect(deriveCredibilityClass(49.9)).toBe(CredibilityClass.RISKY);
    });

    it('should return RISKY for score 0', () => {
      expect(deriveCredibilityClass(0)).toBe(CredibilityClass.RISKY);
    });
  });

  // ── Combined end-to-end pure function tests ──

  describe('End-to-end composite + classification', () => {
    it('All 100 → composite 100 → EXCELLENT', () => {
      const composite = calculateCompositeScore(100, 100, 100, 100);
      expect(composite).toBe(100);
      expect(deriveCredibilityClass(composite)).toBe(CredibilityClass.EXCELLENT);
    });

    it('All 50 → composite 50 → STABLE', () => {
      const composite = calculateCompositeScore(50, 50, 50, 50);
      expect(composite).toBe(50);
      expect(deriveCredibilityClass(composite)).toBe(CredibilityClass.STABLE);
    });

    it('All 0 → composite 0 → RISKY', () => {
      const composite = calculateCompositeScore(0, 0, 0, 0);
      expect(composite).toBe(0);
      expect(deriveCredibilityClass(composite)).toBe(CredibilityClass.RISKY);
    });

    it('Mixed (80+60+40+20)/4 = 50 → STABLE', () => {
      const composite = calculateCompositeScore(80, 60, 40, 20);
      expect(composite).toBe(50);
      expect(deriveCredibilityClass(composite)).toBe(CredibilityClass.STABLE);
    });

    it('Scores producing exactly 80.0 → EXCELLENT', () => {
      // 80 * 4 / 4 = 80
      const composite = calculateCompositeScore(80, 80, 80, 80);
      expect(composite).toBe(80);
      expect(deriveCredibilityClass(composite)).toBe(CredibilityClass.EXCELLENT);
    });

    it('Scores producing 79.9 → STABLE (not EXCELLENT)', () => {
      // Need composite = 79.9 → (79.9 * 4) = 319.6 → each = 79.9
      const composite = calculateCompositeScore(79.9, 79.9, 79.9, 79.9);
      expect(composite).toBe(79.9);
      expect(deriveCredibilityClass(composite)).toBe(CredibilityClass.STABLE);
    });

    it('zero_assigned: score_1 = 50 (neutral), not 0', () => {
      const score1 = calculateResponseDiscipline(0, 0);
      expect(score1).toBe(50);
      // With other neutral defaults: composite = (50+50+50+50)/4 = 50 → STABLE
      const composite = calculateCompositeScore(score1, 50, 50, 50);
      expect(composite).toBe(50);
      expect(deriveCredibilityClass(composite)).toBe(CredibilityClass.STABLE);
    });
  });
});
