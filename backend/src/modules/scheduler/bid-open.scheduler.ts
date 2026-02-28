import cron, { ScheduledTask } from 'node-cron';
import { getDb } from '../../config/database';
import { RFQStatus } from '../../shared/types/enums';
import { logger } from '../../config/logger';

let schedulerTask: ScheduledTask | null = null;

/**
 * Checks for PUBLISHED RFQs whose bid_open_at has passed and activates them.
 * Fires every 30 seconds.
 */
async function checkAndActivateRfqs(): Promise<void> {
  const db = getDb();
  const now = new Date();

  try {
    // Find all PUBLISHED RFQs with bid_open_at <= now
    const readyRfqs = await db('rfqs')
      .where('status', RFQStatus.PUBLISHED)
      .where(function () {
        this.whereNull('bid_open_at').orWhere('bid_open_at', '<=', now);
      })
      .select('id', 'rfq_number', 'buyer_id', 'bid_open_at');

    for (const rfq of readyRfqs) {
      const trx = await db.transaction();

      try {
        const lockedRfq = await trx('rfqs')
          .where('id', rfq.id)
          .where('status', RFQStatus.PUBLISHED)
          .forUpdate()
          .first();

        if (!lockedRfq) {
          await trx.commit();
          continue;
        }

        await trx('rfqs')
          .where('id', rfq.id)
          .update({ status: RFQStatus.ACTIVE, updated_at: now });

        await trx.commit();

        logger.info('RFQ auto-activated by scheduler', {
          rfqId: rfq.id,
          rfqNumber: rfq.rfq_number,
        });
      } catch (err) {
        await trx.rollback();
        logger.error('Failed to auto-activate RFQ', { rfqId: rfq.id, error: err });
      }
    }
  } catch (err) {
    logger.error('Bid open scheduler error', { error: err });
  }
}

/**
 * Initialize the bid open scheduler. Runs every 30 seconds.
 * Skip initialization in test environment.
 */
export function initBidOpenScheduler(): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  schedulerTask = cron.schedule('*/30 * * * * *', () => {
    checkAndActivateRfqs().catch((err) =>
      logger.error('Bid open scheduler crashed', { error: err }),
    );
  });

  logger.info('Bid open scheduler initialized (every 30 seconds)');
}

export function stopBidOpenScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
  }
}

// Export for testing
export { checkAndActivateRfqs };
