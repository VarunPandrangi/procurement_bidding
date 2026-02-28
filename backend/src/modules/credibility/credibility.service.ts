import { getDb } from '../../config/database';
import { CredibilityClass, AuditEventType } from '../../shared/types/enums';
import { logger } from '../../config/logger';

// ── Types ──

interface RfqParticipation {
  revisionsUsed: number;
  maxRevisions: number;
  lateRevisions: number;
}

// ── Pure calculation functions (exported for unit testing) ──

/**
 * Dimension 1: Response Discipline (weight 25%)
 * assigned = 0 → 50 (neutral baseline)
 * otherwise: (accepted / assigned) * 100
 */
export function calculateResponseDiscipline(accepted: number, assigned: number): number {
  if (assigned === 0) return 50;
  return (accepted / assigned) * 100;
}

/**
 * Dimension 2: Revision Behavior (weight 25%)
 * Per RFQ:
 *   discipline = maxRevisions > 0 ? 1 - (revisionsUsed / maxRevisions) : 1
 *   late_penalty = min(lateRevisions / 3, 1) * 0.5
 *   rfq_score = max(0, discipline - late_penalty) * 100
 * Average across all participated RFQs, or 50 if none.
 */
export function calculateRevisionBehavior(rfqParticipations: RfqParticipation[]): number {
  if (rfqParticipations.length === 0) return 50;

  let totalScore = 0;

  for (const p of rfqParticipations) {
    const discipline = p.maxRevisions > 0 ? 1 - p.revisionsUsed / p.maxRevisions : 1;
    const latePenalty = Math.min(p.lateRevisions / 3, 1) * 0.5;
    const rfqScore = Math.max(0, discipline - latePenalty) * 100;
    totalScore += rfqScore;
  }

  return totalScore / rfqParticipations.length;
}

/**
 * Dimension 3: Win vs Dropout (weight 25%)
 * l1Count = 0 → 50 (neutral baseline)
 * otherwise: (l1Awarded / l1Count) * 100
 */
export function calculateWinVsDropout(l1Count: number, l1Awarded: number): number {
  if (l1Count === 0) return 50;
  return (l1Awarded / l1Count) * 100;
}

/**
 * Dimension 4: Post-Award Acceptance (weight 25%)
 * awardedCount = 0 → 50 (neutral baseline)
 * otherwise: (fulfilledCount / awardedCount) * 100
 */
export function calculatePostAwardAcceptance(awardedCount: number, fulfilledCount: number): number {
  if (awardedCount === 0) return 50;
  return (fulfilledCount / awardedCount) * 100;
}

/**
 * Composite score = weighted average of 4 dimensions (each 25%)
 * Returns rounded to 2 decimal places to match DECIMAL(5,2).
 */
export function calculateCompositeScore(
  score1: number,
  score2: number,
  score3: number,
  score4: number,
): number {
  const raw = score1 * 0.25 + score2 * 0.25 + score3 * 0.25 + score4 * 0.25;
  return parseFloat(raw.toFixed(2));
}

/**
 * Credibility classification based on composite score.
 * >= 80 → EXCELLENT
 * >= 50 → STABLE
 * < 50  → RISKY
 */
export function deriveCredibilityClass(compositeScore: number): CredibilityClass {
  if (compositeScore >= 80) return CredibilityClass.EXCELLENT;
  if (compositeScore >= 50) return CredibilityClass.STABLE;
  return CredibilityClass.RISKY;
}

// ── Config loader ──

async function loadLateRevisionWindowPct(): Promise<number> {
  const db = getDb();
  const row = await db('system_config')
    .where('key', 'flag_late_revision_window_percent')
    .select('value')
    .first();
  return row ? parseFloat(row.value) : 20;
}

// ── Main orchestrator (DB-dependent) ──

/**
 * Recalculates the credibility score for a supplier from scratch.
 * Queries all historical RFQ participation data and updates the suppliers table.
 * Idempotent — safe to call concurrently (last writer wins with same result).
 */
