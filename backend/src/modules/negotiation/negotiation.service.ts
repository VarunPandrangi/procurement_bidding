import { getDb } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { createAuditEntry } from '../audit/audit.service';
import { logger } from '../../config/logger';
import {
  NegotiationStatus,
  AuditEventType,
  ActorType,
  NegotiationSupplierStatus,
} from '../../shared/types/enums';
import { assertNegotiationTransition } from './negotiation-state-machine';

const NEGOTIATION_SELECT_FIELDS = [
  'id',
  'parent_rfq_id',
  'buyer_id',
  'status',
  'max_revisions',
  'min_change_percent',
  'cooling_time_minutes',
  'bid_open_at',
  'bid_close_at',
  'anti_snipe_window_minutes',
  'anti_snipe_extension_minutes',
  'created_at',
  'updated_at',
];

export async function createNegotiation(
  rfqId: string,
  buyerId: string,
  input: {
    invited_supplier_ids: string[];
    max_revisions: number;
    min_change_percent: number;
    cooling_time_minutes: number;
    bid_open_at: string;
    bid_close_at: string;
    anti_snipe_window_minutes?: number;
    anti_snipe_extension_minutes?: number;
  },
): Promise<Record<string, unknown>> {
  const db = getDb();

  // Verify parent RFQ exists and is owned by buyer
  const rfq = await db('rfqs')
    .where({ id: rfqId, buyer_id: buyerId })
    .first();

  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  // Parent RFQ must be CLOSED
  if (rfq.status !== 'CLOSED') {
    throw new AppError(
      409,
      'INVALID_STATE',
      'Parent RFQ must be in CLOSED status to create a negotiation',
    );
  }

  // Get accepted suppliers from parent RFQ
  const acceptedSuppliers = await db('rfq_suppliers')
    .where({ rfq_id: rfqId, status: 'ACCEPTED' })
    .select('supplier_id', 'supplier_code');

  const acceptedSupplierIds = new Set(
    acceptedSuppliers.map((s: { supplier_id: string }) => s.supplier_id),
  );

  // Validate invited suppliers are subset of accepted
  const invalidSuppliers = input.invited_supplier_ids.filter(
    (id) => !acceptedSupplierIds.has(id),
  );
  if (invalidSuppliers.length > 0) {
    throw new AppError(
      422,
      'INVALID_SUPPLIERS',
      'All invited suppliers must be accepted suppliers on the parent RFQ',
      invalidSuppliers.map((id) => ({
        field: 'invited_supplier_ids',
        message: `Supplier ${id} is not an accepted supplier on this RFQ`,
      })),
    );
  }

  // Minimum 2 suppliers
  if (input.invited_supplier_ids.length < 2) {
    throw new AppError(
      422,
      'MIN_SUPPLIERS',
      'At least 2 suppliers must be invited',
    );
  }

  // Build supplier code map
  const supplierCodeMap = new Map(
    acceptedSuppliers.map((s: { supplier_id: string; supplier_code: string }) => [
      s.supplier_id,
      s.supplier_code,
    ]),
  );

  const trx = await db.transaction();

  try {
    // Insert negotiation event
    const [negotiation] = await trx('negotiation_events')
      .insert({
        parent_rfq_id: rfqId,
        buyer_id: buyerId,
        status: NegotiationStatus.DRAFT,
        max_revisions: input.max_revisions,
        min_change_percent: input.min_change_percent,
        cooling_time_minutes: input.cooling_time_minutes,
        bid_open_at: input.bid_open_at,
        bid_close_at: input.bid_close_at,
        anti_snipe_window_minutes: input.anti_snipe_window_minutes ?? 10,
        anti_snipe_extension_minutes: input.anti_snipe_extension_minutes ?? 5,
      })
      .returning(NEGOTIATION_SELECT_FIELDS);

    // Insert negotiation suppliers (auto-ACCEPTED)
    const supplierRows = input.invited_supplier_ids.map((supplierId) => ({
      negotiation_id: negotiation.id,
      supplier_id: supplierId,
      supplier_code: supplierCodeMap.get(supplierId) as string,
      status: NegotiationSupplierStatus.ACCEPTED,
    }));

    const insertedSuppliers = await trx('negotiation_suppliers')
      .insert(supplierRows)
      .returning(['id', 'negotiation_id', 'supplier_id', 'supplier_code', 'status']);

    // Audit entry
    await createAuditEntry(
      {
        rfqId,
        eventType: AuditEventType.NEGOTIATION_CREATED,
        actorType: ActorType.BUYER,
        actorId: buyerId,
        eventData: {
          parentRfqId: rfqId,
          negotiationId: negotiation.id,
          invitedSupplierIds: input.invited_supplier_ids,
          rules: {
            max_revisions: input.max_revisions,
            min_change_percent: input.min_change_percent,
            cooling_time_minutes: input.cooling_time_minutes,
            bid_open_at: input.bid_open_at,
            bid_close_at: input.bid_close_at,
            anti_snipe_window_minutes: input.anti_snipe_window_minutes ?? 10,
            anti_snipe_extension_minutes: input.anti_snipe_extension_minutes ?? 5,
          },
        },
      },
      trx,
    );

    await trx.commit();

    logger.info('Negotiation created', {
      negotiationId: negotiation.id,
      parentRfqId: rfqId,
      buyerId,
      supplierCount: input.invited_supplier_ids.length,
    });

    return { ...negotiation, suppliers: insertedSuppliers };
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

export async function getNegotiationForSupplier(
  negotiationId: string,
  supplierId: string,
): Promise<Record<string, unknown>> {
  const db = getDb();

  // Get negotiation
  const negotiation = await db('negotiation_events')
    .where('id', negotiationId)
    .select(NEGOTIATION_SELECT_FIELDS)
    .first();

  if (!negotiation) {
    throw new AppError(403, 'FORBIDDEN', 'Not authorized for this negotiation');
  }

  // Verify supplier assignment
  const assignment = await db('negotiation_suppliers')
    .where({ negotiation_id: negotiationId, supplier_id: supplierId })
    .select('supplier_code', 'status')
    .first();

  if (!assignment) {
    throw new AppError(403, 'FORBIDDEN', 'Not authorized for this negotiation');
  }

  // Get parent RFQ items
  const items = await db('rfq_items')
    .where('rfq_id', negotiation.parent_rfq_id)
    .orderBy('sl_no')
    .select('id', 'sl_no', 'description', 'specification', 'uom', 'quantity');

  return {
    id: negotiation.id,
    parent_rfq_id: negotiation.parent_rfq_id,
    status: negotiation.status,
    max_revisions: negotiation.max_revisions,
    min_change_percent: negotiation.min_change_percent,
    cooling_time_minutes: negotiation.cooling_time_minutes,
    bid_open_at: negotiation.bid_open_at,
    bid_close_at: negotiation.bid_close_at,
    anti_snipe_window_minutes: negotiation.anti_snipe_window_minutes,
    anti_snipe_extension_minutes: negotiation.anti_snipe_extension_minutes,
    items,
    own_assignment: {
      supplier_code: assignment.supplier_code,
      status: assignment.status,
    },
  };
}

export async function getNegotiationForBuyer(
  negotiationId: string,
  buyerId: string,
): Promise<Record<string, unknown>> {
  const db = getDb();

  const negotiation = await db('negotiation_events')
    .where({ id: negotiationId, buyer_id: buyerId })
    .select(NEGOTIATION_SELECT_FIELDS)
    .first();

  if (!negotiation) {
    throw new AppError(
      404,
      'NEGOTIATION_NOT_FOUND',
      'Negotiation not found',
    );
  }

  // Get suppliers with company names
  const suppliers = await db('negotiation_suppliers')
    .join('suppliers', 'negotiation_suppliers.supplier_id', 'suppliers.id')
    .where('negotiation_suppliers.negotiation_id', negotiationId)
    .select(
      'negotiation_suppliers.supplier_id',
      'negotiation_suppliers.supplier_code',
      'negotiation_suppliers.status',
      'suppliers.company_name',
    );

  // Get parent RFQ items
  const items = await db('rfq_items')
    .where('rfq_id', negotiation.parent_rfq_id)
    .orderBy('sl_no')
    .select('id', 'sl_no', 'description', 'specification', 'uom', 'quantity');

  return { ...negotiation, suppliers, items };
}

export async function closeNegotiation(
  negotiationId: string,
  buyerId: string,
): Promise<Record<string, unknown>> {
  const db = getDb();

  const negotiation = await db('negotiation_events')
    .where({ id: negotiationId, buyer_id: buyerId })
    .first();

  if (!negotiation) {
    throw new AppError(
      404,
      'NEGOTIATION_NOT_FOUND',
      'Negotiation not found',
    );
  }

  if (negotiation.status !== NegotiationStatus.ACTIVE) {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      'Only ACTIVE negotiations can be closed',
    );
  }

  const trx = await db.transaction();

  try {
    const now = new Date();
    const [updated] = await trx('negotiation_events')
      .where({ id: negotiationId })
      .update({ status: NegotiationStatus.CLOSED, updated_at: now })
      .returning(NEGOTIATION_SELECT_FIELDS);

    await createAuditEntry(
      {
        rfqId: negotiation.parent_rfq_id as string,
        eventType: AuditEventType.NEGOTIATION_CLOSED,
        actorType: ActorType.BUYER,
        actorId: buyerId,
        eventData: {
          negotiationId,
          parentRfqId: negotiation.parent_rfq_id,
          close_method: 'manual',
          closed_at: now.toISOString(),
        },
      },
      trx,
    );

    await trx.commit();

    // Post-commit: WebSocket broadcast (fire-and-forget)
    try {
      const { getIO } = await import('../websocket/index');
      const io = getIO();
      if (io) {
        io.to(`negotiation:${negotiationId}:buyer`).emit('negotiation:closed', {
          negotiationId,
        });
        io.to(`negotiation:${negotiationId}:suppliers`).emit(
          'negotiation:closed',
          { negotiationId },
        );
      }
    } catch (wsErr) {
      logger.error('Failed to broadcast negotiation:closed', {
        negotiationId,
        error: wsErr,
      });
    }

    logger.info('Negotiation closed', { negotiationId, buyerId });

    return updated;
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

export async function awardNegotiation(
  negotiationId: string,
  buyerId: string,
  params: {
    type: 'single' | 'split';
    allocations: Array<{ supplier_id: string; item_ids?: string[] }>;
  },
): Promise<Record<string, unknown>> {
  const db = getDb();

  const negotiation = await db('negotiation_events')
    .where({ id: negotiationId, buyer_id: buyerId })
    .first();

  if (!negotiation) {
    throw new AppError(
      404,
      'NEGOTIATION_NOT_FOUND',
      'Negotiation not found',
    );
  }

  try {
    assertNegotiationTransition(
      negotiation.status as NegotiationStatus,
      NegotiationStatus.AWARDED,
    );
  } catch {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      `Cannot award: negotiation is in ${negotiation.status} status. Only CLOSED negotiations can be awarded.`,
    );
  }

  const trx = await db.transaction();

  try {
    const now = new Date();
    const [updated] = await trx('negotiation_events')
      .where({ id: negotiationId })
      .update({ status: NegotiationStatus.AWARDED, updated_at: now })
      .returning(NEGOTIATION_SELECT_FIELDS);

    await createAuditEntry(
      {
        rfqId: negotiation.parent_rfq_id as string,
        eventType: AuditEventType.NEGOTIATION_AWARDED,
        actorType: ActorType.BUYER,
        actorId: buyerId,
        eventData: {
          negotiationId,
          parentRfqId: negotiation.parent_rfq_id,
          award_type: params.type,
          allocations: params.allocations,
          awarded_at: now.toISOString(),
          awarded_by: buyerId,
        },
      },
      trx,
    );

    await trx.commit();

    logger.info('Negotiation awarded', {
      negotiationId,
      buyerId,
      awardType: params.type,
    });

    return updated;
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}
