import { Router } from 'express';
import { getServerTime } from './time.controller';

const router = Router();

// GET /api/time/now — Server UTC timestamp (public endpoint, no auth required)
router.get('/now', getServerTime);

export default router;
