import { Request, Response, NextFunction } from 'express';
import * as usersService from '../users/users.service';
import * as suppliersService from '../suppliers/suppliers.service';
import { getAuditEntries, createAuditEntry } from '../audit/audit.service';
import { getDb } from '../../config/database';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import { AppError } from '../../middleware/error-handler';
import { CreateUserInput, UpdateUserInput } from '../../shared/validators/user.validators';
import { OnboardSupplierInput } from '../../shared/validators/supplier.validators';
import { AuditLogQueryInput } from '../../shared/validators/award.validators';
import { FulfillRfqInput } from '../../shared/validators/credibility.validators';
import {
  OverrideInput,
  UpdateConfigInput,
  ExtendRfqInput,
} from '../../shared/validators/admin.validators';
import { UserRole, AuditEventType, ActorType, RFQStatus } from '../../shared/types/enums';
import { logger } from '../../config/logger';
import { publishDeadlineExtended } from '../websocket/pubsub';

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, PROCUREMENT_MANAGER, PROCUREMENT_OFFICER, SUPPLIER]
 *         description: Filter by user role
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
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
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 */
export async function listUsersHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const role = req.query.role as UserRole | undefined;
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;

    const { users, total } = await usersService.listUsers({
      role,
      is_active: isActive,
      page,
      limit,
    });

    sendPaginated(res, users, total, page, limit);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     tags: [Admin]
 *     summary: Create a new user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, full_name, role]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               full_name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, BUYER, SUPPLIER]
 *     responses:
 *       201:
 *         description: User created
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 *       409:
 *         description: Email already exists
 *       422:
 *         description: Validation error
 */
