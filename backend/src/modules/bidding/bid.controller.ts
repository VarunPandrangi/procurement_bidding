import { Request, Response, NextFunction } from 'express';
import * as bidService from './bid.service';
import { sendSuccess } from '../../shared/utils/response';
import { SubmitBidInput, ReviseBidInput } from '../../shared/validators/bid.validators';
import { getSupplierIdFromUserId } from '../../shared/utils/supplier-lookup';

/**
 * @swagger
 * /api/supplier/rfqs/{id}/bids:
 *   post:
 *     tags: [Supplier Bidding]
 *     summary: Submit initial bid for an RFQ
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [rfq_item_id, unit_price]
 *                   properties:
 *                     rfq_item_id:
 *                       type: string
 *                       format: uuid
 *                     unit_price:
 *                       type: number
 *     responses:
 *       201:
 *         description: Bid submitted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Supplier role required
 *       409:
 *         description: RFQ not in biddable state
 *       422:
 *         description: Validation error
 */
export async function submitBidHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const rfqId = req.params.id;
    const input = req.body as SubmitBidInput;
    const result = await bidService.submitBid(rfqId, supplierId, input.items);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/supplier/rfqs/{id}/bids:
 *   put:
 *     tags: [Supplier Bidding]
 *     summary: Revise an existing bid
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [rfq_item_id, unit_price]
 *                   properties:
 *                     rfq_item_id:
 *                       type: string
 *                       format: uuid
 *                     unit_price:
 *                       type: number
 *     responses:
 *       200:
 *         description: Bid revised successfully
 *       401:
 *         description: Authentication required
 *       409:
 *         description: RFQ not in biddable state or cooling time active
 *       422:
 *         description: Max revisions exceeded or minimum change not met
 */
export async function reviseBidHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const rfqId = req.params.id;
    const input = req.body as ReviseBidInput;
    const result = await bidService.reviseBid(rfqId, supplierId, input.items);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/supplier/rfqs/{id}/bid-status:
 *   get:
 *     tags: [Supplier Bidding]
 *     summary: Get bid status for current supplier
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
 *         description: Bid status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 has_bid:
 *                   type: boolean
 *                 revisions_used:
 *                   type: integer
 *                 revisions_remaining:
 *                   type: integer
 *                 seconds_until_next_revision:
 *                   type: number
 *       401:
 *         description: Authentication required
 */
export async function getBidStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const rfqId = req.params.id;
    const status = await bidService.getBidStatus(rfqId, supplierId);
    sendSuccess(res, status);
  } catch (err) {
    next(err);
  }
}
