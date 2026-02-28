import { Router } from 'express';
import { getBuyerKpisHandler } from './kpi.controller';
import { listAvailableSuppliersHandler } from '../rfq/buyer-rfq.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateQuery } from '../../middleware/validate';
import { UserRole } from '../../shared/types/enums';
import { kpiQuerySchema } from '../../shared/validators/kpi.validators';

const router = Router();

// All buyer KPI routes require authentication and BUYER role
router.use(authenticate, authorize(UserRole.BUYER));

// GET /api/buyer/kpis?from=DATE&to=DATE — Buyer's own KPI dashboard
router.get('/kpis', validateQuery(kpiQuerySchema), getBuyerKpisHandler);

// GET /api/buyer/suppliers — List active suppliers for RFQ assignment
router.get('/suppliers', listAvailableSuppliersHandler);

export default router;
