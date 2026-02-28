import { Router } from 'express';
import { loginHandler, refreshHandler, logoutHandler, getMeHandler } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authRateLimiter } from '../../middleware/rate-limit';
import { loginSchema } from '../../shared/validators/auth.validators';

const router = Router();

// POST /api/auth/login — Email + password login
router.post('/login', authRateLimiter, validate(loginSchema), loginHandler);

// POST /api/auth/refresh — Rotate refresh token, issue new access token
router.post('/refresh', refreshHandler);

// POST /api/auth/logout — Invalidate refresh token
router.post('/logout', authenticate, logoutHandler);

// GET /api/auth/me — Get current user profile
router.get('/me', authenticate, getMeHandler);

export default router;
