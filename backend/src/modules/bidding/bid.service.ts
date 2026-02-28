import { Knex } from 'knex';
import { getDb } from '../../config/database';
import { getRedis } from '../../config/redis';
import {
  RFQStatus,
  AuditEventType,
  ActorType,
  SupplierAssignmentStatus,
  NegotiationStatus,
  NegotiationSupplierStatus,
} from '../../shared/types/enums';
import { AppError } from '../../middleware/error-handler';
import { createAuditEntry } from '../audit/audit.service';
import { computeBidHash } from '../../shared/utils/hash';
import { logger } from '../../config/logger';

// ── Pure rule-checking functions (exported for unit testing) ──

export function checkRevisionLimit(currentRevision: number, maxRevisions: number): boolean {
  return currentRevision < maxRevisions;
}

export function checkMinimumChange(
  newItems: Array<{ rfq_item_id: string; unit_price: number }>,
  oldItems: Array<{ rfq_item_id: string; unit_price: number }>,
  minChangePercent: number,
): { passed: boolean; failedItems: Array<{ rfq_item_id: string; change_percent: number }> } {
  const oldMap = new Map(oldItems.map((i) => [i.rfq_item_id, i.unit_price]));
  const failedItems: Array<{ rfq_item_id: string; change_percent: number }> = [];
  let hasAnyChange = false;

  for (const newItem of newItems) {
    const oldPrice = oldMap.get(newItem.rfq_item_id);
    if (oldPrice === undefined) continue;

    const changePercent =
      oldPrice === 0 ? 100 : (Math.abs(newItem.unit_price - oldPrice) / oldPrice) * 100;

    if (changePercent > 0) {
      hasAnyChange = true;
      if (changePercent < minChangePercent) {
        failedItems.push({
          rfq_item_id: newItem.rfq_item_id,
          change_percent: parseFloat(changePercent.toFixed(4)),
        });
      }
    }
  }

  // If no items changed at all, reject the revision — nothing was actually revised
  if (!hasAnyChange) {
    return {
      passed: false,
      failedItems: newItems.map((i) => ({ rfq_item_id: i.rfq_item_id, change_percent: 0 })),
    };
  }

  return { passed: failedItems.length === 0, failedItems };
}

export function checkCoolingTime(
  lastSubmittedAt: Date,
  coolingTimeMinutes: number,
  now: Date,
): { passed: boolean; seconds_remaining: number } {
  const coolingMs = coolingTimeMinutes * 60 * 1000;
  const elapsedMs = now.getTime() - lastSubmittedAt.getTime();
  const remainingMs = coolingMs - elapsedMs;

  if (remainingMs <= 0) {
    return { passed: true, seconds_remaining: 0 };
  }
  return { passed: false, seconds_remaining: Math.ceil(remainingMs / 1000) };
}

export function shouldTriggerAntiSnipe(
  bidCloseAt: Date,
  now: Date,
  windowMinutes: number,
): boolean {
  if (windowMinutes <= 0) return false;
  const windowMs = windowMinutes * 60 * 1000;
  const remainingMs = bidCloseAt.getTime() - now.getTime();
  return remainingMs > 0 && remainingMs <= windowMs;
}

// ── Private helpers ──

async function ensureRfqActiveForBidding(
  rfq: Record<string, unknown>,
  trx: Knex.Transaction,
): Promise<Record<string, unknown>> {
  const now = new Date();

  if (rfq.status === RFQStatus.PUBLISHED) {
    if (rfq.bid_open_at && now >= new Date(rfq.bid_open_at as string)) {
      // Auto-transition PUBLISHED → ACTIVE
      await trx('rfqs')
        .where('id', rfq.id as string)
        .update({
          status: RFQStatus.ACTIVE,
          updated_at: now,
        });
      logger.info('RFQ auto-transitioned to ACTIVE', { rfqId: rfq.id as string });
      return { ...rfq, status: RFQStatus.ACTIVE };
    }
    throw new AppError(409, 'BID_WINDOW_NOT_OPEN', 'Bidding window has not opened yet');
  }

  if (rfq.status !== RFQStatus.ACTIVE) {
    throw new AppError(409, 'BID_WINDOW_CLOSED', 'Bidding window is not active');
  }

  if (rfq.bid_close_at && now > new Date(rfq.bid_close_at as string)) {
    throw new AppError(409, 'BID_WINDOW_CLOSED', 'Bidding window has closed');
  }

  return rfq;
}

async function getCoolingTimeFromRedis(
  rfqId: string,
  supplierId: string,
): Promise<{ active: boolean; seconds_remaining: number }> {
  try {
    const redis = getRedis();
    const key = `cooling:${rfqId}:${supplierId}`;
    const ttl = await redis.ttl(key);
    // ttl > 0 means key exists and has TTL; -2 means key doesn't exist; -1 means no expiry
    if (ttl > 0) {
      return { active: true, seconds_remaining: ttl };
    }
    return { active: false, seconds_remaining: 0 };
  } catch (redisErr) {
    // Graceful degradation: if Redis fails, fall back to DB check
    logger.warn('Redis cooling time check failed, falling back to DB', {
      rfqId,
      supplierId,
      error: redisErr,
    });
    return { active: false, seconds_remaining: 0 };
  }
}

async function setCoolingTime(
  rfqId: string,
  supplierId: string,
  coolingTimeMinutes: number,
): Promise<void> {
  try {
    const redis = getRedis();
    const key = `cooling:${rfqId}:${supplierId}`;
    const ttlSeconds = coolingTimeMinutes * 60;
    await redis.set(key, '1', 'EX', ttlSeconds);
  } catch (redisErr) {
    logger.warn('Failed to set Redis cooling time', { rfqId, supplierId, error: redisErr });
  }
}

