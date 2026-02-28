import { Request, Response, NextFunction } from 'express';
import { getDb } from '../../config/database';
import { sendSuccess } from '../../shared/utils/response';
import { AppError } from '../../middleware/error-handler';
import { getSupplierIdFromUserId } from '../../shared/utils/supplier-lookup';
import {
  createNegotiation,
  getNegotiationForSupplier,
  getNegotiationForBuyer,
  closeNegotiation,
  awardNegotiation,
} from './negotiation.service';
import {
  submitNegotiationBid,
  reviseNegotiationBid,
  getNegotiationBidStatus,
} from '../bidding/bid.service';
import { calculateNegotiationRankings } from '../ranking/ranking.service';
import { serializeSupplierRanking, serializeBuyerRanking } from '../ranking/ranking.serializer';
import { runNegotiationSimulation } from '../simulation/simulation.service';
import { CreateNegotiationInput, AwardNegotiationInput } from '../../shared/validators/negotiation.validators';
import { SubmitBidInput, ReviseBidInput } from '../../shared/validators/bid.validators';
import { SimulationInput } from '../../shared/validators/award.validators';

// ── Buyer handlers ──

/**
 * @swagger
 * /api/buyer/rfqs/{id}/negotiation:
 *   post:
 *     tags: [Buyer Negotiations]
 *     summary: Create a negotiation for an RFQ
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: RFQ ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invited_supplier_ids
 *               - bid_open_at
 *               - bid_close_at
 *             properties:
 *               invited_supplier_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               max_revisions:
 *                 type: integer
 *               min_change_percent:
 *                 type: number
 *               cooling_time_minutes:
 *                 type: integer
 *               bid_open_at:
 *                 type: string
 *                 format: date-time
 *               bid_close_at:
 *                 type: string
 *                 format: date-time
 *               anti_snipe_window_minutes:
 *                 type: integer
 *               anti_snipe_extension_minutes:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Negotiation created successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Forbidden - requires BUYER role
 *       404:
 *         description: RFQ not found
 */
export async function createNegotiationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const rfqId = req.params.id;
    const input = req.body as CreateNegotiationInput;
    const result = await createNegotiation(rfqId, buyerId, input);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/buyer/negotiations/{id}:
 *   get:
 *     tags: [Buyer Negotiations]
 *     summary: Get negotiation detail
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Negotiation ID
 *     responses:
 *       200:
 *         description: Negotiation details with suppliers list
 *       403:
 *         description: Forbidden - requires BUYER role
 *       404:
 *         description: Negotiation not found
 */
