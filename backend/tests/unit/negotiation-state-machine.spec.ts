import { NegotiationStatus } from '../../src/shared/types/enums';
import {
  canNegotiationTransition,
  getValidNegotiationTransitions,
  assertNegotiationTransition,
} from '../../src/modules/negotiation/negotiation-state-machine';

describe('Negotiation State Machine', () => {
  describe('canNegotiationTransition', () => {
    it('should allow DRAFT -> ACTIVE', () => {
      expect(canNegotiationTransition(NegotiationStatus.DRAFT, NegotiationStatus.ACTIVE)).toBe(true);
    });

    it('should allow ACTIVE -> CLOSED', () => {
      expect(canNegotiationTransition(NegotiationStatus.ACTIVE, NegotiationStatus.CLOSED)).toBe(true);
    });

    it('should allow CLOSED -> AWARDED', () => {
      expect(canNegotiationTransition(NegotiationStatus.CLOSED, NegotiationStatus.AWARDED)).toBe(true);
    });

    it('should NOT allow DRAFT -> CLOSED', () => {
      expect(canNegotiationTransition(NegotiationStatus.DRAFT, NegotiationStatus.CLOSED)).toBe(false);
    });

    it('should NOT allow DRAFT -> AWARDED', () => {
      expect(canNegotiationTransition(NegotiationStatus.DRAFT, NegotiationStatus.AWARDED)).toBe(false);
    });

    it('should NOT allow ACTIVE -> DRAFT', () => {
      expect(canNegotiationTransition(NegotiationStatus.ACTIVE, NegotiationStatus.DRAFT)).toBe(false);
    });

    it('should NOT allow ACTIVE -> AWARDED', () => {
      expect(canNegotiationTransition(NegotiationStatus.ACTIVE, NegotiationStatus.AWARDED)).toBe(false);
    });

    it('should NOT allow CLOSED -> DRAFT', () => {
      expect(canNegotiationTransition(NegotiationStatus.CLOSED, NegotiationStatus.DRAFT)).toBe(false);
    });

    it('should NOT allow CLOSED -> ACTIVE', () => {
      expect(canNegotiationTransition(NegotiationStatus.CLOSED, NegotiationStatus.ACTIVE)).toBe(false);
    });

    it('should NOT allow AWARDED -> DRAFT', () => {
      expect(canNegotiationTransition(NegotiationStatus.AWARDED, NegotiationStatus.DRAFT)).toBe(false);
    });

    it('should NOT allow AWARDED -> ACTIVE', () => {
      expect(canNegotiationTransition(NegotiationStatus.AWARDED, NegotiationStatus.ACTIVE)).toBe(false);
    });

    it('should NOT allow AWARDED -> CLOSED', () => {
      expect(canNegotiationTransition(NegotiationStatus.AWARDED, NegotiationStatus.CLOSED)).toBe(false);
    });

    it('should NOT allow self-transition DRAFT -> DRAFT', () => {
      expect(canNegotiationTransition(NegotiationStatus.DRAFT, NegotiationStatus.DRAFT)).toBe(false);
    });

    it('should NOT allow self-transition AWARDED -> AWARDED', () => {
      expect(canNegotiationTransition(NegotiationStatus.AWARDED, NegotiationStatus.AWARDED)).toBe(false);
    });
  });

  describe('getValidNegotiationTransitions', () => {
    it('should return [ACTIVE] for DRAFT', () => {
      expect(getValidNegotiationTransitions(NegotiationStatus.DRAFT)).toEqual([NegotiationStatus.ACTIVE]);
    });

    it('should return [CLOSED] for ACTIVE', () => {
      expect(getValidNegotiationTransitions(NegotiationStatus.ACTIVE)).toEqual([NegotiationStatus.CLOSED]);
    });

    it('should return [AWARDED] for CLOSED', () => {
      expect(getValidNegotiationTransitions(NegotiationStatus.CLOSED)).toEqual([NegotiationStatus.AWARDED]);
    });

    it('should return [] for AWARDED (terminal)', () => {
      expect(getValidNegotiationTransitions(NegotiationStatus.AWARDED)).toEqual([]);
    });
  });

  describe('assertNegotiationTransition', () => {
    it('should not throw for valid transition DRAFT -> ACTIVE', () => {
      expect(() => assertNegotiationTransition(NegotiationStatus.DRAFT, NegotiationStatus.ACTIVE)).not.toThrow();
    });

    it('should not throw for valid transition ACTIVE -> CLOSED', () => {
      expect(() => assertNegotiationTransition(NegotiationStatus.ACTIVE, NegotiationStatus.CLOSED)).not.toThrow();
    });

    it('should not throw for valid transition CLOSED -> AWARDED', () => {
      expect(() => assertNegotiationTransition(NegotiationStatus.CLOSED, NegotiationStatus.AWARDED)).not.toThrow();
    });

    it('should throw for invalid transition DRAFT -> CLOSED', () => {
      expect(() => assertNegotiationTransition(NegotiationStatus.DRAFT, NegotiationStatus.CLOSED)).toThrow(
        /Invalid negotiation state transition/,
      );
    });

    it('should throw for invalid transition ACTIVE -> DRAFT', () => {
      expect(() => assertNegotiationTransition(NegotiationStatus.ACTIVE, NegotiationStatus.DRAFT)).toThrow(
        /Invalid negotiation state transition/,
      );
    });

    it('should throw for invalid transition from terminal AWARDED', () => {
      expect(() => assertNegotiationTransition(NegotiationStatus.AWARDED, NegotiationStatus.DRAFT)).toThrow(
        /terminal state/,
      );
    });

    it('should include valid transitions in error message', () => {
      try {
        assertNegotiationTransition(NegotiationStatus.DRAFT, NegotiationStatus.CLOSED);
        fail('Expected to throw');
      } catch (err) {
        expect((err as Error).message).toContain('ACTIVE');
      }
    });

    it('should include from and to states in error message', () => {
      try {
        assertNegotiationTransition(NegotiationStatus.ACTIVE, NegotiationStatus.AWARDED);
        fail('Expected to throw');
      } catch (err) {
        const message = (err as Error).message;
        expect(message).toContain('ACTIVE');
        expect(message).toContain('AWARDED');
      }
    });
  });
});
