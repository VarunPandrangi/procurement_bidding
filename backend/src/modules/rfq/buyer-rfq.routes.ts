import { Router } from 'express';
import {
  createRfqHandler,
  listRfqsHandler,
  getRfqHandler,
  updateRfqHandler,
  publishRfqHandler,
  assignSuppliersHandler,
  closeRfqHandler,
  runSimulationHandler,
  awardRfqHandler,
  getRfqAuditLogHandler,
  updateWeightsHandler,
} from './buyer-rfq.controller';
import { excelExportHandler, pdfExportHandler } from '../export/export.controller';
import { getBuyerRankingsHandler } from '../ranking/ranking.controller';
import { getFlagsHandler } from '../flags/flag.controller';
import { createNegotiationHandler } from '../negotiation/negotiation.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { UserRole } from '../../shared/types/enums';
import {
  createRfqSchema,
  updateRfqSchema,
  assignSuppliersSchema,
} from '../../shared/validators/rfq.validators';
import { closeRfqSchema, simulationSchema, awardSchema } from '../../shared/validators/award.validators';
import { updateWeightsSchema } from '../../shared/validators/kpi.validators';
import { createNegotiationSchema } from '../../shared/validators/negotiation.validators';

const router = Router();

// All buyer RFQ routes require authentication and BUYER role
router.use(authenticate, authorize(UserRole.BUYER));

// POST /api/buyer/rfqs — Create RFQ in DRAFT state
router.post('/', validate(createRfqSchema), createRfqHandler);

// GET /api/buyer/rfqs — List buyer's own RFQs
router.get('/', listRfqsHandler);

// GET /api/buyer/rfqs/:id — Get single RFQ with items and suppliers
router.get('/:id', getRfqHandler);

// PUT /api/buyer/rfqs/:id — Update RFQ (DRAFT only, respects commercial lock)
router.put('/:id', validate(updateRfqSchema), updateRfqHandler);

// PATCH /api/buyer/rfqs/:id/weights — Update ranking weights (DRAFT or PUBLISHED)
router.patch('/:id/weights', validate(updateWeightsSchema), updateWeightsHandler);

// POST /api/buyer/rfqs/:id/publish — Transition DRAFT → PUBLISHED
router.post('/:id/publish', publishRfqHandler);

// POST /api/buyer/rfqs/:id/suppliers — Assign suppliers to RFQ
router.post('/:id/suppliers', validate(assignSuppliersSchema), assignSuppliersHandler);

// GET /api/buyer/rfqs/:id/rankings — Full ranking data for buyer
router.get('/:id/rankings', getBuyerRankingsHandler);

// GET /api/buyer/rfqs/:id/flags — Compliance & risk flags (buyer only)
router.get('/:id/flags', getFlagsHandler);

// POST /api/buyer/rfqs/:id/close — Manually close an ACTIVE RFQ
router.post('/:id/close', validate(closeRfqSchema), closeRfqHandler);

// POST /api/buyer/rfqs/:id/simulation — Run award simulation (non-binding)
router.post('/:id/simulation', validate(simulationSchema), runSimulationHandler);

// POST /api/buyer/rfqs/:id/award — Finalize award (CLOSED → AWARDED)
router.post('/:id/award', validate(awardSchema), awardRfqHandler);

// POST /api/buyer/rfqs/:id/negotiation — Create negotiation from CLOSED RFQ
router.post('/:id/negotiation', validate(createNegotiationSchema), createNegotiationHandler);

// GET /api/buyer/rfqs/:id/audit-log — Audit trail for this RFQ
router.get('/:id/audit-log', getRfqAuditLogHandler);

// GET /api/buyer/rfqs/:id/export/excel — Excel export
router.get('/:id/export/excel', excelExportHandler);

// GET /api/buyer/rfqs/:id/export/pdf — PDF export
router.get('/:id/export/pdf', pdfExportHandler);

export default router;