export async function getBuyerNegotiationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const negotiationId = req.params.id;
    const result = await getNegotiationForBuyer(negotiationId, buyerId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/buyer/negotiations/{id}/rankings:
 *   get:
 *     tags: [Buyer Negotiations]
 *     summary: Get full negotiation ranking data with credibility classes
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Negotiation ID
 *     responses:
 *       200:
 *         description: Full ranking data with credibility classes
 *       403:
 *         description: Forbidden - requires BUYER role
 *       404:
 *         description: Negotiation not found
 */
export async function getBuyerNegotiationRankingsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const negotiationId = req.params.id;
    const db = getDb();

    // Verify buyer owns this negotiation
    const negotiation = await db('negotiation_events')
      .where({ id: negotiationId, buyer_id: buyerId })
      .first();

    if (!negotiation) {
      throw new AppError(404, 'NEGOTIATION_NOT_FOUND', 'Negotiation not found');
    }

    const rankings = await calculateNegotiationRankings(negotiationId);

    // Fetch credibility classes for all suppliers in rankings
    const supplierIds = rankings.total_rankings.map((tr) => tr.supplier_id);
    const supplierCredData = supplierIds.length > 0
      ? await db('suppliers')
          .whereIn('id', supplierIds as string[])
          .select('id', 'credibility_class')
      : [];
    const credibilityMap = new Map(
      supplierCredData.map((s: { id: string; credibility_class: string }) => [s.id, s.credibility_class]),
    );

    const serialized = serializeBuyerRanking(
      rankings.item_rankings,
      rankings.total_rankings,
      rankings.weighted_rankings,
      credibilityMap,
    );

    sendSuccess(res, serialized);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/buyer/negotiations/{id}/close:
 *   post:
 *     tags: [Buyer Negotiations]
 *     summary: Close an active negotiation
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Negotiation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [confirm]
 *             properties:
 *               confirm:
 *                 type: boolean
 *                 enum: [true]
 *     responses:
 *       200:
 *         description: Negotiation closed successfully
 *       400:
 *         description: Negotiation is not in ACTIVE status
 *       403:
 *         description: Forbidden - requires BUYER role
 *       404:
 *         description: Negotiation not found
 */
export async function closeNegotiationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const negotiationId = req.params.id;
    const result = await closeNegotiation(negotiationId, buyerId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/buyer/negotiations/{id}/award:
 *   post:
 *     tags: [Buyer Negotiations]
 *     summary: Award a closed negotiation
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Negotiation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, allocations]
 *             properties:
 *               type:
 *                 type: string
 *               allocations:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Negotiation awarded successfully
 *       400:
 *         description: Negotiation is not in CLOSED status
 *       403:
 *         description: Forbidden - requires BUYER role
 *       404:
 *         description: Negotiation not found
 */
export async function awardNegotiationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const negotiationId = req.params.id;
    const input = req.body as AwardNegotiationInput;
    const result = await awardNegotiation(negotiationId, buyerId, input);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/buyer/negotiations/{id}/simulation:
 *   post:
 *     tags: [Buyer Negotiations]
 *     summary: Run a what-if award simulation on a negotiation
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Negotiation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mode]
 *             properties:
 *               mode:
 *                 type: string
 *                 description: Discriminated union key determining simulation mode
 *     responses:
 *       200:
 *         description: Simulation result
 *       403:
 *         description: Forbidden - requires BUYER role
 *       404:
 *         description: Negotiation not found
 */
export async function runNegotiationSimulationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const negotiationId = req.params.id;
    const input = req.body as SimulationInput;
    const result = await runNegotiationSimulation(negotiationId, buyerId, input);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// ── Supplier handlers ──

/**
 * @swagger
 * /api/supplier/negotiations/{id}:
 *   get:
 *     tags: [Supplier Negotiations]
 *     summary: Get negotiation detail (anonymity preserved)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Negotiation ID
 *     responses:
 *       200:
 *         description: Negotiation detail with anonymity preserved
 *       403:
 *         description: Forbidden - requires SUPPLIER role
 *       404:
 *         description: Negotiation not found
 */
export async function getSupplierNegotiationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const negotiationId = req.params.id;
    const result = await getNegotiationForSupplier(negotiationId, supplierId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/supplier/negotiations/{id}/bids:
 *   post:
 *     tags: [Supplier Negotiations]
 *     summary: Submit an initial bid for a negotiation
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Negotiation ID
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
 *       400:
 *         description: Invalid input or bid already exists
 *       403:
 *         description: Forbidden - requires SUPPLIER role
 *       404:
 *         description: Negotiation not found
 */
export async function submitNegotiationBidHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const negotiationId = req.params.id;
    const input = req.body as SubmitBidInput;
    const result = await submitNegotiationBid(negotiationId, supplierId, input.items);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function reviseNegotiationBidHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const negotiationId = req.params.id;
    const input = req.body as ReviseBidInput;
    const result = await reviseNegotiationBid(negotiationId, supplierId, input.items);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getSupplierNegotiationRankingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const negotiationId = req.params.id;
    const db = getDb();

    // Verify supplier is assigned to this negotiation
    const assignment = await db('negotiation_suppliers')
      .where({ negotiation_id: negotiationId, supplier_id: supplierId })
      .first();

    if (!assignment) {
      throw new AppError(403, 'FORBIDDEN', 'You are not assigned to this negotiation');
    }

    const rankings = await calculateNegotiationRankings(negotiationId);

    // Serialize through the allowlist serializer — SECURITY BOUNDARY
    const serialized = serializeSupplierRanking(
      supplierId,
      rankings.total_rankings,
      rankings.item_rankings,
    );

    sendSuccess(res, serialized);
  } catch (err) {
    next(err);
  }
}

export async function getNegotiationBidStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const negotiationId = req.params.id;
    const status = await getNegotiationBidStatus(negotiationId, supplierId);
    sendSuccess(res, status);
  } catch (err) {
    next(err);
  }
}
