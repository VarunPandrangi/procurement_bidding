import { Request, Response, NextFunction } from 'express';
import {
  rfqCycleTimeHours,
  savingsVsLastPrice,
  participationRatio,
  priceConvergenceCV,
  supplierCompetitivenessIndex,
  rfqCount,
} from './kpi.service';
import { sendSuccess } from '../../shared/utils/response';

/**
 * @swagger
 * /api/buyer/kpis:
 *   get:
 *     tags: [Buyer KPIs]
 *     summary: Get buyer-scoped KPI dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *     responses:
 *       200:
 *         description: KPI metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cycle_time_hours:
 *                   type: number
 *                 savings_pct:
 *                   type: number
 *                 participation_ratio_pct:
 *                   type: number
 *                 price_convergence_cv:
 *                   type: number
 *                 rfq_count:
 *                   type: integer
 *       401:
 *         description: Authentication required
 */
export async function getBuyerKpisHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    const filters = { buyerId, from, to };

    const [cycleTime, savings, participation, convergence, count] = await Promise.all([
      rfqCycleTimeHours(filters),
      savingsVsLastPrice(filters),
      participationRatio(filters),
      priceConvergenceCV(filters),
      rfqCount(filters),
    ]);

    sendSuccess(res, {
      cycle_time_hours: cycleTime.value,
      savings_pct: savings,
      participation_ratio_pct: participation,
      price_convergence_cv: convergence,
      rfq_count: count,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/admin/kpis:
 *   get:
 *     tags: [Admin]
 *     summary: Get system-wide KPI dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *     responses:
 *       200:
 *         description: System-wide KPI metrics with supplier competitiveness
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 */
export async function getAdminKpisHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    const filters = { from, to };

    const [cycleTime, savings, participation, convergence, count, competitiveness] =
      await Promise.all([
        rfqCycleTimeHours(filters),
        savingsVsLastPrice(filters),
        participationRatio(filters),
        priceConvergenceCV(filters),
        rfqCount(filters),
        supplierCompetitivenessIndex(),
      ]);

    sendSuccess(res, {
      cycle_time_hours: cycleTime.value,
      savings_pct: savings,
      participation_ratio_pct: participation,
      price_convergence_cv: convergence,
      rfq_count: count,
      supplier_competitiveness: competitiveness,
    });
  } catch (err) {
    next(err);
  }
}