export async function createUserHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as CreateUserInput;
    const adminId = req.user!.userId;

    const user = await usersService.createUser(input, adminId);
    sendSuccess(res, user, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/admin/users/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update user (role, active status)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [ADMIN, BUYER, SUPPLIER]
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 *       404:
 *         description: User not found
 */
export async function updateUserHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.params.id;
    const input = req.body as UpdateUserInput;
    const adminId = req.user!.userId;

    const user = await usersService.updateUser(userId, input, adminId);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/admin/suppliers:
 *   post:
 *     tags: [Admin]
 *     summary: Onboard a new supplier
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, full_name, company_name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               full_name:
 *                 type: string
 *               company_name:
 *                 type: string
 *               contact_name:
 *                 type: string
 *               contact_email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Supplier onboarded
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 *       409:
 *         description: Email already exists
 */
export async function onboardSupplierHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as OnboardSupplierInput;
    const adminId = req.user!.userId;

    const result = await suppliersService.onboardSupplier(input, adminId);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/admin/suppliers:
 *   get:
 *     tags: [Admin]
 *     summary: List all suppliers with credibility data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Paginated list of suppliers
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 */
export async function listSuppliersHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;

    const { suppliers, total } = await suppliersService.listSuppliers({
      is_active: isActive,
      page,
      limit,
    });

    sendPaginated(res, suppliers, total, page, limit);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/admin/audit-log:
 *   get:
 *     tags: [Admin]
 *     summary: Query audit log with filters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rfq_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: event_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date filter (alias for start_date)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date filter (alias for end_date)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Paginated audit log entries
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 */
export async function getAuditLogHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as AuditLogQueryInput;
    const page = query.page || 1;
    const limit = query.limit || 50;

    const startDate = query.start_date || query.from;
    const endDate = query.end_date || query.to;

    const { entries, total } = await getAuditEntries({
      rfqId: query.rfq_id,
      eventType: query.event_type as AuditEventType | undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
    });

    sendPaginated(res, entries, total, page, limit);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/admin/rfqs/{id}/fulfill:
 *   post:
 *     tags: [Admin]
 *     summary: Mark awarded supplier as fulfilled
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [supplier_id]
 *             properties:
 *               supplier_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Supplier marked as fulfilled
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 *       404:
 *         description: RFQ or award not found
 *       409:
 *         description: RFQ not awarded or already fulfilled
 *       422:
 *         description: Supplier not in award allocations
 */
export async function fulfillRfqHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rfqId = req.params.id;
    const adminId = req.user!.userId;
    const { supplier_id } = req.body as FulfillRfqInput;

    const db = getDb();

    // Verify RFQ exists and is AWARDED
    const rfq = await db('rfqs').where({ id: rfqId }).first();
    if (!rfq) {
      throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
    }
    if (rfq.status !== 'AWARDED') {
      throw new AppError(409, 'RFQ_NOT_AWARDED', 'Only AWARDED RFQs can be fulfilled');
    }

    // Verify supplier was in the award allocations
    const awardEntry = await db('audit_log')
      .where({ rfq_id: rfqId, event_type: AuditEventType.AWARD_FINALIZED })
      .first();

    if (!awardEntry) {
      throw new AppError(404, 'AWARD_NOT_FOUND', 'No award record found for this RFQ');
    }

    const eventData =
      typeof awardEntry.event_data === 'string'
        ? JSON.parse(awardEntry.event_data)
        : awardEntry.event_data;

    const allocations = eventData.allocations as Array<{ supplier_id: string }>;
    const isAwarded = allocations.some((a) => a.supplier_id === supplier_id);

    if (!isAwarded) {
      throw new AppError(422, 'SUPPLIER_NOT_AWARDED', 'This supplier was not awarded in this RFQ');
    }

    // Check if already fulfilled for this supplier + RFQ
    const allFulfillEntries = await db('audit_log')
      .where({ rfq_id: rfqId, event_type: AuditEventType.AWARD_FULFILLED })
      .select('event_data');

    for (const entry of allFulfillEntries) {
      const data =
        typeof entry.event_data === 'string' ? JSON.parse(entry.event_data) : entry.event_data;
      if (data.supplier_id === supplier_id) {
        throw new AppError(
          409,
          'ALREADY_FULFILLED',
          'This supplier has already been marked as fulfilled for this RFQ',
        );
      }
    }

    // Create AWARD_FULFILLED audit entry
    await createAuditEntry({
      rfqId,
      eventType: AuditEventType.AWARD_FULFILLED,
      actorType: ActorType.ADMIN,
      actorId: adminId,
      eventData: {
        rfqId,
        supplier_id,
        fulfilled_at: new Date().toISOString(),
        fulfilled_by: adminId,
      },
    });

    // Fire-and-forget credibility recalculation
    try {
      const { calculateCredibilityScore } = await import('../credibility/credibility.service');
      await calculateCredibilityScore(supplier_id);
    } catch (credErr) {
      logger.error('Failed to recalculate credibility after fulfill', {
        rfqId,
        supplierId: supplier_id,
        error: credErr,
      });
    }

    sendSuccess(res, { rfqId, supplier_id, status: 'fulfilled' });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/admin/overrides:
 *   post:
 *     tags: [Admin]
 *     summary: Submit admin override with justification
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entity_type, entity_id, action, justification]
 *             properties:
 *               entity_type:
 *                 type: string
 *               entity_id:
 *                 type: string
 *                 format: uuid
 *               action:
 *                 type: string
 *               justification:
 *                 type: string
 *                 minLength: 50
 *     responses:
 *       201:
 *         description: Override recorded
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 *       422:
 *         description: JUSTIFICATION_TOO_SHORT if justification < 50 characters
 */