async function checkAndApplyAntiSnipe(
  rfq: Record<string, unknown>,
  supplierCode: string,
  trx: Knex.Transaction,
): Promise<{ triggered: boolean; newCloseAt?: Date; extensionMinutes?: number }> {
  const windowMinutes = (rfq.anti_snipe_window_minutes as number) || 0;
  const extensionMinutes = (rfq.anti_snipe_extension_minutes as number) || 0;

  if (windowMinutes <= 0 || extensionMinutes <= 0 || !rfq.bid_close_at) {
    return { triggered: false };
  }

  const now = new Date();
  const bidCloseAt = new Date(rfq.bid_close_at as string);

  if (!shouldTriggerAntiSnipe(bidCloseAt, now, windowMinutes)) {
    return { triggered: false };
  }

  const newCloseAt = new Date(bidCloseAt.getTime() + extensionMinutes * 60 * 1000);

  await trx('rfqs')
    .where('id', rfq.id as string)
    .update({
      bid_close_at: newCloseAt,
      updated_at: now,
    });

  await createAuditEntry(
    {
      rfqId: rfq.id as string,
      eventType: AuditEventType.DEADLINE_EXTENDED,
      actorType: ActorType.SYSTEM,
      eventData: {
        rfqId: rfq.id,
        trigger: 'anti_snipe',
        triggeredBySupplierCode: supplierCode,
        previousCloseAt: bidCloseAt.toISOString(),
        newCloseAt: newCloseAt.toISOString(),
        extensionMinutes,
      },
    },
    trx,
  );

  logger.info('Anti-snipe extension triggered', {
    rfqId: rfq.id as string,
    previousCloseAt: bidCloseAt.toISOString(),
    newCloseAt: newCloseAt.toISOString(),
    extensionMinutes,
  });

  return { triggered: true, newCloseAt, extensionMinutes };
}

// ── Public service functions ──

