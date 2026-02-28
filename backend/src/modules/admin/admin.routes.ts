import { Router } from 'express';
import {
  listUsersHandler,
  createUserHandler,
  updateUserHandler,
  onboardSupplierHandler,
  listSuppliersHandler,
  getAuditLogHandler,
  fulfillRfqHandler,
  createOverrideHandler,
  getConfigHandler,
  updateConfigHandler,
  extendRfqHandler,
} from './admin.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate, validateQuery } from '../../middleware/validate';
import { UserRole } from '../../shared/types/enums';
import { createUserSchema, updateUserSchema } from '../../shared/validators/user.validators';
import { onboardSupplierSchema } from '../../shared/validators/supplier.validators';
import { auditLogQuerySchema } from '../../shared/validators/award.validators';
import { fulfillRfqSchema } from '../../shared/validators/credibility.validators';
import {
  overrideSchema,
  updateConfigSchema,
  extendRfqSchema,
} from '../../shared/validators/admin.validators';
import { kpiQuerySchema } from '../../shared/validators/kpi.validators';
import { getAdminKpisHandler } from '../kpi/kpi.controller';

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(authenticate, authorize(UserRole.ADMIN));

// GET /api/admin/users — List all users
router.get('/users', listUsersHandler);

// POST /api/admin/users — Create user (buyer or supplier)
router.post('/users', validate(createUserSchema), createUserHandler);

// PATCH /api/admin/users/:id — Update user (role, active status)
router.patch('/users/:id', validate(updateUserSchema), updateUserHandler);

// GET /api/admin/suppliers — List supplier master
router.get('/suppliers', listSuppliersHandler);

// POST /api/admin/suppliers — Onboard supplier
router.post('/suppliers', validate(onboardSupplierSchema), onboardSupplierHandler);

// GET /api/admin/audit-log — Query audit log (filterable by rfq_id, event_type, date range)
router.get('/audit-log', validateQuery(auditLogQuerySchema), getAuditLogHandler);

// POST /api/admin/overrides — Submit override with justification
router.post('/overrides', validate(overrideSchema), createOverrideHandler);

// GET /api/admin/config — Get system config
router.get('/config', getConfigHandler);

// PUT /api/admin/config/:key — Update system config value
router.put('/config/:key', validate(updateConfigSchema), updateConfigHandler);

// POST /api/admin/rfqs/:id/extend — Admin extend RFQ deadline
router.post('/rfqs/:id/extend', validate(extendRfqSchema), extendRfqHandler);

// POST /api/admin/rfqs/:id/fulfill — Mark awarded supplier as fulfilled
router.post('/rfqs/:id/fulfill', validate(fulfillRfqSchema), fulfillRfqHandler);

// GET /api/admin/kpis?from=DATE&to=DATE — Aggregated KPI dashboard
router.get('/kpis', validateQuery(kpiQuerySchema), getAdminKpisHandler);

export default router;
