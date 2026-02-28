import { Request, Response, NextFunction } from 'express';
import * as rfqService from './rfq.service';
import { runSimulation } from '../simulation/simulation.service';
import { getAuditEntries } from '../audit/audit.service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { AppError } from '../../middleware/error-handler';
import { CreateRfqInput, UpdateRfqInput, AssignSuppliersInput } from '../../shared/validators/rfq.validators';
import { SimulationInput, AwardInput } from '../../shared/validators/award.validators';
import { UpdateWeightsInput } from '../../shared/validators/kpi.validators';
import { AuditEventType } from '../../shared/types/enums';
import { getDb } from '../../config/database';

/**
 * @swagger
 * /api/buyer/rfqs:
 *   post:
 *     tags: [Buyer RFQs]
 *     summary: Create a new RFQ
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, items]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unit:
 *                       type: string
 *     responses:
 *       201:
 *         description: RFQ created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires BUYER role
 */
export async function createRfqHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as CreateRfqInput;
    const buyerId = req.user!.userId;
    const rfq = await rfqService.createRfq(input, buyerId);
    sendSuccess(res, rfq, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/buyer/rfqs:
 *   get:
 *     tags: [Buyer RFQs]
 *     summary: List buyer's RFQs with pagination
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, ACTIVE, CLOSED, AWARDED]
 *         description: Filter by RFQ status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Paginated list of RFQs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires BUYER role
 */
export async function listRfqsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const status = req.query.status as string | undefined;

    const { rfqs, total } = await rfqService.listBuyerRfqs(buyerId, { status, page, limit });
    sendPaginated(res, rfqs, total, page, limit);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/buyer/rfqs/{id}:
 *   get:
 *     tags: [Buyer RFQs]
 *     summary: Get a single RFQ with items and assigned suppliers
 *     security: [{ bearerAuth: [] }]
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
 *         description: RFQ details with items and suppliers
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires BUYER role
 *       404:
 *         description: RFQ not found
 */
export async function getRfqHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const rfqId = req.params.id;
    const rfq = await rfqService.getBuyerRfq(rfqId, buyerId);
    sendSuccess(res, rfq);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/buyer/rfqs/{id}:
 *   put:
 *     tags: [Buyer RFQs]
 *     summary: Update an existing RFQ
 *     security: [{ bearerAuth: [] }]
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
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Updated RFQ
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires BUYER role
 *       404:
 *         description: RFQ not found
 */
export async function updateRfqHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const rfqId = req.params.id;
    const input = req.body as UpdateRfqInput;
    const rfq = await rfqService.updateRfq(rfqId, buyerId, input);
    sendSuccess(res, rfq);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/buyer/rfqs/{id}/publish:
 *   post:
 *     tags: [Buyer RFQs]
 *     summary: Publish a draft RFQ (DRAFT -> PUBLISHED)
 *     security: [{ bearerAuth: [] }]
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
 *         description: RFQ published successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires BUYER role
 *       404:
 *         description: RFQ not found
 *       409:
 *         description: RFQ is not in DRAFT status
 */
export async function publishRfqHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const rfqId = req.params.id;
    const rfq = await rfqService.publishRfq(rfqId, buyerId);
    sendSuccess(res, rfq);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/buyer/rfqs/{id}/suppliers:
 *   post:
 *     tags: [Buyer RFQs]
 *     summary: Assign suppliers to an RFQ
 *     security: [{ bearerAuth: [] }]
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
 *             required: [supplier_ids]
 *             properties:
 *               supplier_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       201:
 *         description: Suppliers assigned successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires BUYER role
 *       404:
 *         description: RFQ not found
 */
export async function assignSuppliersHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const rfqId = req.params.id;
    const { supplier_ids } = req.body as AssignSuppliersInput;
    const assignments = await rfqService.assignSuppliers(rfqId, buyerId, supplier_ids);
    sendSuccess(res, assignments, 201);
  } catch (err) {
    next(err);
  }
}

export async function closeRfqHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const rfqId = req.params.id;
    const rfq = await rfqService.closeRfq(rfqId, buyerId);
    sendSuccess(res, rfq);
  } catch (err) {
    next(err);
  }
}

export async function runSimulationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const rfqId = req.params.id;
    const input = req.body as SimulationInput;
    const result = await runSimulation(rfqId, buyerId, input);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function awardRfqHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const rfqId = req.params.id;
    const input = req.body as AwardInput;
    const rfq = await rfqService.awardRfq(rfqId, buyerId, input);
    sendSuccess(res, rfq);
  } catch (err) {
    next(err);
  }
}

export async function getRfqAuditLogHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const rfqId = req.params.id;

    // Verify buyer owns this RFQ
    const db = getDb();
    const rfq = await db('rfqs').where({ id: rfqId, buyer_id: buyerId }).first();
    if (!rfq) {
      throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const eventType = req.query.event_type as AuditEventType | undefined;

    const { entries, total } = await getAuditEntries({
      rfqId,
      eventType,
      page,
      limit,
    });

    sendPaginated(res, entries, total, page, limit);
  } catch (err) {
    next(err);
  }
}

export async function updateWeightsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const rfqId = req.params.id;
    const input = req.body as UpdateWeightsInput;
    const rfq = await rfqService.updateWeights(rfqId, buyerId, input);
    sendSuccess(res, rfq);
  } catch (err) {
    next(err);
  }
}

export async function listAvailableSuppliersHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const db = getDb();
    const suppliers = await db('suppliers')
      .select('id', 'company_name', 'unique_code', 'credibility_class', 'is_active')
      .where({ is_active: true })
      .orderBy('company_name', 'asc');
    sendSuccess(res, suppliers);
  } catch (err) {
    next(err);
  }
}
