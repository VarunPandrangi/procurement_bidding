import { Router } from 'express';
import {
  getBuyerNegotiationHandler,
  getBuyerNegotiationRankingsHandler,
  closeNegotiationHandler,
  awardNegotiationHandler,
  runNegotiationSimulationHandler,
} from './negotiation.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { UserRole } from '../../shared/types/enums';
import { closeNegotiationSchema, awardNegotiationSchema } from '../../shared/validators/negotiation.validators';
import { simulationSchema } from '../../shared/validators/award.validators';

const router = Router();

// All buyer negotiation routes require authentication and BUYER role
router.use(authenticate, authorize(UserRole.BUYER));

// GET /api/buyer/negotiations/:id — Get negotiation detail (buyer view)
router.get('/:id', getBuyerNegotiationHandler);

// GET /api/buyer/negotiations/:id/rankings — Full ranking data for buyer
router.get('/:id/rankings', getBuyerNegotiationRankingsHandler);

// POST /api/buyer/negotiations/:id/close — Close an ACTIVE negotiation
router.post('/:id/close', validate(closeNegotiationSchema), closeNegotiationHandler);

// POST /api/buyer/negotiations/:id/award — Award a CLOSED negotiation
router.post('/:id/award', validate(awardNegotiationSchema), awardNegotiationHandler);

// POST /api/buyer/negotiations/:id/simulation — Run award simulation (zero-write)
router.post('/:id/simulation', validate(simulationSchema), runNegotiationSimulationHandler);

export default router;
