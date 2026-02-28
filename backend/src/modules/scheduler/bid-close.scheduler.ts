import cron, { ScheduledTask } from 'node-cron';
import { getDb } from '../../config/database';
import { RFQStatus, AuditEventType, ActorType } from '../../shared/types/enums';
import { createAuditEntry } from '../audit/audit.service';
import { logger } from '../../config/logger';

let schedulerTask: ScheduledTask | null = null;

/**
 * Checks for ACTIVE RFQs whose bid_close_at has passed and closes them.
 * Fires every 30 seconds.
 */
async function checkAndCloseExpiredRfqs(): Promise<void> {
  const db = getDb();
  const now = new Date();

  try {
    // Find all ACTIVE RFQs with bid_close_at <= now
    const expiredRfqs = await db('rfqs')
      .where('status', RFQStatus.ACTIVE)
      .whereNotNull('bid_close_at')
      .where('bid_close_at', '<=', now)
      .select('id', 'rfq_number', 'buyer_id', 'bid_close_at');

    for (const rfq of expiredRfqs) {
      const trx = await db.transaction();

      try {
        // Lock the row to prevent race conditions
        const lockedRfq = await trx('rfqs')
          .where('id', rfq.id)
          .where('status', RFQStatus.ACTIVE)
          .forUpdate()
          .first();

        if (!lockedRfq) {
          // Already closed by another process
          await trx.commit();
          continue;
        }

        // Double-check the close time hasn't been extended
        if (new Date(lockedRfq.bid_close_at) > now) {
          await trx.commit();
          continue;
        }

        await trx('rfqs')
          .where('id', rfq.id)
          .update({ status: RFQStatus.CLOSED, updated_at: now });

        await createAuditEntry(
          {
            rfqId: rfq.id,
            eventType: AuditEventType.RFQ_CLOSED,
            actorType: ActorType.SYSTEM,
            actorId: null,
            eventData: {
              rfqId: rfq.id,
              rfqNumber: rfq.rfq_number,
              close_method: 'scheduled',
              closed_at: now.toISOString(),
              bid_close_at: rfq.bid_close_at,
            },
          },
          trx,
        );

        await trx.commit();

        // Post-commit: broadcast WebSocket event
        try {
          const { getIO } = await import('../websocket/index');
          const io = getIO();
          if (io) {
            io.to(`rfq:${rfq.id}:buyer`).emit('rfq:closed', {
              rfqId: rfq.id,
              close_method: 'scheduled',
            });
            io.to(`rfq:${rfq.id}:suppliers`).emit('rfq:closed', {
              rfqId: rfq.id,
              close_method: 'scheduled',
            });
          }
        } catch (wsErr) {
          logger.error('Failed to broadcast rfq:closed', { rfqId: rfq.id, error: wsErr });
        }

        logger.info('RFQ auto-closed by scheduler', {
          rfqId: rfq.id,
          rfqNumber: rfq.rfq_number,
        });
      } catch (err) {
        await trx.rollback();
        logger.error('Failed to auto-close RFQ', { rfqId: rfq.id, error: err });
      }
    }
  } catch (err) {
    logger.error('Bid close scheduler error', { error: err });
  }
}

/**
 * Initialize the bid close scheduler. Runs every 30 seconds.
 * Skip initialization in test environment.
 */
export function initBidCloseScheduler(): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  schedulerTask = cron.schedule('*/30 * * * * *', () => {
    checkAndCloseExpiredRfqs().catch((err) =>
      logger.error('Bid close scheduler crashed', { error: err }),
    );
  });

  logger.info('Bid close scheduler initialized (every 30 seconds)');
}

export function stopBidCloseScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
  }
}

// Export for testing
export { checkAndCloseExpiredRfqs };
