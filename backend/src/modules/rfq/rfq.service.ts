import { getDb } from '../../config/database';
import {
  RFQStatus,
  SupplierAssignmentStatus,
  AuditEventType,
  ActorType,
} from '../../shared/types/enums';
import { AppError } from '../../middleware/error-handler';
import { createAuditEntry } from '../audit/audit.service';
import { generateRfqNumber } from './rfq-number.service';
import { assertTransition } from './rfq-state-machine';
import { generateSupplierLinkToken } from '../../shared/utils/token';
import { CreateRfqInput, UpdateRfqInput, AcceptRfqInput } from '../../shared/validators/rfq.validators';
import { UpdateWeightsInput } from '../../shared/validators/kpi.validators';
import { logger } from '../../config/logger';

// Fields that become locked after first supplier acceptance
const COMMERCIAL_FIELDS = [
  'payment_terms',
  'freight_terms',
  'delivery_lead_time_days',
  'taxes_duties',
  'warranty',
  'offer_validity_days',
  'packing_forwarding',
  'special_conditions',
  'items',
];

// Fields from the RFQ table to select (excludes nothing sensitive)
const RFQ_SELECT_FIELDS = [
  'id',
  'rfq_number',
  'buyer_id',
  'title',
  'status',
  'max_revisions',
  'min_change_percent',
  'cooling_time_minutes',
  'bid_open_at',
  'bid_close_at',
  'anti_snipe_window_minutes',
  'anti_snipe_extension_minutes',
  'payment_terms',
  'freight_terms',
  'delivery_lead_time_days',
  'taxes_duties',
  'warranty',
  'offer_validity_days',
  'packing_forwarding',
  'special_conditions',
  'commercial_locked_at',
  'commercial_locked_by_supplier_code',
  'weight_price',
  'weight_delivery',
  'weight_payment',
  'created_at',
  'updated_at',
];

/**
 * Create a new RFQ in DRAFT status.
 */