export async function createOverrideHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as OverrideInput;
    const adminId = req.user!.userId;

    if (!input.justification || input.justification.length < 50) {
      throw new AppError(
        422,
        'JUSTIFICATION_TOO_SHORT',
        'Justification must be at least 50 characters',
      );
    }

    await createAuditEntry({
      rfqId: null,
      eventType: AuditEventType.ADMIN_OVERRIDE,
      actorType: ActorType.ADMIN,
      actorId: adminId,
      eventData: {
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        action: input.action,
        justification: input.justification,
        admin_id: adminId,
        timestamp: new Date().toISOString(),
      },
    });

    sendSuccess(res, { status: 'override_recorded' }, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/admin/config:
 *   get:
 *     tags: [Admin]
 *     summary: List all system configuration key/value/description rows
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of config entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                       value:
 *                         type: string
 *                       description:
 *                         type: string
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 */
export async function getConfigHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const db = getDb();
    const rows = await db('system_config')
      .select('key', 'value', 'description')
      .orderBy('key', 'asc');

    sendSuccess(res, rows);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/admin/config/{key}:
 *   put:
 *     tags: [Admin]
 *     summary: Update a system configuration value
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Configuration key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [value]
 *             properties:
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: Config updated, records CONFIG_CHANGED audit entry
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Configuration key not found
 */
export async function updateConfigHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const configKey = req.params.key;
    const { value } = req.body as UpdateConfigInput;
    const adminId = req.user!.userId;

    const db = getDb();

    const existing = await db('system_config').where({ key: configKey }).first();
    if (!existing) {
      throw new AppError(404, 'CONFIG_KEY_NOT_FOUND', `Configuration key '${configKey}' not found`);
    }

    const oldValue = existing.value;

    await db('system_config').where({ key: configKey }).update({
      value,
      updated_by: adminId,
      updated_at: new Date(),
    });

    await createAuditEntry({
      rfqId: null,
      eventType: AuditEventType.CONFIG_CHANGED,
      actorType: ActorType.ADMIN,
      actorId: adminId,
      eventData: {
        key: configKey,
        old_value: oldValue,
        new_value: value,
        admin_id: adminId,
        timestamp: new Date().toISOString(),
      },
    });

    const updated = await db('system_config').where({ key: configKey }).first();
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/admin/rfqs/{id}/extend:
 *   post:
 *     tags: [Admin]
 *     summary: Extend RFQ bidding deadline
 *     description: Extends bid_close_at, records ADMIN_OVERRIDE + DEADLINE_EXTENDED audit entries, broadcasts via WebSocket.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [minutes, justification]
 *             properties:
 *               minutes:
 *                 type: integer
 *                 minimum: 1
 *               justification:
 *                 type: string
 *                 minLength: 50
 *     responses:
 *       200:
 *         description: Deadline extended
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 *       404:
 *         description: RFQ not found
 *       409:
 *         description: RFQ not in ACTIVE state
 *       422:
 *         description: JUSTIFICATION_TOO_SHORT if justification < 50 characters
 */
export async function extendRfqHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rfqId = req.params.id;
    const { minutes, justification } = req.body as ExtendRfqInput;
    const adminId = req.user!.userId;

    if (!justification || justification.length < 50) {
      throw new AppError(
        422,
        'JUSTIFICATION_TOO_SHORT',
        'Justification must be at least 50 characters',
      );
    }

    const db = getDb();

    const rfq = await db('rfqs').where({ id: rfqId }).first();
    if (!rfq) {
      throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
    }

    if (rfq.status !== RFQStatus.ACTIVE) {
      throw new AppError(409, 'RFQ_NOT_ACTIVE', 'Only ACTIVE RFQs can be extended');
    }

    const oldCloseAt = rfq.bid_close_at;
    const newCloseAt = new Date(new Date(oldCloseAt).getTime() + minutes * 60 * 1000);

    await db('rfqs')
      .where({ id: rfqId })
      .update({ bid_close_at: newCloseAt, updated_at: new Date() });

    await createAuditEntry({
      rfqId,
      eventType: AuditEventType.ADMIN_OVERRIDE,
      actorType: ActorType.ADMIN,
      actorId: adminId,
      eventData: {
        action: 'DEADLINE_EXTENDED',
        rfq_id: rfqId,
        old_close_at: new Date(oldCloseAt).toISOString(),
        new_close_at: newCloseAt.toISOString(),
        extension_minutes: minutes,
        justification,
        admin_id: adminId,
        timestamp: new Date().toISOString(),
      },
    });

    await createAuditEntry({
      rfqId,
      eventType: AuditEventType.DEADLINE_EXTENDED,
      actorType: ActorType.ADMIN,
      actorId: adminId,
      eventData: {
        rfq_id: rfqId,
        old_close_at: new Date(oldCloseAt).toISOString(),
        new_close_at: newCloseAt.toISOString(),
        extension_minutes: minutes,
        trigger: 'ADMIN_OVERRIDE',
        justification,
        timestamp: new Date().toISOString(),
      },
    });

    // Broadcast via WebSocket
    try {
      await publishDeadlineExtended(rfqId, {
        new_close_at: newCloseAt.toISOString(),
        extension_minutes: minutes,
      });
    } catch (wsErr) {
      logger.error('Failed to broadcast deadline extension via WebSocket', { rfqId, error: wsErr });
    }

    sendSuccess(res, {
      rfq_id: rfqId,
      old_close_at: new Date(oldCloseAt).toISOString(),
      new_close_at: newCloseAt.toISOString(),
      extension_minutes: minutes,
    });
  } catch (err) {
    next(err);
  }
}
