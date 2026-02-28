import { Request, Response, NextFunction } from 'express';
import { getDb } from '../../config/database';
import { sendSuccess } from '../../shared/utils/response';
import { AppError } from '../../middleware/error-handler';
import { getSupplierIdFromUserId } from '../../shared/utils/supplier-lookup';
import { calculateRankings } from './ranking.service';
import { serializeSupplierRanking, serializeBuyerRanking } from './ranking.serializer';

/**
 * @swagger
 * /api/supplier/rfqs/{id}/ranking:
 *   get:
 *     tags: [Supplier Ranking]
 *     summary: Get own ranking position (security-restricted view)
 *     description: Returns only rank_color, proximity_label, own_items, own_total_price. No competitor data.
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
 *         description: Supplier ranking view (restricted)
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not assigned to this RFQ
 */
export async function getSupplierRankingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const rfqId = req.params.id;
    const db = getDb();

    // Verify supplier is assigned to this RFQ
    const assignment = await db('rfq_suppliers')
      .where({ rfq_id: rfqId, supplier_id: supplierId })
      .first();

    if (!assignment) {
      throw new AppError(403, 'FORBIDDEN', 'You are not assigned to this RFQ');
    }

    // Calculate rankings
    const rankings = await calculateRankings(rfqId);

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

/**
 * @swagger
 * /api/buyer/rfqs/{id}/rankings:
 *   get:
 *     tags: [Buyer RFQ]
 *     summary: Get full ranking data for an RFQ
 *     description: Returns item_rankings, total_rankings with credibility classes, and weighted_rankings.
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
 *         description: Full ranking data
 *       401:
 *         description: Authentication required
 *       404:
 *         description: RFQ not found or not owned by buyer
 */
export async function getBuyerRankingsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const rfqId = req.params.id;
    const db = getDb();

    // Verify buyer owns this RFQ
    const rfq = await db('rfqs')
      .where({ id: rfqId, buyer_id: buyerId })
      .first();

    if (!rfq) {
      throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
    }

    // Calculate rankings
    const rankings = await calculateRankings(rfqId);

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

    // Serialize full buyer view with credibility data
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
