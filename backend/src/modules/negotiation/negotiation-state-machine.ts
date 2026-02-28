import { NegotiationStatus } from '../../shared/types/enums';

// Define all valid transitions: from → allowed "to" states
const VALID_TRANSITIONS: Record<NegotiationStatus, NegotiationStatus[]> = {
  [NegotiationStatus.DRAFT]: [NegotiationStatus.ACTIVE],
  [NegotiationStatus.ACTIVE]: [NegotiationStatus.CLOSED],
  [NegotiationStatus.CLOSED]: [NegotiationStatus.AWARDED],
  [NegotiationStatus.AWARDED]: [],
};

export function canNegotiationTransition(
  from: NegotiationStatus,
  to: NegotiationStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getValidNegotiationTransitions(
  from: NegotiationStatus,
): NegotiationStatus[] {
  return VALID_TRANSITIONS[from] || [];
}

export function assertNegotiationTransition(
  from: NegotiationStatus,
  to: NegotiationStatus,
): void {
  if (!canNegotiationTransition(from, to)) {
    const allowed = getValidNegotiationTransitions(from);
    const allowedStr =
      allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)';
    throw new Error(
      `Invalid negotiation state transition: ${from} → ${to}. Allowed transitions from ${from}: ${allowedStr}`,
    );
  }
}
