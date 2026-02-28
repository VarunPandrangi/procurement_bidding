import { Request, Response, NextFunction } from 'express';
import * as rfqService from './rfq.service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { AcceptRfqInput, DeclineRfqInput } from '../../shared/validators/rfq.validators';
import { getSupplierIdFromUserId } from '../../shared/utils/supplier-lookup';

/**
 * @swagger
 * /api/supplier/rfqs:
 *   get:
 *     tags: [Supplier RFQ]
 *     summary: List RFQs assigned to the current supplier
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Paginated list of assigned RFQs
 *       401:
 *         description: Authentication required
 */
export async function listSupplierRfqsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const { rfqs, total } = await rfqService.listSupplierRfqs(supplierId, { page, limit });
    sendPaginated(res, rfqs, total, page, limit);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/supplier/rfqs/{id}:
 *   get:
 *     tags: [Supplier RFQ]
 *     summary: Get RFQ detail (supplier view — no competitor data)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: RFQ detail for supplier
 *       401:
 *         description: Authentication required
 *       404:
 *         description: RFQ not found or not assigned to supplier
 */
export async function getSupplierRfqHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const rfqId = req.params.id;
    const rfq = await rfqService.getSupplierRfq(rfqId, supplierId);
    sendSuccess(res, rfq);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/supplier/rfqs/{id}/accept:
 *   post:
 *     tags: [Supplier RFQ]
 *     summary: Accept an RFQ assignment with declarations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [declaration_rfq_terms, declaration_no_collusion, declaration_confidentiality]
 *             properties:
 *               declaration_rfq_terms:
 *                 type: boolean
 *               declaration_no_collusion:
 *                 type: boolean
 *               declaration_confidentiality:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: RFQ accepted
 *       401:
 *         description: Authentication required
 *       409:
 *         description: Already accepted or RFQ not in acceptable state
 *       422:
 *         description: All declarations must be true
 */
export async function acceptRfqHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const rfqId = req.params.id;
    const input = req.body as AcceptRfqInput;
    const result = await rfqService.acceptRfq(rfqId, supplierId, input);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/supplier/rfqs/{id}/decline:
 *   post:
 *     tags: [Supplier RFQ]
 *     summary: Decline an RFQ assignment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 20
 *     responses:
 *       200:
 *         description: RFQ declined
 *       401:
 *         description: Authentication required
 *       409:
 *         description: Already declined or RFQ not in declinable state
 */
export async function declineRfqHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const rfqId = req.params.id;
    const { reason } = req.body as DeclineRfqInput;
    const result = await rfqService.declineRfq(rfqId, supplierId, reason);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
