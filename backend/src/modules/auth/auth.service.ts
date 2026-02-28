import bcrypt from 'bcryptjs';
import { getDb } from '../../config/database';
import { getRedis } from '../../config/redis';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../shared/utils/token';
import { UserRole, AuditEventType, ActorType } from '../../shared/types/enums';
import { createAuditEntry } from '../audit/audit.service';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/error-handler';
import { User } from '../../shared/types/interfaces';

const REFRESH_TOKEN_PREFIX = 'refresh:';

function getRefreshExpirySeconds(): number {
  const days = parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || '7', 10);
  return days * 24 * 60 * 60;
}

export async function login(
  email: string,
  password: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'password_hash'>;
}> {
  const db = getDb();

  const user = await db('users').where({ email: email.toLowerCase() }).first();

  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (!user.is_active) {
    throw new AppError(401, 'ACCOUNT_DISABLED', 'Account has been deactivated');
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const accessToken = signAccessToken(user.id, user.role as UserRole);
  const { token: refreshToken, jti } = signRefreshToken(user.id);

  // Store refresh token in Redis
  const redis = getRedis();
  const redisKey = `${REFRESH_TOKEN_PREFIX}${user.id}:${jti}`;
  await redis.set(redisKey, 'valid', 'EX', getRefreshExpirySeconds());

  // Audit log
  await createAuditEntry({
    eventType: AuditEventType.USER_LOGIN,
    actorType: user.role as ActorType,
    actorId: user.id,
    eventData: { email: user.email, role: user.role },
  });

  const { password_hash: _, ...userWithoutPassword } = user;

  return {
    accessToken,
    refreshToken,
    user: userWithoutPassword,
  };
}

export async function refresh(refreshTokenStr: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenStr);
  } catch {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  const redis = getRedis();
  const redisKey = `${REFRESH_TOKEN_PREFIX}${payload.userId}:${payload.jti}`;

  // Check if the refresh token exists in Redis
  const exists = await redis.get(redisKey);
  if (!exists) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token has been revoked');
  }

  // Invalidate old refresh token
  await redis.del(redisKey);

  // Check user still exists and is active
  const db = getDb();
  const user = await db('users').where({ id: payload.userId }).first();

  if (!user || !user.is_active) {
    throw new AppError(401, 'ACCOUNT_DISABLED', 'Account has been deactivated');
  }

  // Issue new tokens
  const accessToken = signAccessToken(user.id, user.role as UserRole);
  const { token: newRefreshToken, jti: newJti } = signRefreshToken(user.id);

  // Store new refresh token
  const newRedisKey = `${REFRESH_TOKEN_PREFIX}${user.id}:${newJti}`;
  await redis.set(newRedisKey, 'valid', 'EX', getRefreshExpirySeconds());

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
}

export async function logout(userId: string, refreshTokenStr?: string): Promise<void> {
  const redis = getRedis();

  if (refreshTokenStr) {
    try {
      const payload = verifyRefreshToken(refreshTokenStr);
      const redisKey = `${REFRESH_TOKEN_PREFIX}${payload.userId}:${payload.jti}`;
      await redis.del(redisKey);
    } catch {
      // Token already expired or invalid — still proceed with logout
      logger.warn('Failed to parse refresh token during logout', { userId });
    }
  }

  // Also invalidate all refresh tokens for this user (pattern delete)
  const pattern = `${REFRESH_TOKEN_PREFIX}${userId}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  await createAuditEntry({
    eventType: AuditEventType.USER_LOGOUT,
    actorType: ActorType.SYSTEM,
    actorId: userId,
    eventData: { userId },
  });
}

export async function getMe(userId: string): Promise<Record<string, unknown>> {
  const db = getDb();

  const user = await db('users').where({ id: userId }).first();

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const { password_hash: _, ...userWithoutPassword } = user;

  // If user is a supplier, include supplier details
  if (user.role === UserRole.SUPPLIER) {
    const supplier = await db('suppliers').where({ user_id: userId }).first();
    return {
      ...userWithoutPassword,
      supplier: supplier
        ? {
            id: supplier.id,
            company_name: supplier.company_name,
            contact_name: supplier.contact_name,
            contact_email: supplier.contact_email,
            unique_code: supplier.unique_code,
            category_tags: supplier.category_tags,
          }
        : null,
    };
  }

  return userWithoutPassword;
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  const redis = getRedis();
  const pattern = `${REFRESH_TOKEN_PREFIX}${userId}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
