import { Request, Response } from 'express';
import { sendSuccess } from '../../shared/utils/response';

/**
 * @swagger
 * /api/time/now:
 *   get:
 *     tags: [Time]
 *     summary: Get current server time
 *     description: Public endpoint that returns the current server timestamp (no authentication required)
 *     responses:
 *       200:
 *         description: Current server timestamp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-02-27T12:00:00.000Z"
 */
export function getServerTime(_req: Request, res: Response): void {
  sendSuccess(res, {
    timestamp: new Date().toISOString(),
  });
}
