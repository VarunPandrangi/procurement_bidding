import { Request, Response, NextFunction } from 'express';
import { getDb } from '../../config/database';
import { getActiveFlags } from './flag.service';
import { sendSuccess } from '../../shared/utils/response';
import { AppError } from '../../middleware/error-handler';

/**
 * @swagger
 * /api/buyer/rfqs/{id}/flags:
 *   get:
 *     tags: [Buyer RFQ]
 *     summary: Get active compliance and risk flags for an RFQ
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: RFQ ID
 *     responses:
 *       200:
 *         description: Active flags array
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       flag_id:
 *                         type: string
 *                       flag_type:
 *                         type: string
 *                       affected_supplier_code:
 *                         type: string
 *                       detail_text:
 *                         type: string
 *                       recommendation_text:
 *                         type: string
 *       401:
 *         description: Authentication required
 *       404:
 *         description: RFQ not found or not owned by buyer
 */
export async function getFlagsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const db = getDb();
    const rfqId = req.params.id;

    // Verify buyer owns this RFQ
    const rfq = await db('rfqs')
      .where({ id: rfqId, buyer_id: req.user!.userId })
      .select('id')
      .first();

    if (!rfq) {
      throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
    }

    const flags = await getActiveFlags(rfqId);
    sendSuccess(res, flags);
  } catch (err) {
    next(err);
  }
}
