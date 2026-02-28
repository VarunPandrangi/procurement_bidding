import rateLimit, { MemoryStore } from 'express-rate-limit';

const authRateLimitStore = new MemoryStore();

export const authRateLimiter = rateLimit({
  store: authRateLimitStore,
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15', 10) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5', 10),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again later.',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'rate-limited',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  skipSuccessfulRequests: true,
});

export function resetAuthRateLimit(): void {
  authRateLimitStore.resetAll();
}