export async function calculateCredibilityScore(supplierId: string): Promise<void> {
  const db = getDb();

  // ── Dimension 1: Response Discipline ──
  const assignmentCounts = await db('rfq_suppliers')
    .where('supplier_id', supplierId)
    .select(
      db.raw('COUNT(*) as assigned'),
      db.raw("COUNT(*) FILTER (WHERE status = 'ACCEPTED') as accepted"),
    )
    .first();

  const assigned = parseInt(assignmentCounts.assigned as string, 10);
  const accepted = parseInt(assignmentCounts.accepted as string, 10);
  const score1 = calculateResponseDiscipline(accepted, assigned);

  // ── Dimension 2: Revision Behavior ──
  // Get all RFQs where this supplier accepted
  const acceptedRfqs = await db('rfq_suppliers')
    .join('rfqs', 'rfq_suppliers.rfq_id', 'rfqs.id')
    .where({ 'rfq_suppliers.supplier_id': supplierId, 'rfq_suppliers.status': 'ACCEPTED' })
    .select('rfqs.id as rfq_id', 'rfqs.max_revisions', 'rfqs.bid_open_at', 'rfqs.bid_close_at');

  const lateWindowPct = await loadLateRevisionWindowPct();

  const rfqParticipations: RfqParticipation[] = [];

  for (const rfq of acceptedRfqs) {
    // Count revisions used (revision_number > 0)
    const revisionResult = await db('bids')
      .where({ supplier_id: supplierId, rfq_id: rfq.rfq_id })
      .where('revision_number', '>', 0)
      .count('* as cnt')
      .first();
    const revisionsUsed = parseInt((revisionResult?.cnt as string) || '0', 10);

    // Count late revisions — bids submitted in the final windowPct% of the bid window
    let lateRevisions = 0;
    if (rfq.bid_open_at && rfq.bid_close_at) {
      const openAt = new Date(rfq.bid_open_at);
      const closeAt = new Date(rfq.bid_close_at);
      const windowDurationMs = closeAt.getTime() - openAt.getTime();

      if (windowDurationMs > 0) {
        const lateWindowMs = windowDurationMs * (lateWindowPct / 100);
        const lateStart = new Date(closeAt.getTime() - lateWindowMs);

        const lateResult = await db('bids')
          .where({ supplier_id: supplierId, rfq_id: rfq.rfq_id })
          .where('submitted_at', '>', lateStart)
          .count('* as cnt')
          .first();
        lateRevisions = parseInt((lateResult?.cnt as string) || '0', 10);
      }
    }

    rfqParticipations.push({
      revisionsUsed,
      maxRevisions: rfq.max_revisions as number,
      lateRevisions,
    });
  }

  const score2 = calculateRevisionBehavior(rfqParticipations);

  // ── Dimension 3: Win vs Dropout ──
  // Find all CLOSED/AWARDED RFQs where this supplier has a latest bid
  const supplierClosedBids = await db('bids')
    .join('rfqs', 'bids.rfq_id', 'rfqs.id')
    .where({ 'bids.supplier_id': supplierId, 'bids.is_latest': true })
    .whereIn('rfqs.status', ['CLOSED', 'AWARDED'])
    .select('bids.rfq_id', 'bids.total_price');

  let l1Count = 0;
  let l1Awarded = 0;

  for (const bid of supplierClosedBids) {
    // Find the lowest total_price among all latest bids for this RFQ
    const l1Bid = await db('bids')
      .where({ rfq_id: bid.rfq_id, is_latest: true })
      .orderBy('total_price', 'asc')
      .select('supplier_id', 'total_price')
      .first();

    if (l1Bid && l1Bid.supplier_id === supplierId) {
      // This supplier was L1 at close time
      l1Count++;

      // Check if they were the awarded supplier
      const awardEntry = await db('audit_log')
        .where({ rfq_id: bid.rfq_id, event_type: AuditEventType.AWARD_FINALIZED })
        .select('event_data')
        .first();

      if (awardEntry) {
        const eventData =
          typeof awardEntry.event_data === 'string'
            ? JSON.parse(awardEntry.event_data)
            : awardEntry.event_data;

        const allocations = eventData.allocations as Array<{ supplier_id: string }> | undefined;
        if (allocations && allocations.some((a) => a.supplier_id === supplierId)) {
          l1Awarded++;
        }
      }
    }
  }

  const score3 = calculateWinVsDropout(l1Count, l1Awarded);

  // ── Dimension 4: Post-Award Acceptance ──
  // Count AWARD_FINALIZED entries where this supplier is in allocations
  const allAwardEntries = await db('audit_log')
    .where('event_type', AuditEventType.AWARD_FINALIZED)
    .select('event_data');

  let awardedCount = 0;
  for (const entry of allAwardEntries) {
    const eventData =
      typeof entry.event_data === 'string' ? JSON.parse(entry.event_data) : entry.event_data;

    const allocations = eventData.allocations as Array<{ supplier_id: string }> | undefined;
    if (allocations && allocations.some((a) => a.supplier_id === supplierId)) {
      awardedCount++;
    }
  }

  // Count AWARD_FULFILLED entries for this supplier
  const allFulfillEntries = await db('audit_log')
    .where('event_type', AuditEventType.AWARD_FULFILLED)
    .select('event_data');

  let fulfilledCount = 0;
  for (const entry of allFulfillEntries) {
    const eventData =
      typeof entry.event_data === 'string' ? JSON.parse(entry.event_data) : entry.event_data;

    if (eventData.supplier_id === supplierId) {
      fulfilledCount++;
    }
  }

  const score4 = calculatePostAwardAcceptance(awardedCount, fulfilledCount);

  // ── Composite & Update ──
  const composite = calculateCompositeScore(score1, score2, score3, score4);
  const credibilityClass = deriveCredibilityClass(composite);

  await db('suppliers').where('id', supplierId).update({
    credibility_score: composite,
    credibility_class: credibilityClass,
    updated_at: new Date(),
  });

  logger.info('Credibility score recalculated', {
    supplierId,
    score1,
    score2,
    score3,
    score4,
    composite,
    credibilityClass,
  });
}
