import { getRedis } from '../../config/redis';
import { logger } from '../../config/logger';
import { RankingResult } from '../../shared/types/interfaces';

export async function publishRankingUpdate(
  rfqId: string,
  rankings: RankingResult,
): Promise<void> {
  try {
    const redis = getRedis();
    const payload = JSON.stringify({ rfqId, ...rankings });
    await redis.publish(`ranking:${rfqId}`, payload);
    logger.info('Ranking update published', { rfqId });
  } catch (err) {
    logger.error('Failed to publish ranking update to Redis', { rfqId, error: err });
  }
}

export async function publishDeadlineExtended(
  rfqId: string,
  data: { new_close_at: string; extension_minutes: number },
): Promise<void> {
  try {
    const redis = getRedis();
    const payload = JSON.stringify({ rfqId, ...data });
    await redis.publish(`deadline:${rfqId}`, payload);
    logger.info('Deadline extension published', { rfqId });
  } catch (err) {
    logger.error('Failed to publish deadline extension to Redis', { rfqId, error: err });
  }
}

export async function publishNegotiationRankingUpdate(
  negotiationId: string,
  rankings: RankingResult,
): Promise<void> {
  try {
    const redis = getRedis();
    const payload = JSON.stringify({ negotiationId, ...rankings });
    await redis.publish(`ranking:neg:${negotiationId}`, payload);
    logger.info('Negotiation ranking update published', { negotiationId });
  } catch (err) {
    logger.error('Failed to publish negotiation ranking update to Redis', { negotiationId, error: err });
  }
}

export async function publishNegotiationDeadlineExtended(
  negotiationId: string,
  data: { new_close_at: string; extension_minutes: number },
): Promise<void> {
  try {
    const redis = getRedis();
    const payload = JSON.stringify({ negotiationId, ...data });
    await redis.publish(`deadline:neg:${negotiationId}`, payload);
    logger.info('Negotiation deadline extension published', { negotiationId });
  } catch (err) {
    logger.error('Failed to publish negotiation deadline extension to Redis', { negotiationId, error: err });
  }
}