export async function submitBid(
  rfqId: string,
  supplierId: string,
  items: Array<{ rfq_item_id: string; unit_price: number }>,
): Promise<Record<string, unknown>> {
  const db = getDb();

  // Get supplier record for code
  const supplier = await db('suppliers')
    .where('id', supplierId)
    .select('id', 'unique_code')
    .first();
  if (!supplier) {
    throw new AppError(403, 'FORBIDDEN', 'Supplier not found');
  }
  const supplierCode: string = supplier.unique_code;

  // Verify assignment with ACCEPTED status
  const assignment = await db('rfq_suppliers')
    .where({ rfq_id: rfqId, supplier_id: supplierId })
    .first();

  if (!assignment) {
    throw new AppError(403, 'FORBIDDEN', 'You are not assigned to this RFQ');
  }

  if (assignment.status !== SupplierAssignmentStatus.ACCEPTED) {
    throw new AppError(403, 'FORBIDDEN', 'You must accept this RFQ before submitting a bid');
  }

  const trx = await db.transaction();

  try {
    // Lock the RFQ row
    const rfq = await trx('rfqs').where('id', rfqId).forUpdate().first();
    if (!rfq) {
      throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
    }

    // Ensure bidding is active (auto-transition if needed)
    await ensureRfqActiveForBidding(rfq, trx);

    // Check no existing bid exists for this supplier
    const existingBid = await trx('bids')
      .where({ rfq_id: rfqId, supplier_id: supplierId, is_latest: true })
      .first();

    if (existingBid) {
      throw new AppError(
        409,
        'BID_ALREADY_EXISTS',
        'Initial bid already submitted. Use PUT to revise.',
      );
    }

    // Load all RFQ items
    const rfqItems = await trx('rfq_items').where('rfq_id', rfqId).select('id', 'quantity');
    const rfqItemMap = new Map(rfqItems.map((i: { id: string; quantity: number }) => [i.id, i]));

    // Validate all items are present
    const providedItemIds = new Set(items.map((i) => i.rfq_item_id));
    const missingItems = rfqItems.filter((ri: { id: string }) => !providedItemIds.has(ri.id));
    const extraItems = items.filter((i) => !rfqItemMap.has(i.rfq_item_id));

    if (missingItems.length > 0 || extraItems.length > 0) {
      const details: Array<{ field: string; message: string }> = [];
      missingItems.forEach((mi: { id: string }) => {
        details.push({ field: 'items', message: `Missing price for item ${mi.id}` });
      });
      extraItems.forEach((ei) => {
        details.push({ field: 'items', message: `Unknown item ${ei.rfq_item_id}` });
      });
      throw new AppError(422, 'INCOMPLETE_BID', 'All RFQ items must have a price', details);
    }

    // Calculate server-side totals
    const now = new Date();
    let bidTotalPrice = 0;
    const bidItemRecords: Array<{
      rfq_item_id: string;
      unit_price: number;
      total_price: number;
    }> = [];

    for (const item of items) {
      const rfqItem = rfqItemMap.get(item.rfq_item_id)!;
      const itemTotalPrice = item.unit_price * parseFloat(String(rfqItem.quantity));
      bidTotalPrice += itemTotalPrice;
      bidItemRecords.push({
        rfq_item_id: item.rfq_item_id,
        unit_price: item.unit_price,
        total_price: itemTotalPrice,
      });
    }

    // Compute SHA-256 hash
    const submissionHash = computeBidHash({
      supplierCode,
      rfqId,
      revisionNumber: 0,
      items: items.map((i) => ({ rfqItemId: i.rfq_item_id, unitPrice: i.unit_price })),
      submittedAt: now.toISOString(),
    });

    // Insert bid record
    const [bid] = await trx('bids')
      .insert({
        rfq_id: rfqId,
        supplier_id: supplierId,
        supplier_code: supplierCode,
        revision_number: 0,
        submitted_at: now,
        total_price: bidTotalPrice,
        submission_hash: submissionHash,
        is_latest: true,
      })
      .returning([
        'id',
        'rfq_id',
        'supplier_id',
        'supplier_code',
        'revision_number',
        'submitted_at',
        'total_price',
        'submission_hash',
        'is_latest',
        'created_at',
      ]);

    // Insert bid items
    const bidItemRows = bidItemRecords.map((bi) => ({
      bid_id: bid.id,
      rfq_item_id: bi.rfq_item_id,
      unit_price: bi.unit_price,
      total_price: bi.total_price,
    }));

    const insertedItems = await trx('bid_items')
      .insert(bidItemRows)
      .returning(['id', 'bid_id', 'rfq_item_id', 'unit_price', 'total_price']);

    // Audit entry
    await createAuditEntry(
      {
        rfqId,
        eventType: AuditEventType.BID_SUBMITTED,
        actorType: ActorType.SUPPLIER,
        actorId: supplierId,
        actorCode: supplierCode,
        eventData: {
          rfqId,
          supplierId,
          supplierCode,
          bidId: bid.id,
          revisionNumber: 0,
          totalPrice: bidTotalPrice,
          submissionHash,
          items: bidItemRecords.map((bi) => ({
            rfq_item_id: bi.rfq_item_id,
            unit_price: bi.unit_price,
            total_price: bi.total_price,
          })),
        },
      },
      trx,
    );

    // Anti-snipe check (inside transaction, RFQ row already locked with FOR UPDATE)
    const antiSnipeResult = await checkAndApplyAntiSnipe(rfq, supplierCode, trx);

    await trx.commit();

    // Post-commit: set cooling time in Redis
    await setCoolingTime(rfqId, supplierId, rfq.cooling_time_minutes as number);

    // Post-commit: trigger ranking recalculation (non-blocking)
    try {
      const { calculateRankings } = await import('../ranking/ranking.service');
      const { publishRankingUpdate } = await import('../websocket/pubsub');
      const rankings = await calculateRankings(rfqId);
      await publishRankingUpdate(rfqId, rankings);
    } catch (rankErr) {
      logger.error('Failed to recalculate/publish rankings', { rfqId, error: rankErr });
    }

    // Post-commit: evaluate compliance & risk flags (non-blocking)
    try {
      const { evaluateFlags } = await import('../flags/flag.service');
      await evaluateFlags(rfqId);
    } catch (flagErr) {
      logger.error('Failed to evaluate flags', { rfqId, error: flagErr });
    }

    // Post-commit: broadcast deadline extension if anti-snipe triggered
    if (antiSnipeResult.triggered) {
      try {
        const { publishDeadlineExtended } = await import('../websocket/pubsub');
        await publishDeadlineExtended(rfqId, {
          new_close_at: antiSnipeResult.newCloseAt!.toISOString(),
          extension_minutes: antiSnipeResult.extensionMinutes!,
        });
      } catch (wsErr) {
        logger.error('Failed to publish deadline extension', { rfqId, error: wsErr });
      }
    }

    logger.info('Bid submitted', {
      rfqId,
      bidId: bid.id,
      supplierId,
      supplierCode,
      totalPrice: bidTotalPrice,
    });

    return { ...bid, items: insertedItems };
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

export async function reviseBid(
  rfqId: string,
  supplierId: string,
  items: Array<{ rfq_item_id: string; unit_price: number }>,
): Promise<Record<string, unknown>> {
  const db = getDb();

  // Get supplier record for code
  const supplier = await db('suppliers')
    .where('id', supplierId)
    .select('id', 'unique_code')
    .first();
  if (!supplier) {
    throw new AppError(403, 'FORBIDDEN', 'Supplier not found');
  }
  const supplierCode: string = supplier.unique_code;

  // Verify assignment with ACCEPTED status
  const assignment = await db('rfq_suppliers')
    .where({ rfq_id: rfqId, supplier_id: supplierId })
    .first();

  if (!assignment) {
    throw new AppError(403, 'FORBIDDEN', 'You are not assigned to this RFQ');
  }

  if (assignment.status !== SupplierAssignmentStatus.ACCEPTED) {
    throw new AppError(403, 'FORBIDDEN', 'You must accept this RFQ before submitting a bid');
  }

  const trx = await db.transaction();

  try {
    // Lock the RFQ row
    const rfq = await trx('rfqs').where('id', rfqId).forUpdate().first();
    if (!rfq) {
      throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
    }

    // Ensure bidding is active
    await ensureRfqActiveForBidding(rfq, trx);

    // Get the latest bid
    const latestBid = await trx('bids')
      .where({ rfq_id: rfqId, supplier_id: supplierId, is_latest: true })
      .first();

    if (!latestBid) {
      throw new AppError(404, 'NO_BID_FOUND', 'No initial bid found. Submit one first using POST.');
    }

    // Rule A: Check revision limit
    const newRevisionNumber = latestBid.revision_number + 1;
    if (!checkRevisionLimit(latestBid.revision_number, rfq.max_revisions as number)) {
      throw new AppError(422, 'REVISION_LIMIT_REACHED', 'Maximum number of revisions reached', [
        { field: 'revision_number', message: `Max ${rfq.max_revisions} revisions allowed` },
      ]);
    }

    // Rule C: Check cooling time (cheaper than Rule B, check first)
    const cooling = await getCoolingTimeFromRedis(rfqId, supplierId);
    if (cooling.active) {
      // Also try DB fallback for more accurate timing
      throw new AppError(
        422,
        'COOLING_TIME_ACTIVE',
        'Please wait before submitting another revision',
        [{ field: 'cooling_time', message: `${cooling.seconds_remaining} seconds remaining` }],
      );
    }

    // Also check DB-based cooling as fallback
    const dbCooling = checkCoolingTime(
      new Date(latestBid.submitted_at),
      rfq.cooling_time_minutes as number,
      new Date(),
    );
    if (!dbCooling.passed) {
      throw new AppError(
        422,
        'COOLING_TIME_ACTIVE',
        'Please wait before submitting another revision',
        [{ field: 'cooling_time', message: `${dbCooling.seconds_remaining} seconds remaining` }],
      );
    }

    // Rule B: Check minimum change
    const previousBidItems = await trx('bid_items')
      .where('bid_id', latestBid.id)
      .select('rfq_item_id', 'unit_price');

    const minChangeResult = checkMinimumChange(
      items,
      previousBidItems.map((bi: { rfq_item_id: string; unit_price: string | number }) => ({
        rfq_item_id: bi.rfq_item_id,
        unit_price: parseFloat(bi.unit_price as string),
      })),
      parseFloat(rfq.min_change_percent as string),
    );

    if (!minChangeResult.passed) {
      throw new AppError(
        422,
        'MIN_CHANGE_NOT_MET',
        `Each revised item must change by at least ${rfq.min_change_percent}%`,
        minChangeResult.failedItems.map((fi) => ({
          field: fi.rfq_item_id,
          message: `Change of ${fi.change_percent}% is below minimum ${rfq.min_change_percent}%`,
        })),
      );
    }

    // Load all RFQ items
    const rfqItems = await trx('rfq_items').where('rfq_id', rfqId).select('id', 'quantity');
    const rfqItemMap = new Map(rfqItems.map((i: { id: string; quantity: number }) => [i.id, i]));

    // Validate all items are present
    const providedItemIds = new Set(items.map((i) => i.rfq_item_id));
    const missingItems = rfqItems.filter((ri: { id: string }) => !providedItemIds.has(ri.id));
    const extraItems = items.filter((i) => !rfqItemMap.has(i.rfq_item_id));

    if (missingItems.length > 0 || extraItems.length > 0) {
      const details: Array<{ field: string; message: string }> = [];
      missingItems.forEach((mi: { id: string }) => {
        details.push({ field: 'items', message: `Missing price for item ${mi.id}` });
      });
      extraItems.forEach((ei) => {
        details.push({ field: 'items', message: `Unknown item ${ei.rfq_item_id}` });
      });
      throw new AppError(422, 'INCOMPLETE_BID', 'All RFQ items must have a price', details);
    }

    // Calculate server-side totals
    const now = new Date();
    let bidTotalPrice = 0;
    const bidItemRecords: Array<{
      rfq_item_id: string;
      unit_price: number;
      total_price: number;
    }> = [];

    for (const item of items) {
      const rfqItem = rfqItemMap.get(item.rfq_item_id)!;
      const itemTotalPrice = item.unit_price * parseFloat(String(rfqItem.quantity));
      bidTotalPrice += itemTotalPrice;
      bidItemRecords.push({
        rfq_item_id: item.rfq_item_id,
        unit_price: item.unit_price,
        total_price: itemTotalPrice,
      });
    }

    // Compute SHA-256 hash
    const submissionHash = computeBidHash({
      supplierCode,
      rfqId,
      revisionNumber: newRevisionNumber,
      items: items.map((i) => ({ rfqItemId: i.rfq_item_id, unitPrice: i.unit_price })),
      submittedAt: now.toISOString(),
    });

    // Mark previous bid as not latest
    await trx('bids').where({ id: latestBid.id }).update({ is_latest: false, updated_at: now });

    // Insert new bid record
    const [bid] = await trx('bids')
      .insert({
        rfq_id: rfqId,
        supplier_id: supplierId,
        supplier_code: supplierCode,
        revision_number: newRevisionNumber,
        submitted_at: now,
        total_price: bidTotalPrice,
        submission_hash: submissionHash,
        is_latest: true,
      })
      .returning([
        'id',
        'rfq_id',
        'supplier_id',
        'supplier_code',
        'revision_number',
        'submitted_at',
        'total_price',
        'submission_hash',
        'is_latest',
        'created_at',
      ]);

    // Insert bid items
    const bidItemRows = bidItemRecords.map((bi) => ({
      bid_id: bid.id,
      rfq_item_id: bi.rfq_item_id,
      unit_price: bi.unit_price,
      total_price: bi.total_price,
    }));

    const insertedItems = await trx('bid_items')
      .insert(bidItemRows)
      .returning(['id', 'bid_id', 'rfq_item_id', 'unit_price', 'total_price']);

    // Audit entry with old and new prices
    const oldItemPrices = previousBidItems.map(
      (bi: { rfq_item_id: string; unit_price: string | number }) => ({
        rfq_item_id: bi.rfq_item_id,
        unit_price: parseFloat(bi.unit_price as string),
      }),
    );

    await createAuditEntry(
      {
        rfqId,
        eventType: AuditEventType.BID_REVISED,
        actorType: ActorType.SUPPLIER,
        actorId: supplierId,
        actorCode: supplierCode,
        eventData: {
          rfqId,
          supplierId,
          supplierCode,
          bidId: bid.id,
          previousBidId: latestBid.id,
          revisionNumber: newRevisionNumber,
          totalPrice: bidTotalPrice,
          previousTotalPrice: parseFloat(latestBid.total_price as string),
          submissionHash,
          oldPrices: oldItemPrices,
          newPrices: bidItemRecords.map((bi) => ({
            rfq_item_id: bi.rfq_item_id,
            unit_price: bi.unit_price,
            total_price: bi.total_price,
          })),
        },
      },
      trx,
    );

    // Anti-snipe check (inside transaction, RFQ row already locked with FOR UPDATE)
    const antiSnipeResult = await checkAndApplyAntiSnipe(rfq, supplierCode, trx);

    await trx.commit();

    // Post-commit: set cooling time
    await setCoolingTime(rfqId, supplierId, rfq.cooling_time_minutes as number);

    // Post-commit: trigger ranking recalculation (non-blocking)
    try {
      const { calculateRankings } = await import('../ranking/ranking.service');
      const { publishRankingUpdate } = await import('../websocket/pubsub');
      const rankings = await calculateRankings(rfqId);
      await publishRankingUpdate(rfqId, rankings);
    } catch (rankErr) {
      logger.error('Failed to recalculate/publish rankings', { rfqId, error: rankErr });
    }

    // Post-commit: evaluate compliance & risk flags (non-blocking)
    try {
      const { evaluateFlags } = await import('../flags/flag.service');
      await evaluateFlags(rfqId);
    } catch (flagErr) {
      logger.error('Failed to evaluate flags', { rfqId, error: flagErr });
    }

    // Post-commit: broadcast deadline extension if anti-snipe triggered
    if (antiSnipeResult.triggered) {
      try {
        const { publishDeadlineExtended } = await import('../websocket/pubsub');
        await publishDeadlineExtended(rfqId, {
          new_close_at: antiSnipeResult.newCloseAt!.toISOString(),
          extension_minutes: antiSnipeResult.extensionMinutes!,
        });
      } catch (wsErr) {
        logger.error('Failed to publish deadline extension', { rfqId, error: wsErr });
      }
    }

    logger.info('Bid revised', {
      rfqId,
      bidId: bid.id,
      supplierId,
      supplierCode,
      revisionNumber: newRevisionNumber,
      totalPrice: bidTotalPrice,
    });

    return { ...bid, items: insertedItems };
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

export async function getBidStatus(
  rfqId: string,
  supplierId: string,
): Promise<Record<string, unknown>> {
  const db = getDb();

  // Verify assignment
  const assignment = await db('rfq_suppliers')
    .where({ rfq_id: rfqId, supplier_id: supplierId })
    .first();

  if (!assignment) {
    throw new AppError(403, 'FORBIDDEN', 'You are not assigned to this RFQ');
  }

  const rfq = await db('rfqs')
    .where('id', rfqId)
    .select('max_revisions', 'cooling_time_minutes')
    .first();
  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  const latestBid = await db('bids')
    .where({ rfq_id: rfqId, supplier_id: supplierId, is_latest: true })
    .first();

  if (!latestBid) {
    return {
      has_bid: false,
      revisions_used: 0,
      revisions_remaining: rfq.max_revisions as number,
      seconds_until_next_revision: 0,
    };
  }

  const revisionsUsed = latestBid.revision_number as number;
  const revisionsRemaining = Math.max(0, (rfq.max_revisions as number) - revisionsUsed);

  // Check cooling time
  const cooling = await getCoolingTimeFromRedis(rfqId, supplierId);
  let secondsUntilNext = cooling.seconds_remaining;

  // DB fallback if Redis didn't report active cooling
  if (!cooling.active) {
    const dbCooling = checkCoolingTime(
      new Date(latestBid.submitted_at),
      rfq.cooling_time_minutes as number,
      new Date(),
    );
    secondsUntilNext = dbCooling.seconds_remaining;
  }

  return {
    has_bid: true,
    revisions_used: revisionsUsed,
    revisions_remaining: revisionsRemaining,
    seconds_until_next_revision: secondsUntilNext,
    latest_bid: {
      id: latestBid.id,
      revision_number: latestBid.revision_number,
      total_price: latestBid.total_price,
      submitted_at: latestBid.submitted_at,
    },
  };
}

// ── Negotiation bidding functions ──

async function ensureNegotiationActiveForBidding(
  negotiation: Record<string, unknown>,
  trx: Knex.Transaction,
): Promise<Record<string, unknown>> {
  const now = new Date();

  if (negotiation.status === NegotiationStatus.DRAFT) {
    if (negotiation.bid_open_at && now >= new Date(negotiation.bid_open_at as string)) {
      // Auto-transition DRAFT → ACTIVE
      await trx('negotiation_events')
        .where('id', negotiation.id as string)
        .update({
          status: NegotiationStatus.ACTIVE,
          updated_at: now,
        });
      logger.info('Negotiation auto-transitioned to ACTIVE', {
        negotiationId: negotiation.id as string,
      });
      return { ...negotiation, status: NegotiationStatus.ACTIVE };
    }
    throw new AppError(409, 'BID_WINDOW_NOT_OPEN', 'Negotiation bidding window has not opened yet');
  }

  if (negotiation.status !== NegotiationStatus.ACTIVE) {
    throw new AppError(409, 'BID_WINDOW_CLOSED', 'Negotiation bidding window is not active');
  }

  if (negotiation.bid_close_at && now > new Date(negotiation.bid_close_at as string)) {
    throw new AppError(409, 'BID_WINDOW_CLOSED', 'Negotiation bidding window has closed');
  }

  return negotiation;
}

async function getNegotiationCoolingTimeFromRedis(
  negotiationId: string,
  supplierId: string,
): Promise<{ active: boolean; seconds_remaining: number }> {
  try {
    const redis = getRedis();
    const key = `cooling:neg:${negotiationId}:${supplierId}`;
    const ttl = await redis.ttl(key);
    if (ttl > 0) {
      return { active: true, seconds_remaining: ttl };
    }
    return { active: false, seconds_remaining: 0 };
  } catch (redisErr) {
    logger.warn('Redis negotiation cooling time check failed', {
      negotiationId,
      supplierId,
      error: redisErr,
    });
    return { active: false, seconds_remaining: 0 };
  }
}

async function setNegotiationCoolingTime(
  negotiationId: string,
  supplierId: string,
  coolingTimeMinutes: number,
): Promise<void> {
  try {
    const redis = getRedis();
    const key = `cooling:neg:${negotiationId}:${supplierId}`;
    const ttlSeconds = coolingTimeMinutes * 60;
    await redis.set(key, '1', 'EX', ttlSeconds);
  } catch (redisErr) {
    logger.warn('Failed to set Redis negotiation cooling time', {
      negotiationId,
      supplierId,
      error: redisErr,
    });
  }
}

async function checkAndApplyNegotiationAntiSnipe(
  negotiation: Record<string, unknown>,
  supplierCode: string,
  trx: Knex.Transaction,
): Promise<{ triggered: boolean; newCloseAt?: Date; extensionMinutes?: number }> {
  const windowMinutes = (negotiation.anti_snipe_window_minutes as number) || 0;
  const extensionMinutes = (negotiation.anti_snipe_extension_minutes as number) || 0;

  if (windowMinutes <= 0 || extensionMinutes <= 0 || !negotiation.bid_close_at) {
    return { triggered: false };
  }

  const now = new Date();
  const bidCloseAt = new Date(negotiation.bid_close_at as string);

  if (!shouldTriggerAntiSnipe(bidCloseAt, now, windowMinutes)) {
    return { triggered: false };
  }

  const newCloseAt = new Date(bidCloseAt.getTime() + extensionMinutes * 60 * 1000);

  await trx('negotiation_events')
    .where('id', negotiation.id as string)
    .update({
      bid_close_at: newCloseAt,
      updated_at: now,
    });

  const parentRfqId = negotiation.parent_rfq_id as string;

  await createAuditEntry(
    {
      rfqId: parentRfqId,
      eventType: AuditEventType.DEADLINE_EXTENDED,
      actorType: ActorType.SYSTEM,
      eventData: {
        negotiationId: negotiation.id,
        parentRfqId,
        trigger: 'anti_snipe',
        triggeredBySupplierCode: supplierCode,
        previousCloseAt: bidCloseAt.toISOString(),
        newCloseAt: newCloseAt.toISOString(),
        extensionMinutes,
      },
    },
    trx,
  );

  logger.info('Negotiation anti-snipe extension triggered', {
    negotiationId: negotiation.id as string,
    previousCloseAt: bidCloseAt.toISOString(),
    newCloseAt: newCloseAt.toISOString(),
    extensionMinutes,
  });

  return { triggered: true, newCloseAt, extensionMinutes };
}

export async function submitNegotiationBid(
  negotiationId: string,
  supplierId: string,
  items: Array<{ rfq_item_id: string; unit_price: number }>,
): Promise<Record<string, unknown>> {
  const db = getDb();

  // Get supplier record for code
  const supplier = await db('suppliers')
    .where('id', supplierId)
    .select('id', 'unique_code')
    .first();
  if (!supplier) {
    throw new AppError(403, 'FORBIDDEN', 'Supplier not found');
  }
  const supplierCode: string = supplier.unique_code;

  // Verify assignment with ACCEPTED status in negotiation_suppliers
  const assignment = await db('negotiation_suppliers')
    .where({ negotiation_id: negotiationId, supplier_id: supplierId })
    .first();

  if (!assignment) {
    throw new AppError(403, 'FORBIDDEN', 'You are not assigned to this negotiation');
  }

  if (assignment.status !== NegotiationSupplierStatus.ACCEPTED) {
    throw new AppError(403, 'FORBIDDEN', 'You must be an accepted supplier in this negotiation');
  }

  const trx = await db.transaction();

  try {
    // Lock the negotiation row
    const negotiation = await trx('negotiation_events')
      .where('id', negotiationId)
      .forUpdate()
      .first();
    if (!negotiation) {
      throw new AppError(404, 'NEGOTIATION_NOT_FOUND', 'Negotiation not found');
    }

    const parentRfqId = negotiation.parent_rfq_id as string;

    // Ensure bidding is active (auto-transition if needed)
    await ensureNegotiationActiveForBidding(negotiation, trx);

    // Check no existing bid exists for this supplier in this negotiation
    const existingBid = await trx('bids')
      .where({ negotiation_id: negotiationId, supplier_id: supplierId, is_latest: true })
      .first();

    if (existingBid) {
      throw new AppError(
        409,
        'BID_ALREADY_EXISTS',
        'Initial bid already submitted. Use PUT to revise.',
      );
    }

    // Load all RFQ items from parent RFQ
    const rfqItems = await trx('rfq_items').where('rfq_id', parentRfqId).select('id', 'quantity');
    const rfqItemMap = new Map(rfqItems.map((i: { id: string; quantity: number }) => [i.id, i]));

    // Validate all items are present
    const providedItemIds = new Set(items.map((i) => i.rfq_item_id));
    const missingItems = rfqItems.filter((ri: { id: string }) => !providedItemIds.has(ri.id));
    const extraItems = items.filter((i) => !rfqItemMap.has(i.rfq_item_id));

    if (missingItems.length > 0 || extraItems.length > 0) {
      const details: Array<{ field: string; message: string }> = [];
      missingItems.forEach((mi: { id: string }) => {
        details.push({ field: 'items', message: `Missing price for item ${mi.id}` });
      });
      extraItems.forEach((ei) => {
        details.push({ field: 'items', message: `Unknown item ${ei.rfq_item_id}` });
      });
      throw new AppError(422, 'INCOMPLETE_BID', 'All RFQ items must have a price', details);
    }

    // Calculate server-side totals
    const now = new Date();
    let bidTotalPrice = 0;
    const bidItemRecords: Array<{
      rfq_item_id: string;
      unit_price: number;
      total_price: number;
    }> = [];

    for (const item of items) {
      const rfqItem = rfqItemMap.get(item.rfq_item_id)!;
      const itemTotalPrice = item.unit_price * parseFloat(String(rfqItem.quantity));
      bidTotalPrice += itemTotalPrice;
      bidItemRecords.push({
        rfq_item_id: item.rfq_item_id,
        unit_price: item.unit_price,
        total_price: itemTotalPrice,
      });
    }

    // Compute SHA-256 hash
    const submissionHash = computeBidHash({
      supplierCode,
      rfqId: parentRfqId,
      revisionNumber: 0,
      items: items.map((i) => ({ rfqItemId: i.rfq_item_id, unitPrice: i.unit_price })),
      submittedAt: now.toISOString(),
      negotiationId,
    });

    // Insert bid record with negotiation_id
    const [bid] = await trx('bids')
      .insert({
        rfq_id: parentRfqId,
        negotiation_id: negotiationId,
        supplier_id: supplierId,
        supplier_code: supplierCode,
        revision_number: 0,
        submitted_at: now,
        total_price: bidTotalPrice,
        submission_hash: submissionHash,
        is_latest: true,
      })
      .returning([
        'id',
        'rfq_id',
        'negotiation_id',
        'supplier_id',
        'supplier_code',
        'revision_number',
        'submitted_at',
        'total_price',
        'submission_hash',
        'is_latest',
        'created_at',
      ]);

    // Insert bid items
    const bidItemRows = bidItemRecords.map((bi) => ({
      bid_id: bid.id,
      rfq_item_id: bi.rfq_item_id,
      unit_price: bi.unit_price,
      total_price: bi.total_price,
    }));

    const insertedItems = await trx('bid_items')
      .insert(bidItemRows)
      .returning(['id', 'bid_id', 'rfq_item_id', 'unit_price', 'total_price']);

    // Audit entry — rfqId = parentRfqId
    await createAuditEntry(
      {
        rfqId: parentRfqId,
        eventType: AuditEventType.BID_SUBMITTED,
        actorType: ActorType.SUPPLIER,
        actorId: supplierId,
        actorCode: supplierCode,
        eventData: {
          rfqId: parentRfqId,
          negotiationId,
          supplierId,
          supplierCode,
          bidId: bid.id,
          revisionNumber: 0,
          totalPrice: bidTotalPrice,
          submissionHash,
          items: bidItemRecords.map((bi) => ({
            rfq_item_id: bi.rfq_item_id,
            unit_price: bi.unit_price,
            total_price: bi.total_price,
          })),
        },
      },
      trx,
    );

    // Anti-snipe check
    const antiSnipeResult = await checkAndApplyNegotiationAntiSnipe(negotiation, supplierCode, trx);

    await trx.commit();

    // Post-commit: set cooling time in Redis
    await setNegotiationCoolingTime(
      negotiationId,
      supplierId,
      negotiation.cooling_time_minutes as number,
    );

    // Post-commit: trigger ranking recalculation (non-blocking)
    try {
      const { calculateNegotiationRankings } = await import('../ranking/ranking.service');
      const { publishNegotiationRankingUpdate } = await import('../websocket/pubsub');
      const rankings = await calculateNegotiationRankings(negotiationId);
      await publishNegotiationRankingUpdate(negotiationId, rankings);
    } catch (rankErr) {
      logger.error('Failed to recalculate/publish negotiation rankings', {
        negotiationId,
        error: rankErr,
      });
    }

    // Post-commit: broadcast deadline extension if anti-snipe triggered
    if (antiSnipeResult.triggered) {
      try {
        const { publishNegotiationDeadlineExtended } = await import('../websocket/pubsub');
        await publishNegotiationDeadlineExtended(negotiationId, {
          new_close_at: antiSnipeResult.newCloseAt!.toISOString(),
          extension_minutes: antiSnipeResult.extensionMinutes!,
        });
      } catch (wsErr) {
        logger.error('Failed to publish negotiation deadline extension', {
          negotiationId,
          error: wsErr,
        });
      }
    }

    logger.info('Negotiation bid submitted', {
      negotiationId,
      bidId: bid.id,
      supplierId,
      supplierCode,
      totalPrice: bidTotalPrice,
    });

    return { ...bid, items: insertedItems };
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

export async function reviseNegotiationBid(
  negotiationId: string,
  supplierId: string,
  items: Array<{ rfq_item_id: string; unit_price: number }>,
): Promise<Record<string, unknown>> {
  const db = getDb();

  // Get supplier record for code
  const supplier = await db('suppliers')
    .where('id', supplierId)
    .select('id', 'unique_code')
    .first();
  if (!supplier) {
    throw new AppError(403, 'FORBIDDEN', 'Supplier not found');
  }
  const supplierCode: string = supplier.unique_code;

  // Verify assignment with ACCEPTED status
  const assignment = await db('negotiation_suppliers')
    .where({ negotiation_id: negotiationId, supplier_id: supplierId })
    .first();

  if (!assignment) {
    throw new AppError(403, 'FORBIDDEN', 'You are not assigned to this negotiation');
  }

  if (assignment.status !== NegotiationSupplierStatus.ACCEPTED) {
    throw new AppError(403, 'FORBIDDEN', 'You must be an accepted supplier in this negotiation');
  }

  const trx = await db.transaction();

  try {
    // Lock the negotiation row
    const negotiation = await trx('negotiation_events')
      .where('id', negotiationId)
      .forUpdate()
      .first();
    if (!negotiation) {
      throw new AppError(404, 'NEGOTIATION_NOT_FOUND', 'Negotiation not found');
    }

    const parentRfqId = negotiation.parent_rfq_id as string;

    // Ensure bidding is active
    await ensureNegotiationActiveForBidding(negotiation, trx);

    // Get the latest bid
    const latestBid = await trx('bids')
      .where({ negotiation_id: negotiationId, supplier_id: supplierId, is_latest: true })
      .first();

    if (!latestBid) {
      throw new AppError(404, 'NO_BID_FOUND', 'No initial bid found. Submit one first using POST.');
    }

    // Rule A: Check revision limit
    const newRevisionNumber = latestBid.revision_number + 1;
    if (!checkRevisionLimit(latestBid.revision_number, negotiation.max_revisions as number)) {
      throw new AppError(422, 'REVISION_LIMIT_REACHED', 'Maximum number of revisions reached', [
        { field: 'revision_number', message: `Max ${negotiation.max_revisions} revisions allowed` },
      ]);
    }

    // Rule C: Check cooling time (cheaper than Rule B, check first)
    const cooling = await getNegotiationCoolingTimeFromRedis(negotiationId, supplierId);
    if (cooling.active) {
      throw new AppError(
        422,
        'COOLING_TIME_ACTIVE',
        'Please wait before submitting another revision',
        [{ field: 'cooling_time', message: `${cooling.seconds_remaining} seconds remaining` }],
      );
    }

    // Also check DB-based cooling as fallback
    const dbCooling = checkCoolingTime(
      new Date(latestBid.submitted_at),
      negotiation.cooling_time_minutes as number,
      new Date(),
    );
    if (!dbCooling.passed) {
      throw new AppError(
        422,
        'COOLING_TIME_ACTIVE',
        'Please wait before submitting another revision',
        [{ field: 'cooling_time', message: `${dbCooling.seconds_remaining} seconds remaining` }],
      );
    }

    // Rule B: Check minimum change
    const previousBidItems = await trx('bid_items')
      .where('bid_id', latestBid.id)
      .select('rfq_item_id', 'unit_price');

    const minChangeResult = checkMinimumChange(
      items,
      previousBidItems.map((bi: { rfq_item_id: string; unit_price: string | number }) => ({
        rfq_item_id: bi.rfq_item_id,
        unit_price: parseFloat(bi.unit_price as string),
      })),
      parseFloat(negotiation.min_change_percent as string),
    );

    if (!minChangeResult.passed) {
      throw new AppError(
        422,
        'MIN_CHANGE_NOT_MET',
        `Each revised item must change by at least ${negotiation.min_change_percent}%`,
        minChangeResult.failedItems.map((fi) => ({
          field: fi.rfq_item_id,
          message: `Change of ${fi.change_percent}% is below minimum ${negotiation.min_change_percent}%`,
        })),
      );
    }

    // Load all RFQ items from parent RFQ
    const rfqItems = await trx('rfq_items').where('rfq_id', parentRfqId).select('id', 'quantity');
    const rfqItemMap = new Map(rfqItems.map((i: { id: string; quantity: number }) => [i.id, i]));

    // Validate all items are present
    const providedItemIds = new Set(items.map((i) => i.rfq_item_id));
    const missingItems = rfqItems.filter((ri: { id: string }) => !providedItemIds.has(ri.id));
    const extraItems = items.filter((i) => !rfqItemMap.has(i.rfq_item_id));

    if (missingItems.length > 0 || extraItems.length > 0) {
      const details: Array<{ field: string; message: string }> = [];
      missingItems.forEach((mi: { id: string }) => {
        details.push({ field: 'items', message: `Missing price for item ${mi.id}` });
      });
      extraItems.forEach((ei) => {
        details.push({ field: 'items', message: `Unknown item ${ei.rfq_item_id}` });
      });
      throw new AppError(422, 'INCOMPLETE_BID', 'All RFQ items must have a price', details);
    }

    // Calculate server-side totals
    const now = new Date();
    let bidTotalPrice = 0;
    const bidItemRecords: Array<{
      rfq_item_id: string;
      unit_price: number;
      total_price: number;
    }> = [];

    for (const item of items) {
      const rfqItem = rfqItemMap.get(item.rfq_item_id)!;
      const itemTotalPrice = item.unit_price * parseFloat(String(rfqItem.quantity));
      bidTotalPrice += itemTotalPrice;
      bidItemRecords.push({
        rfq_item_id: item.rfq_item_id,
        unit_price: item.unit_price,
        total_price: itemTotalPrice,
      });
    }

    // Compute SHA-256 hash
    const submissionHash = computeBidHash({
      supplierCode,
      rfqId: parentRfqId,
      revisionNumber: newRevisionNumber,
      items: items.map((i) => ({ rfqItemId: i.rfq_item_id, unitPrice: i.unit_price })),
      submittedAt: now.toISOString(),
      negotiationId,
    });

    // Mark previous bid as not latest
    await trx('bids').where({ id: latestBid.id }).update({ is_latest: false, updated_at: now });

    // Insert new bid record
    const [bid] = await trx('bids')
      .insert({
        rfq_id: parentRfqId,
        negotiation_id: negotiationId,
        supplier_id: supplierId,
        supplier_code: supplierCode,
        revision_number: newRevisionNumber,
        submitted_at: now,
        total_price: bidTotalPrice,
        submission_hash: submissionHash,
        is_latest: true,
      })
      .returning([
        'id',
        'rfq_id',
        'negotiation_id',
        'supplier_id',
        'supplier_code',
        'revision_number',
        'submitted_at',
        'total_price',
        'submission_hash',
        'is_latest',
        'created_at',
      ]);

    // Insert bid items
    const bidItemRows = bidItemRecords.map((bi) => ({
      bid_id: bid.id,
      rfq_item_id: bi.rfq_item_id,
      unit_price: bi.unit_price,
      total_price: bi.total_price,
    }));

    const insertedItems = await trx('bid_items')
      .insert(bidItemRows)
      .returning(['id', 'bid_id', 'rfq_item_id', 'unit_price', 'total_price']);

    // Audit entry with old and new prices
    const oldItemPrices = previousBidItems.map(
      (bi: { rfq_item_id: string; unit_price: string | number }) => ({
        rfq_item_id: bi.rfq_item_id,
        unit_price: parseFloat(bi.unit_price as string),
      }),
    );

    await createAuditEntry(
      {
        rfqId: parentRfqId,
        eventType: AuditEventType.BID_REVISED,
        actorType: ActorType.SUPPLIER,
        actorId: supplierId,
        actorCode: supplierCode,
        eventData: {
          rfqId: parentRfqId,
          negotiationId,
          supplierId,
          supplierCode,
          bidId: bid.id,
          previousBidId: latestBid.id,
          revisionNumber: newRevisionNumber,
          totalPrice: bidTotalPrice,
          previousTotalPrice: parseFloat(latestBid.total_price as string),
          submissionHash,
          oldPrices: oldItemPrices,
          newPrices: bidItemRecords.map((bi) => ({
            rfq_item_id: bi.rfq_item_id,
            unit_price: bi.unit_price,
            total_price: bi.total_price,
          })),
        },
      },
      trx,
    );

    // Anti-snipe check
    const antiSnipeResult = await checkAndApplyNegotiationAntiSnipe(negotiation, supplierCode, trx);

    await trx.commit();

    // Post-commit: set cooling time
    await setNegotiationCoolingTime(
      negotiationId,
      supplierId,
      negotiation.cooling_time_minutes as number,
    );

    // Post-commit: trigger ranking recalculation (non-blocking)
    try {
      const { calculateNegotiationRankings } = await import('../ranking/ranking.service');
      const { publishNegotiationRankingUpdate } = await import('../websocket/pubsub');
      const rankings = await calculateNegotiationRankings(negotiationId);
      await publishNegotiationRankingUpdate(negotiationId, rankings);
    } catch (rankErr) {
      logger.error('Failed to recalculate/publish negotiation rankings', {
        negotiationId,
        error: rankErr,
      });
    }

    // Post-commit: broadcast deadline extension if anti-snipe triggered
    if (antiSnipeResult.triggered) {
      try {
        const { publishNegotiationDeadlineExtended } = await import('../websocket/pubsub');
        await publishNegotiationDeadlineExtended(negotiationId, {
          new_close_at: antiSnipeResult.newCloseAt!.toISOString(),
          extension_minutes: antiSnipeResult.extensionMinutes!,
        });
      } catch (wsErr) {
        logger.error('Failed to publish negotiation deadline extension', {
          negotiationId,
          error: wsErr,
        });
      }
    }

    logger.info('Negotiation bid revised', {
      negotiationId,
      bidId: bid.id,
      supplierId,
      supplierCode,
      revisionNumber: newRevisionNumber,
      totalPrice: bidTotalPrice,
    });

    return { ...bid, items: insertedItems };
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

export async function getNegotiationBidStatus(
  negotiationId: string,
  supplierId: string,
): Promise<Record<string, unknown>> {
  const db = getDb();

  // Verify assignment
  const assignment = await db('negotiation_suppliers')
    .where({ negotiation_id: negotiationId, supplier_id: supplierId })
    .first();

  if (!assignment) {
    throw new AppError(403, 'FORBIDDEN', 'You are not assigned to this negotiation');
  }

  const negotiation = await db('negotiation_events')
    .where('id', negotiationId)
    .select('max_revisions', 'cooling_time_minutes')
    .first();
  if (!negotiation) {
    throw new AppError(404, 'NEGOTIATION_NOT_FOUND', 'Negotiation not found');
  }

  const latestBid = await db('bids')
    .where({ negotiation_id: negotiationId, supplier_id: supplierId, is_latest: true })
    .first();

  if (!latestBid) {
    return {
      has_bid: false,
      revisions_used: 0,
      revisions_remaining: negotiation.max_revisions as number,
      seconds_until_next_revision: 0,
    };
  }

  const revisionsUsed = latestBid.revision_number as number;
  const revisionsRemaining = Math.max(0, (negotiation.max_revisions as number) - revisionsUsed);

  // Check cooling time
  const cooling = await getNegotiationCoolingTimeFromRedis(negotiationId, supplierId);
  let secondsUntilNext = cooling.seconds_remaining;

  // DB fallback if Redis didn't report active cooling
  if (!cooling.active) {
    const dbCooling = checkCoolingTime(
      new Date(latestBid.submitted_at),
      negotiation.cooling_time_minutes as number,
      new Date(),
    );
    secondsUntilNext = dbCooling.seconds_remaining;
  }

  return {
    has_bid: true,
    revisions_used: revisionsUsed,
    revisions_remaining: revisionsRemaining,
    seconds_until_next_revision: secondsUntilNext,
    latest_bid: {
      id: latestBid.id,
      revision_number: latestBid.revision_number,
      total_price: latestBid.total_price,
      submitted_at: latestBid.submitted_at,
    },
  };
}
