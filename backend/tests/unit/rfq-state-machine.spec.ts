import { RFQStatus } from '../../src/shared/types/enums';
import { canTransition, getValidTransitions, assertTransition } from '../../src/modules/rfq/rfq-state-machine';

describe('RFQ State Machine', () => {
  describe('canTransition', () => {
    // Valid transitions
    it('should allow DRAFT → PUBLISHED', () => {
      expect(canTransition(RFQStatus.DRAFT, RFQStatus.PUBLISHED)).toBe(true);
    });

    it('should allow PUBLISHED → ACTIVE', () => {
      expect(canTransition(RFQStatus.PUBLISHED, RFQStatus.ACTIVE)).toBe(true);
    });

    it('should allow ACTIVE → CLOSED', () => {
      expect(canTransition(RFQStatus.ACTIVE, RFQStatus.CLOSED)).toBe(true);
    });

    it('should allow CLOSED → AWARDED', () => {
      expect(canTransition(RFQStatus.CLOSED, RFQStatus.AWARDED)).toBe(true);
    });

    // Invalid transitions from DRAFT
    it('should NOT allow DRAFT → ACTIVE', () => {
      expect(canTransition(RFQStatus.DRAFT, RFQStatus.ACTIVE)).toBe(false);
    });

    it('should NOT allow DRAFT → CLOSED', () => {
      expect(canTransition(RFQStatus.DRAFT, RFQStatus.CLOSED)).toBe(false);
    });

    it('should NOT allow DRAFT → AWARDED', () => {
      expect(canTransition(RFQStatus.DRAFT, RFQStatus.AWARDED)).toBe(false);
    });

    // Invalid transitions from PUBLISHED
    it('should NOT allow PUBLISHED → DRAFT', () => {
      expect(canTransition(RFQStatus.PUBLISHED, RFQStatus.DRAFT)).toBe(false);
    });

    it('should NOT allow PUBLISHED → CLOSED', () => {
      expect(canTransition(RFQStatus.PUBLISHED, RFQStatus.CLOSED)).toBe(false);
    });

    it('should NOT allow PUBLISHED → AWARDED', () => {
      expect(canTransition(RFQStatus.PUBLISHED, RFQStatus.AWARDED)).toBe(false);
    });

    // Invalid transitions from ACTIVE
    it('should NOT allow ACTIVE → DRAFT', () => {
      expect(canTransition(RFQStatus.ACTIVE, RFQStatus.DRAFT)).toBe(false);
    });

    it('should NOT allow ACTIVE → PUBLISHED', () => {
      expect(canTransition(RFQStatus.ACTIVE, RFQStatus.PUBLISHED)).toBe(false);
    });

    it('should NOT allow ACTIVE → AWARDED', () => {
      expect(canTransition(RFQStatus.ACTIVE, RFQStatus.AWARDED)).toBe(false);
    });

    // Invalid transitions from CLOSED
    it('should NOT allow CLOSED → DRAFT', () => {
      expect(canTransition(RFQStatus.CLOSED, RFQStatus.DRAFT)).toBe(false);
    });

    it('should NOT allow CLOSED → PUBLISHED', () => {
      expect(canTransition(RFQStatus.CLOSED, RFQStatus.PUBLISHED)).toBe(false);
    });

    it('should NOT allow CLOSED → ACTIVE', () => {
      expect(canTransition(RFQStatus.CLOSED, RFQStatus.ACTIVE)).toBe(false);
    });

    // AWARDED is terminal — no transitions allowed
    it('should NOT allow AWARDED → DRAFT', () => {
      expect(canTransition(RFQStatus.AWARDED, RFQStatus.DRAFT)).toBe(false);
    });

    it('should NOT allow AWARDED → PUBLISHED', () => {
      expect(canTransition(RFQStatus.AWARDED, RFQStatus.PUBLISHED)).toBe(false);
    });

    it('should NOT allow AWARDED → ACTIVE', () => {
      expect(canTransition(RFQStatus.AWARDED, RFQStatus.ACTIVE)).toBe(false);
    });

    it('should NOT allow AWARDED → CLOSED', () => {
      expect(canTransition(RFQStatus.AWARDED, RFQStatus.CLOSED)).toBe(false);
    });

    // Self-transitions
    it('should NOT allow DRAFT → DRAFT', () => {
      expect(canTransition(RFQStatus.DRAFT, RFQStatus.DRAFT)).toBe(false);
    });

    it('should NOT allow PUBLISHED → PUBLISHED', () => {
      expect(canTransition(RFQStatus.PUBLISHED, RFQStatus.PUBLISHED)).toBe(false);
    });
  });

  describe('getValidTransitions', () => {
    it('should return [PUBLISHED] for DRAFT', () => {
      expect(getValidTransitions(RFQStatus.DRAFT)).toEqual([RFQStatus.PUBLISHED]);
    });

    it('should return [ACTIVE] for PUBLISHED', () => {
      expect(getValidTransitions(RFQStatus.PUBLISHED)).toEqual([RFQStatus.ACTIVE]);
    });

    it('should return [CLOSED] for ACTIVE', () => {
      expect(getValidTransitions(RFQStatus.ACTIVE)).toEqual([RFQStatus.CLOSED]);
    });

    it('should return [AWARDED] for CLOSED', () => {
      expect(getValidTransitions(RFQStatus.CLOSED)).toEqual([RFQStatus.AWARDED]);
    });

    it('should return [] for AWARDED (terminal)', () => {
      expect(getValidTransitions(RFQStatus.AWARDED)).toEqual([]);
    });
  });

  describe('assertTransition', () => {
    it('should not throw for valid transition DRAFT → PUBLISHED', () => {
      expect(() => assertTransition(RFQStatus.DRAFT, RFQStatus.PUBLISHED)).not.toThrow();
    });

    it('should not throw for valid transition PUBLISHED → ACTIVE', () => {
      expect(() => assertTransition(RFQStatus.PUBLISHED, RFQStatus.ACTIVE)).not.toThrow();
    });

    it('should throw for invalid transition DRAFT → ACTIVE', () => {
      expect(() => assertTransition(RFQStatus.DRAFT, RFQStatus.ACTIVE)).toThrow(
        /Invalid state transition/,
      );
    });

    it('should throw for invalid transition PUBLISHED → DRAFT', () => {
      expect(() => assertTransition(RFQStatus.PUBLISHED, RFQStatus.DRAFT)).toThrow(
        /Invalid state transition/,
      );
    });

    it('should throw for invalid transition from terminal AWARDED', () => {
      expect(() => assertTransition(RFQStatus.AWARDED, RFQStatus.DRAFT)).toThrow(
        /terminal state/,
      );
    });

    it('should include valid transitions in error message', () => {
      try {
        assertTransition(RFQStatus.DRAFT, RFQStatus.CLOSED);
        fail('Expected to throw');
      } catch (err) {
        expect((err as Error).message).toContain('PUBLISHED');
      }
    });
  });
});
