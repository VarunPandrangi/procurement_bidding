import { RFQStatus } from '../../shared/types/enums';

// Define all valid transitions: from → allowed "to" states
const VALID_TRANSITIONS: Record<RFQStatus, RFQStatus[]> = {
  [RFQStatus.DRAFT]: [RFQStatus.PUBLISHED],
  [RFQStatus.PUBLISHED]: [RFQStatus.ACTIVE],
  [RFQStatus.ACTIVE]: [RFQStatus.CLOSED],
  [RFQStatus.CLOSED]: [RFQStatus.AWARDED],
  [RFQStatus.AWARDED]: [],
};

export function canTransition(from: RFQStatus, to: RFQStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getValidTransitions(from: RFQStatus): RFQStatus[] {
  return VALID_TRANSITIONS[from] || [];
}

export function assertTransition(from: RFQStatus, to: RFQStatus): void {
  if (!canTransition(from, to)) {
    const allowed = getValidTransitions(from);
    const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)';
    throw new Error(
      `Invalid state transition: ${from} → ${to}. Allowed transitions from ${from}: ${allowedStr}`,
    );
  }
}
