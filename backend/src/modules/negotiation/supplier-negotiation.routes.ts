import { Router } from 'express';
import {
  getSupplierNegotiationHandler,
  submitNegotiationBidHandler,
  reviseNegotiationBidHandler,
  getSupplierNegotiationRankingHandler,
  getNegotiationBidStatusHandler,
} from './negotiation.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { UserRole } from '../../shared/types/enums';
import { submitBidSchema, reviseBidSchema } from '../../shared/validators/bid.validators';

const router = Router();

// All supplier negotiation routes require authentication and SUPPLIER role
router.use(authenticate, authorize(UserRole.SUPPLIER));

// GET /api/supplier/negotiations/:id — View negotiation detail (supplier view)
router.get('/:id', getSupplierNegotiationHandler);

// POST /api/supplier/negotiations/:id/bids — Submit initial bid
router.post('/:id/bids', validate(submitBidSchema), submitNegotiationBidHandler);

// PUT /api/supplier/negotiations/:id/bids — Revise bid
router.put('/:id/bids', validate(reviseBidSchema), reviseNegotiationBidHandler);

// GET /api/supplier/negotiations/:id/ranking — Own rank + proximity (NEVER competitor data)
router.get('/:id/ranking', getSupplierNegotiationRankingHandler);

// GET /api/supplier/negotiations/:id/bid-status — Revisions remaining, cooling time
router.get('/:id/bid-status', getNegotiationBidStatusHandler);

export default router;