export async function createRfq(
  input: CreateRfqInput,
  buyerId: string,
): Promise<Record<string, unknown>> {
  const db = getDb();
  const trx = await db.transaction();

  try {
    const rfqNumber = await generateRfqNumber(buyerId, trx);

    const rfqData: Record<string, unknown> = {
      rfq_number: rfqNumber,
      buyer_id: buyerId,
      title: input.title,
      status: RFQStatus.DRAFT,
    };

    // Bidding rule fields
    if (input.max_revisions !== undefined) rfqData.max_revisions = input.max_revisions;
    if (input.min_change_percent !== undefined) rfqData.min_change_percent = input.min_change_percent;
    if (input.cooling_time_minutes !== undefined) rfqData.cooling_time_minutes = input.cooling_time_minutes;
    if (input.bid_open_at !== undefined) rfqData.bid_open_at = input.bid_open_at;
    if (input.bid_close_at !== undefined) rfqData.bid_close_at = input.bid_close_at;
    if (input.anti_snipe_window_minutes !== undefined)
      rfqData.anti_snipe_window_minutes = input.anti_snipe_window_minutes;
    if (input.anti_snipe_extension_minutes !== undefined)
      rfqData.anti_snipe_extension_minutes = input.anti_snipe_extension_minutes;

    // Commercial terms
    if (input.payment_terms !== undefined) rfqData.payment_terms = input.payment_terms;
    if (input.freight_terms !== undefined) rfqData.freight_terms = input.freight_terms;
    if (input.delivery_lead_time_days !== undefined)
      rfqData.delivery_lead_time_days = input.delivery_lead_time_days;
    if (input.taxes_duties !== undefined) rfqData.taxes_duties = input.taxes_duties;
    if (input.warranty !== undefined) rfqData.warranty = input.warranty;
    if (input.offer_validity_days !== undefined) rfqData.offer_validity_days = input.offer_validity_days;
    if (input.packing_forwarding !== undefined) rfqData.packing_forwarding = input.packing_forwarding;
    if (input.special_conditions !== undefined) rfqData.special_conditions = input.special_conditions;

    // Weights
    if (input.weight_price !== undefined) rfqData.weight_price = input.weight_price;
    if (input.weight_delivery !== undefined) rfqData.weight_delivery = input.weight_delivery;
    if (input.weight_payment !== undefined) rfqData.weight_payment = input.weight_payment;

    const [rfq] = await trx('rfqs').insert(rfqData).returning(RFQ_SELECT_FIELDS);

    // Insert items if provided
    let items: Record<string, unknown>[] = [];
    if (input.items && input.items.length > 0) {
      const itemRows = input.items.map((item) => ({
        rfq_id: rfq.id,
        sl_no: item.sl_no,
        description: item.description,
        specification: item.specification || null,
        uom: item.uom,
        quantity: item.quantity,
        last_price: item.last_price ?? null,
      }));

      items = await trx('rfq_items')
        .insert(itemRows)
        .returning(['id', 'rfq_id', 'sl_no', 'description', 'specification', 'uom', 'quantity', 'last_price']);
    }

    await createAuditEntry(
      {
        rfqId: rfq.id as string,
        eventType: AuditEventType.RFQ_CREATED,
        actorType: ActorType.BUYER,
        actorId: buyerId,
        eventData: {
          rfqId: rfq.id,
          rfqNumber: rfq.rfq_number,
          buyerId,
          title: rfq.title,
          itemCount: items.length,
        },
      },
      trx,
    );

    await trx.commit();

    logger.info('RFQ created', { rfqId: rfq.id, rfqNumber: rfq.rfq_number, buyerId });

    return { ...rfq, items };
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * List buyer's own RFQs with pagination and optional status filter.
 */
export async function listBuyerRfqs(
  buyerId: string,
  filters?: { status?: string; page?: number; limit?: number },
): Promise<{ rfqs: Record<string, unknown>[]; total: number }> {
  const db = getDb();
  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const offset = (page - 1) * limit;

  let query = db('rfqs').select(RFQ_SELECT_FIELDS).where('buyer_id', buyerId);
  let countQuery = db('rfqs').where('buyer_id', buyerId);

  if (filters?.status) {
    query = query.where('status', filters.status);
    countQuery = countQuery.where('status', filters.status);
  }

  const [rfqs, [{ count }]] = await Promise.all([
    query.orderBy('created_at', 'desc').offset(offset).limit(limit),
    countQuery.count('id as count'),
  ]);

  return {
    rfqs,
    total: parseInt(count as string, 10),
  };
}

/**
 * Get a single RFQ for the buyer, including items and assigned suppliers.
 * RBAC: buyer can only access their own RFQs (enforced at query level).
 */
export async function getBuyerRfq(
  rfqId: string,
  buyerId: string,
): Promise<Record<string, unknown>> {
  const db = getDb();

  const rfq = await db('rfqs')
    .select(RFQ_SELECT_FIELDS)
    .where({ id: rfqId, buyer_id: buyerId })
    .first();

  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  const items = await db('rfq_items')
    .where('rfq_id', rfqId)
    .orderBy('sl_no')
    .select(['id', 'rfq_id', 'sl_no', 'description', 'specification', 'uom', 'quantity', 'last_price']);

  const suppliers = await db('rfq_suppliers')
    .join('suppliers', 'rfq_suppliers.supplier_id', 'suppliers.id')
    .where('rfq_suppliers.rfq_id', rfqId)
    .select([
      'rfq_suppliers.id',
      'rfq_suppliers.supplier_id',
      'rfq_suppliers.supplier_code',
      'rfq_suppliers.status',
      'rfq_suppliers.accepted_at',
      'rfq_suppliers.decline_reason',
      'rfq_suppliers.declaration_rfq_terms',
      'rfq_suppliers.declaration_no_collusion',
      'rfq_suppliers.declaration_confidentiality',
      'rfq_suppliers.created_at',
      'suppliers.company_name',
      'suppliers.credibility_class',
    ]);

  return { ...rfq, items, suppliers };
}

/**
 * Update an RFQ. Only allowed in DRAFT status. Respects commercial lock.
 */
export async function updateRfq(
  rfqId: string,
  buyerId: string,
  input: UpdateRfqInput,
): Promise<Record<string, unknown>> {
  const db = getDb();

  const rfq = await db('rfqs')
    .where({ id: rfqId, buyer_id: buyerId })
    .first();

  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  if (rfq.status !== RFQStatus.DRAFT) {
    throw new AppError(409, 'RFQ_NOT_DRAFT', 'RFQ can only be updated in DRAFT status');
  }

  // Commercial lock check
  if (rfq.commercial_locked_at) {
    const attemptedCommercialChanges = COMMERCIAL_FIELDS.filter(
      (field) => (input as Record<string, unknown>)[field] !== undefined,
    );
    if (attemptedCommercialChanges.length > 0) {
      throw new AppError(
        409,
        'COMMERCIAL_LOCKED',
        'Commercial terms and items cannot be modified after commercial lock',
        attemptedCommercialChanges.map((f) => ({
          field: f,
          message: 'Locked after supplier acceptance',
        })),
      );
    }
  }

  const trx = await db.transaction();

  try {
    // Build RFQ update data
    const updateData: Record<string, unknown> = { updated_at: new Date() };

    const rfqFields = [
      'title',
      'max_revisions',
      'min_change_percent',
      'cooling_time_minutes',
      'bid_open_at',
      'bid_close_at',
      'anti_snipe_window_minutes',
      'anti_snipe_extension_minutes',
      'payment_terms',
      'freight_terms',
      'delivery_lead_time_days',
      'taxes_duties',
      'warranty',
      'offer_validity_days',
      'packing_forwarding',
      'special_conditions',
      'weight_price',
      'weight_delivery',
      'weight_payment',
    ];

    for (const field of rfqFields) {
      if ((input as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (input as Record<string, unknown>)[field];
      }
    }

    const [updatedRfq] = await trx('rfqs')
      .where({ id: rfqId })
      .update(updateData)
      .returning(RFQ_SELECT_FIELDS);

    // Replace items if provided
    let items: Record<string, unknown>[];
    if ((input as Record<string, unknown>).items !== undefined) {
      await trx('rfq_items').where('rfq_id', rfqId).del();

      const inputItems = (input as Record<string, unknown>).items as Array<{
        sl_no: number;
        description: string;
        specification?: string | null;
        uom: string;
        quantity: number;
        last_price?: number | null;
      }>;

      if (inputItems && inputItems.length > 0) {
        const itemRows = inputItems.map((item) => ({
          rfq_id: rfqId,
          sl_no: item.sl_no,
          description: item.description,
          specification: item.specification || null,
          uom: item.uom,
          quantity: item.quantity,
          last_price: item.last_price ?? null,
        }));

        items = await trx('rfq_items')
          .insert(itemRows)
          .returning(['id', 'rfq_id', 'sl_no', 'description', 'specification', 'uom', 'quantity', 'last_price']);
      } else {
        items = [];
      }
    } else {
      items = await trx('rfq_items')
        .where('rfq_id', rfqId)
        .orderBy('sl_no')
        .select(['id', 'rfq_id', 'sl_no', 'description', 'specification', 'uom', 'quantity', 'last_price']);
    }

    await trx.commit();

    return { ...updatedRfq, items };
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Publish an RFQ: DRAFT → PUBLISHED.
 * Validates: title, ≥1 item, ≥2 suppliers, payment_terms filled.
 */
export async function publishRfq(
  rfqId: string,
  buyerId: string,
): Promise<Record<string, unknown>> {
  const db = getDb();

  const rfq = await db('rfqs')
    .where({ id: rfqId, buyer_id: buyerId })
    .first();

  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  // State machine enforcement
  try {
    assertTransition(rfq.status as RFQStatus, RFQStatus.PUBLISHED);
  } catch {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      `Cannot transition from ${rfq.status} to PUBLISHED`,
    );
  }

  // Publish validation
  const validationErrors: { field: string; message: string }[] = [];

  const itemCount = await db('rfq_items').where('rfq_id', rfqId).count('id as count').first();
  const supplierCount = await db('rfq_suppliers').where('rfq_id', rfqId).count('id as count').first();

  if (!itemCount || parseInt(itemCount.count as string, 10) < 1) {
    validationErrors.push({ field: 'items', message: 'At least 1 item is required to publish' });
  }

  if (!supplierCount || parseInt(supplierCount.count as string, 10) < 2) {
    validationErrors.push({
      field: 'suppliers',
      message: 'At least 2 suppliers must be assigned to publish',
    });
  }

  if (!rfq.payment_terms) {
    validationErrors.push({
      field: 'payment_terms',
      message: 'Payment terms are required to publish',
    });
  }

  if (validationErrors.length > 0) {
    throw new AppError(422, 'PUBLISH_VALIDATION_FAILED', 'RFQ cannot be published', validationErrors);
  }

  const trx = await db.transaction();

  try {
    const [updatedRfq] = await trx('rfqs')
      .where({ id: rfqId })
      .update({ status: RFQStatus.PUBLISHED, updated_at: new Date() })
      .returning(RFQ_SELECT_FIELDS);

    await createAuditEntry(
      {
        rfqId,
        eventType: AuditEventType.RFQ_PUBLISHED,
        actorType: ActorType.BUYER,
        actorId: buyerId,
        eventData: {
          rfqId,
          rfqNumber: updatedRfq.rfq_number,
          supplierCount: parseInt(supplierCount!.count as string, 10),
          itemCount: parseInt(itemCount!.count as string, 10),
        },
      },
      trx,
    );

    // If bid_open_at is null or already in the past, immediately transition to ACTIVE
    const bidOpenAt = updatedRfq.bid_open_at ? new Date(updatedRfq.bid_open_at) : null;
    if (!bidOpenAt || bidOpenAt <= new Date()) {
      await trx('rfqs')
        .where({ id: rfqId })
        .update({ status: RFQStatus.ACTIVE, updated_at: new Date() });
      updatedRfq.status = RFQStatus.ACTIVE;
      logger.info('RFQ immediately activated (bid_open_at in past)', { rfqId });
    }

    await trx.commit();

    logger.info('RFQ published', { rfqId, rfqNumber: updatedRfq.rfq_number, buyerId });

    return updatedRfq;
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Assign suppliers to an RFQ. Only in DRAFT state.
 * Generates tokenized access link per supplier.
 */
export async function assignSuppliers(
  rfqId: string,
  buyerId: string,
  supplierIds: string[],
): Promise<Record<string, unknown>[]> {
  const db = getDb();

  const rfq = await db('rfqs')
    .where({ id: rfqId, buyer_id: buyerId })
    .first();

  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  if (rfq.status !== RFQStatus.DRAFT) {
    throw new AppError(409, 'RFQ_NOT_DRAFT', 'Suppliers can only be assigned in DRAFT status');
  }

  // Validate all supplier_ids exist and are active
  const suppliers = await db('suppliers')
    .whereIn('id', supplierIds)
    .andWhere('is_active', true)
    .select(['id', 'unique_code']);

  if (suppliers.length !== supplierIds.length) {
    const foundIds = new Set(suppliers.map((s: { id: string }) => s.id));
    const missingIds = supplierIds.filter((id) => !foundIds.has(id));
    throw new AppError(
      404,
      'SUPPLIER_NOT_FOUND',
      `One or more suppliers not found or inactive`,
      missingIds.map((id) => ({ field: 'supplier_ids', message: `Supplier ${id} not found or inactive` })),
    );
  }

  // Check for already-assigned suppliers
  const existingAssignments = await db('rfq_suppliers')
    .where('rfq_id', rfqId)
    .whereIn('supplier_id', supplierIds)
    .select('supplier_id');

  if (existingAssignments.length > 0) {
    const duplicateIds = existingAssignments.map((a: { supplier_id: string }) => a.supplier_id);
    throw new AppError(
      409,
      'SUPPLIER_ALREADY_ASSIGNED',
      'One or more suppliers are already assigned to this RFQ',
      duplicateIds.map((id: string) => ({
        field: 'supplier_ids',
        message: `Supplier ${id} is already assigned`,
      })),
    );
  }

  const trx = await db.transaction();

  try {
    const expiryHours = parseInt(process.env.SUPPLIER_LINK_EXPIRY_HOURS || '72', 10);
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    const supplierMap = new Map(
      suppliers.map((s: { id: string; unique_code: string }) => [s.id, s.unique_code]),
    );

    const assignments: Record<string, unknown>[] = [];

    for (const supplierId of supplierIds) {
      const supplierCode = supplierMap.get(supplierId)!;
      const accessToken = generateSupplierLinkToken(supplierId, rfqId);

      const [assignment] = await trx('rfq_suppliers')
        .insert({
          rfq_id: rfqId,
          supplier_id: supplierId,
          supplier_code: supplierCode,
          access_token: accessToken,
          access_token_expires_at: expiresAt,
          status: SupplierAssignmentStatus.PENDING,
        })
        .returning([
          'id',
          'rfq_id',
          'supplier_id',
          'supplier_code',
          'access_token',
          'access_token_expires_at',
          'status',
          'created_at',
        ]);

      assignments.push(assignment);
    }

    await trx.commit();

    logger.info('Suppliers assigned to RFQ', {
      rfqId,
      supplierCount: assignments.length,
    });

    return assignments;
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * List RFQs assigned to a supplier.
 */
export async function listSupplierRfqs(
  supplierId: string,
  filters?: { page?: number; limit?: number },
): Promise<{ rfqs: Record<string, unknown>[]; total: number }> {
  const db = getDb();
  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const offset = (page - 1) * limit;

  const baseQuery = db('rfq_suppliers')
    .join('rfqs', 'rfq_suppliers.rfq_id', 'rfqs.id')
    .where('rfq_suppliers.supplier_id', supplierId);

  const selectFields = RFQ_SELECT_FIELDS.map((f) => `rfqs.${f}`);
  selectFields.push(
    'rfq_suppliers.status as assignment_status',
    'rfq_suppliers.accepted_at',
  );

  const [rfqs, [{ count }]] = await Promise.all([
    baseQuery
      .clone()
      .select(selectFields)
      .orderBy('rfqs.created_at', 'desc')
      .offset(offset)
      .limit(limit),
    baseQuery.clone().count('rfq_suppliers.id as count'),
  ]);

  return {
    rfqs,
    total: parseInt(count as string, 10),
  };
}

/**
 * Get a single RFQ for a supplier. Returns only the supplier's own assignment.
 * NEVER includes other supplier data.
 */
export async function getSupplierRfq(
  rfqId: string,
  supplierId: string,
): Promise<Record<string, unknown>> {
  const db = getDb();

  // Check assignment — this enforces supplier RBAC
  const assignment = await db('rfq_suppliers')
    .where({ rfq_id: rfqId, supplier_id: supplierId })
    .select([
      'id',
      'status',
      'accepted_at',
      'decline_reason',
      'declaration_rfq_terms',
      'declaration_no_collusion',
      'declaration_confidentiality',
      'created_at',
    ])
    .first();

  if (!assignment) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this RFQ');
  }

  const rfq = await db('rfqs').select(RFQ_SELECT_FIELDS).where('id', rfqId).first();

  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  const items = await db('rfq_items')
    .where('rfq_id', rfqId)
    .orderBy('sl_no')
    .select(['id', 'rfq_id', 'sl_no', 'description', 'specification', 'uom', 'quantity', 'last_price']);

  // Return RFQ + items + this supplier's own assignment ONLY
  // No other supplier data, counts, or references
  return {
    ...rfq,
    items,
    assignment,
  };
}

/**
 * Accept an RFQ as a supplier. Requires all 3 declaration booleans to be true.
 * First acceptance triggers the commercial lock.
 */
export async function acceptRfq(
  rfqId: string,
  supplierId: string,
  declarations: AcceptRfqInput,
): Promise<Record<string, unknown>> {
  const db = getDb();

  // Verify assignment exists
  const assignment = await db('rfq_suppliers')
    .where({ rfq_id: rfqId, supplier_id: supplierId })
    .first();

  if (!assignment) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this RFQ');
  }

  if (assignment.status !== SupplierAssignmentStatus.PENDING) {
    throw new AppError(
      409,
      'ALREADY_RESPONDED',
      `You have already ${assignment.status.toLowerCase()} this RFQ`,
    );
  }

  const trx = await db.transaction();

  try {
    // Lock the RFQ row (FOR UPDATE) to prevent concurrent acceptance race conditions
    const rfqRow = await trx('rfqs').where('id', rfqId).forUpdate().first();

    if (!rfqRow) {
      throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
    }

    const now = new Date();

    // Update the assignment
    const [updatedAssignment] = await trx('rfq_suppliers')
      .where({ id: assignment.id })
      .update({
        status: SupplierAssignmentStatus.ACCEPTED,
        accepted_at: now,
        declaration_rfq_terms: declarations.declaration_rfq_terms,
        declaration_no_collusion: declarations.declaration_no_collusion,
        declaration_confidentiality: declarations.declaration_confidentiality,
        updated_at: now,
      })
      .returning([
        'id',
        'rfq_id',
        'supplier_id',
        'supplier_code',
        'status',
        'accepted_at',
        'declaration_rfq_terms',
        'declaration_no_collusion',
        'declaration_confidentiality',
      ]);

    // Check if this is the FIRST acceptance — trigger commercial lock
    if (!rfqRow.commercial_locked_at) {
      const items = await trx('rfq_items').where('rfq_id', rfqId).orderBy('sl_no');

      const commercialSnapshot = {
        payment_terms: rfqRow.payment_terms,
        freight_terms: rfqRow.freight_terms,
        delivery_lead_time_days: rfqRow.delivery_lead_time_days,
        taxes_duties: rfqRow.taxes_duties,
        warranty: rfqRow.warranty,
        offer_validity_days: rfqRow.offer_validity_days,
        packing_forwarding: rfqRow.packing_forwarding,
        special_conditions: rfqRow.special_conditions,
        items: items.map((i: Record<string, unknown>) => ({
          sl_no: i.sl_no,
          description: i.description,
          specification: i.specification,
          uom: i.uom,
          quantity: i.quantity,
        })),
      };

      await trx('rfqs').where('id', rfqId).update({
        commercial_locked_at: now,
        commercial_locked_by_supplier_code: assignment.supplier_code,
        updated_at: now,
      });

      await createAuditEntry(
        {
          rfqId,
          eventType: AuditEventType.COMMERCIAL_LOCK,
          actorType: ActorType.SUPPLIER,
          actorId: supplierId,
          actorCode: assignment.supplier_code,
          eventData: {
            rfqId,
            locked_by_supplier_code: assignment.supplier_code,
            locked_at: now.toISOString(),
            commercial_terms_snapshot: commercialSnapshot,
          },
        },
        trx,
      );

      logger.info('Commercial lock triggered', {
        rfqId,
        supplierCode: assignment.supplier_code,
      });
    }

    // Create acceptance audit entry
    await createAuditEntry(
      {
        rfqId,
        eventType: AuditEventType.SUPPLIER_ACCEPTED,
        actorType: ActorType.SUPPLIER,
        actorId: supplierId,
        actorCode: assignment.supplier_code,
        eventData: {
          rfqId,
          supplierCode: assignment.supplier_code,
          declarations: {
            rfq_terms: declarations.declaration_rfq_terms,
            no_collusion: declarations.declaration_no_collusion,
            confidentiality: declarations.declaration_confidentiality,
          },
          acceptedAt: now.toISOString(),
        },
      },
      trx,
    );

    await trx.commit();

    // Post-commit: recalculate credibility for this supplier (non-blocking)
    try {
      const { calculateCredibilityScore } = await import('../credibility/credibility.service');
      await calculateCredibilityScore(supplierId);
    } catch (credErr) {
      logger.error('Failed to recalculate credibility after accept', { rfqId, supplierId, error: credErr });
    }

    logger.info('Supplier accepted RFQ', {
      rfqId,
      supplierId,
      supplierCode: assignment.supplier_code,
    });

    return updatedAssignment;
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Decline an RFQ as a supplier. Requires reason text of at least 20 characters.
 */
export async function declineRfq(
  rfqId: string,
  supplierId: string,
  reason: string,
): Promise<Record<string, unknown>> {
  const db = getDb();

  const assignment = await db('rfq_suppliers')
    .where({ rfq_id: rfqId, supplier_id: supplierId })
    .first();

  if (!assignment) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this RFQ');
  }

  if (assignment.status !== SupplierAssignmentStatus.PENDING) {
    throw new AppError(
      409,
      'ALREADY_RESPONDED',
      `You have already ${assignment.status.toLowerCase()} this RFQ`,
    );
  }

  const now = new Date();

  const [updatedAssignment] = await db('rfq_suppliers')
    .where({ id: assignment.id })
    .update({
      status: SupplierAssignmentStatus.DECLINED,
      decline_reason: reason,
      updated_at: now,
    })
    .returning([
      'id',
      'rfq_id',
      'supplier_id',
      'supplier_code',
      'status',
      'decline_reason',
    ]);

  await createAuditEntry({
    rfqId,
    eventType: AuditEventType.SUPPLIER_DECLINED,
    actorType: ActorType.SUPPLIER,
    actorId: supplierId,
    actorCode: assignment.supplier_code,
    eventData: {
      rfqId,
      supplierCode: assignment.supplier_code,
      reason,
      declinedAt: now.toISOString(),
    },
  });

  // Post-update: recalculate credibility for this supplier (non-blocking)
  try {
    const { calculateCredibilityScore } = await import('../credibility/credibility.service');
    await calculateCredibilityScore(supplierId);
  } catch (credErr) {
    logger.error('Failed to recalculate credibility after decline', { rfqId, supplierId, error: credErr });
  }

  logger.info('Supplier declined RFQ', {
    rfqId,
    supplierId,
    supplierCode: assignment.supplier_code,
  });

  return updatedAssignment;
}

/**
 * Manually close an active RFQ.
 * Requires confirmation (validated by Zod schema).
 */
export async function closeRfq(
  rfqId: string,
  buyerId: string,
): Promise<Record<string, unknown>> {
  const db = getDb();

  const rfq = await db('rfqs')
    .where({ id: rfqId, buyer_id: buyerId })
    .first();

  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  if (rfq.status !== RFQStatus.ACTIVE) {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      'Only ACTIVE RFQs can be manually closed',
    );
  }

  const trx = await db.transaction();

  try {
    const now = new Date();
    const [updated] = await trx('rfqs')
      .where({ id: rfqId })
      .update({ status: RFQStatus.CLOSED, updated_at: now })
      .returning(RFQ_SELECT_FIELDS);

    await createAuditEntry(
      {
        rfqId,
        eventType: AuditEventType.RFQ_CLOSED,
        actorType: ActorType.BUYER,
        actorId: buyerId,
        eventData: {
          rfqId,
          rfqNumber: rfq.rfq_number,
          close_method: 'manual',
          closed_by: buyerId,
          closed_at: now.toISOString(),
        },
      },
      trx,
    );

    await trx.commit();

    // Post-commit: recalculate credibility for all accepted suppliers (non-blocking)
    try {
      const { calculateCredibilityScore } = await import('../credibility/credibility.service');
      const acceptedSuppliers = await db('rfq_suppliers')
        .where({ rfq_id: rfqId, status: 'ACCEPTED' })
        .select('supplier_id');
      for (const as of acceptedSuppliers) {
        try {
          await calculateCredibilityScore(as.supplier_id);
        } catch (innerErr) {
          logger.error('Failed to recalculate credibility after close', { rfqId, supplierId: as.supplier_id, error: innerErr });
        }
      }
    } catch (credErr) {
      logger.error('Failed to recalculate credibility batch after close', { rfqId, error: credErr });
    }

    // Post-commit: broadcast rfq:closed via WebSocket
    try {
      const { getIO } = await import('../websocket/index');
      const io = getIO();
      if (io) {
        io.to(`rfq:${rfqId}:buyer`).emit('rfq:closed', {
          rfqId,
          close_method: 'manual',
        });
        io.to(`rfq:${rfqId}:suppliers`).emit('rfq:closed', {
          rfqId,
          close_method: 'manual',
        });
      }
    } catch (wsErr) {
      logger.error('Failed to broadcast rfq:closed', { rfqId, error: wsErr });
    }

    logger.info('RFQ manually closed', { rfqId, buyerId });

    return updated;
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Finalize award for a closed RFQ.
 * Accepts single or split award allocation.
 */
export async function awardRfq(
  rfqId: string,
  buyerId: string,
  params: {
    type: 'single' | 'split';
    allocations: Array<{ supplier_id: string; item_ids?: string[] }>;
  },
): Promise<Record<string, unknown>> {
  const db = getDb();

  const rfq = await db('rfqs')
    .where({ id: rfqId, buyer_id: buyerId })
    .first();

  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  try {
    assertTransition(rfq.status as RFQStatus, RFQStatus.AWARDED);
  } catch {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      `Cannot award: RFQ is in ${rfq.status} status. Only CLOSED RFQs can be awarded.`,
    );
  }

  const trx = await db.transaction();

  try {
    const now = new Date();
    const [updated] = await trx('rfqs')
      .where({ id: rfqId })
      .update({ status: RFQStatus.AWARDED, updated_at: now })
      .returning(RFQ_SELECT_FIELDS);

    await createAuditEntry(
      {
        rfqId,
        eventType: AuditEventType.AWARD_FINALIZED,
        actorType: ActorType.BUYER,
        actorId: buyerId,
        eventData: {
          rfqId,
          rfqNumber: rfq.rfq_number,
          award_type: params.type,
          allocations: params.allocations,
          awarded_at: now.toISOString(),
          awarded_by: buyerId,
        },
      },
      trx,
    );

    await trx.commit();

    // Post-commit: recalculate credibility for awarded suppliers (non-blocking)
    try {
      const { calculateCredibilityScore } = await import('../credibility/credibility.service');
      const supplierIds = params.allocations.map((a) => a.supplier_id);
      for (const sId of supplierIds) {
        try {
          await calculateCredibilityScore(sId);
        } catch (innerErr) {
          logger.error('Failed to recalculate credibility after award', { rfqId, supplierId: sId, error: innerErr });
        }
      }
    } catch (credErr) {
      logger.error('Failed to recalculate credibility batch after award', { rfqId, error: credErr });
    }

    logger.info('RFQ awarded', { rfqId, buyerId, awardType: params.type });

    return updated;
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Update RFQ weights. Only allowed in DRAFT or PUBLISHED status.
 * After ACTIVE, weights are locked.
 */
export async function updateWeights(
  rfqId: string,
  buyerId: string,
  weights: UpdateWeightsInput,
): Promise<Record<string, unknown>> {
  const db = getDb();

  const rfq = await db('rfqs')
    .where({ id: rfqId, buyer_id: buyerId })
    .first();

  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  if (rfq.status !== RFQStatus.DRAFT && rfq.status !== RFQStatus.PUBLISHED) {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      'Weights can only be updated in DRAFT or PUBLISHED status',
    );
  }

  const [updated] = await db('rfqs')
    .where({ id: rfqId })
    .update({
      weight_price: weights.weight_price,
      weight_delivery: weights.weight_delivery,
      weight_payment: weights.weight_payment,
      updated_at: new Date(),
    })
    .returning(RFQ_SELECT_FIELDS);

  logger.info('RFQ weights updated', { rfqId, buyerId, weights });

  return updated;
}
