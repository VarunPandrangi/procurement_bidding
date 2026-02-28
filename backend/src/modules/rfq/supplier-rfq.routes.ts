import { Router } from 'express';
import {
  listSupplierRfqsHandler,
  getSupplierRfqHandler,
  acceptRfqHandler,
  declineRfqHandler,
} from './supplier-rfq.controller';
import { submitBidHandler, reviseBidHandler, getBidStatusHandler } from '../bidding/bid.controller';
import { getSupplierRankingHandler } from '../ranking/ranking.controller';
import { supplierReceiptHandler } from '../export/export.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { UserRole } from '../../shared/types/enums';
import { acceptRfqSchema, declineRfqSchema } from '../../shared/validators/rfq.validators';
import { submitBidSchema, reviseBidSchema } from '../../shared/validators/bid.validators';

const router = Router();

// All supplier RFQ routes require authentication and SUPPLIER role
router.use(authenticate, authorize(UserRole.SUPPLIER));

// GET /api/supplier/rfqs — List RFQs assigned to this supplier
router.get('/', listSupplierRfqsHandler);

// GET /api/supplier/rfqs/:id — View RFQ detail (no competitor data)
router.get('/:id', getSupplierRfqHandler);

// POST /api/supplier/rfqs/:id/accept — Accept RFQ (requires all 3 declarations)
router.post('/:id/accept', validate(acceptRfqSchema), acceptRfqHandler);

// POST /api/supplier/rfqs/:id/decline — Decline RFQ (requires reason >= 20 chars)
router.post('/:id/decline', validate(declineRfqSchema), declineRfqHandler);

// POST /api/supplier/rfqs/:id/bids — Submit initial bid
router.post('/:id/bids', validate(submitBidSchema), submitBidHandler);

// PUT /api/supplier/rfqs/:id/bids — Revise bid
router.put('/:id/bids', validate(reviseBidSchema), reviseBidHandler);

// GET /api/supplier/rfqs/:id/ranking — Own rank + proximity (NEVER competitor data)
router.get('/:id/ranking', getSupplierRankingHandler);

// GET /api/supplier/rfqs/:id/bid-status — Revisions remaining, cooling time
router.get('/:id/bid-status', getBidStatusHandler);

// GET /api/supplier/rfqs/:id/receipt — Download bid confirmation receipt (PDF)
router.get('/:id/receipt', supplierReceiptHandler);

export default router;
