import { getDb } from '../../config/database';
import { RFQStatus, NegotiationStatus } from '../../shared/types/enums';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../config/logger';
import { SimulationInput } from '../../shared/validators/award.validators';

// ── Response interface ──

export interface SimulationResult {
  mode: 'single_supplier' | 'item_split' | 'category_split';
  total_procurement_cost: number;
  delivery_outcome_days: number | null;
  unique_supplier_count: number;
  delta_vs_l1_total: number;
  theoretical_minimum_cost: number;
  per_supplier_breakdown: Array<{
    supplier_code: string;
    items_awarded_count: number;
    subtotal: number;
  }>;
  simulated_at: string;
}

// ── Pure functions (exported for unit testing) ──

/**
 * Resolve mode-specific input into a normalized allocation list.
 * Each allocation has a supplier_id and the list of item_ids they cover.
 */
export function resolveAllocations(
  input: SimulationInput,
  rfqItemIds: string[],
): Array<{ supplier_id: string; item_ids: string[] }> {
  if (input.mode === 'single_supplier') {
    return [{ supplier_id: input.supplier_id, item_ids: [...rfqItemIds] }];
  }

  if (input.mode === 'item_split') {
    // Group items by supplier
    const supplierItemMap = new Map<string, string[]>();
    for (const item of input.items) {
      const list = supplierItemMap.get(item.supplier_id) || [];
      list.push(item.rfq_item_id);
      supplierItemMap.set(item.supplier_id, list);
    }
    return Array.from(supplierItemMap.entries()).map(([supplier_id, item_ids]) => ({
      supplier_id,
      item_ids,
    }));
  }

  // category_split
  return input.categories.map((cat) => ({
    supplier_id: cat.supplier_id,
    item_ids: [...cat.item_ids],
  }));
}

/**
 * Validate all RFQ items are covered exactly once.
 * For item_split: every rfq_item must appear exactly once.
 * For category_split: every rfq_item must appear exactly once (no missing, no double).
 */
export function validateItemCoverage(
  rfqItemIds: string[],
  coveredItemIds: string[],
  _mode: string,
): void {
  const rfqSet = new Set(rfqItemIds);
  const coveredSet = new Set<string>();

  for (const itemId of coveredItemIds) {
    if (!rfqSet.has(itemId)) {
      throw new AppError(422, 'INVALID_ITEM', `Item ${itemId} is not part of this RFQ`);
    }
    if (coveredSet.has(itemId)) {
      throw new AppError(
        422,
        'ITEM_DUPLICATE_ALLOCATION',
        `Item ${itemId} is allocated more than once`,
      );
    }
    coveredSet.add(itemId);
  }

  const missingItems = rfqItemIds.filter((id) => !coveredSet.has(id));
  if (missingItems.length > 0) {
    throw new AppError(
      422,
      'ITEMS_NOT_FULLY_COVERED',
      `The following items are not allocated: ${missingItems.join(', ')}`,
    );
  }
}

/**
 * Calculate theoretical minimum cost: SUM(cheapest unit_price per item * quantity).
 * For each RFQ item, find the lowest unit_price across ALL bidders, then multiply by quantity.
 */
export function calculateTheoreticalMinimum(
  allBidItems: Array<{ rfq_item_id: string; unit_price: number }>,
  rfqItems: Array<{ id: string; quantity: number }>,
): number {
  let total = 0;

  for (const rfqItem of rfqItems) {
    const itemBids = allBidItems.filter((b) => b.rfq_item_id === rfqItem.id);
    if (itemBids.length === 0) continue;

    const minPrice = Math.min(...itemBids.map((b) => b.unit_price));
    total += minPrice * rfqItem.quantity;
  }

  return total;
}

/**
 * Calculate delivery outcome: MAX(supplier_delivery_days) across awarded suppliers.
 * Returns null if no supplier has delivery days set.
 */
export function calculateDeliveryOutcome(
  supplierIds: string[],
  deliveryMap: Map<string, number | null>,
): number | null {
  let maxDays: number | null = null;

  for (const sid of supplierIds) {
    const days = deliveryMap.get(sid);
    if (days != null) {
      if (maxDays === null || days > maxDays) {
        maxDays = days;
      }
    }
  }

  return maxDays;
}

// ── Main simulation function ──

/**
 * Run an award simulation (non-binding, zero-write).
 * Uses read-only SELECT queries only.
 * Does NOT create any audit log entry.
 * Does NOT change RFQ status.
 * Available for ACTIVE, CLOSED, and AWARDED RFQ states.
 */
export async function runSimulation(
  rfqId: string,
  buyerId: string,
  input: SimulationInput,
): Promise<SimulationResult> {
  const db = getDb();

  // 1. Verify buyer owns this RFQ
  const rfq = await db('rfqs')
    .where({ id: rfqId, buyer_id: buyerId })
    .first();

  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  // 2. Verify status is ACTIVE, CLOSED, or AWARDED
  const allowedStatuses = [RFQStatus.ACTIVE, RFQStatus.CLOSED, RFQStatus.AWARDED];
  if (!allowedStatuses.includes(rfq.status as RFQStatus)) {
    throw new AppError(
      409,
      'RFQ_NOT_ELIGIBLE',
      'Simulation is only available for ACTIVE, CLOSED, or AWARDED RFQs',
    );
  }

  // 3. Load RFQ items
  const rfqItems = await db('rfq_items')
    .where('rfq_id', rfqId)
    .select('id', 'description', 'uom', 'quantity')
    .orderBy('sl_no');

  const rfqItemIds = rfqItems.map((i: Record<string, unknown>) => i.id as string);
  const rfqItemMap = new Map(
    rfqItems.map((i: Record<string, unknown>) => [
      i.id as string,
      { id: i.id as string, quantity: parseFloat(i.quantity as string) },
    ]),
  );

  // 4. Resolve mode-specific input into normalized allocations
  const allocations = resolveAllocations(input, rfqItemIds);

  // 5. Extract all covered item IDs for validation
  const allCoveredItemIds = allocations.flatMap((a) => a.item_ids);

  // 6. Validate coverage (single_supplier covers all by definition, but validate split modes)
  if (input.mode === 'item_split' || input.mode === 'category_split') {
    validateItemCoverage(rfqItemIds, allCoveredItemIds, input.mode);
  }

  // 7. Collect distinct supplier IDs
  const uniqueSupplierIds = [...new Set(allocations.map((a) => a.supplier_id))];

  // 8. Load supplier records
  const suppliers = await db('suppliers')
    .whereIn('id', uniqueSupplierIds)
    .select('id', 'unique_code');

  const supplierCodeMap = new Map(
    suppliers.map((s: { id: string; unique_code: string }) => [s.id, s.unique_code]),
  );

  for (const sid of uniqueSupplierIds) {
    if (!supplierCodeMap.has(sid)) {
      throw new AppError(422, 'INVALID_SUPPLIER', `Supplier ${sid} not found`);
    }
  }

  // 9. Load latest bids for allocated suppliers
  const latestBids = await db('bids')
    .where('rfq_id', rfqId)
    .whereIn('supplier_id', uniqueSupplierIds)
    .where('is_latest', true)
    .whereNull('negotiation_id')
    .select('id', 'supplier_id', 'supplier_code', 'total_price');

  const bidBySupplier = new Map(
    latestBids.map((b: Record<string, unknown>) => [b.supplier_id as string, b]),
  );

  // Validate all allocated suppliers have bids
  for (const sid of uniqueSupplierIds) {
    if (!bidBySupplier.has(sid)) {
      throw new AppError(422, 'SUPPLIER_HAS_NO_BID', `Supplier ${sid} has not submitted a bid`);
    }
  }

  // 10. Load bid items for allocated suppliers' bids
  const bidIds = latestBids.map((b: Record<string, unknown>) => b.id as string);
  const bidItems = await db('bid_items')
    .whereIn('bid_id', bidIds)
    .select('bid_id', 'rfq_item_id', 'unit_price', 'total_price');

  // Group bid items by supplier_id (via bid_id → supplier_id mapping)
  const bidIdToSupplier = new Map(
    latestBids.map((b: Record<string, unknown>) => [b.id as string, b.supplier_id as string]),
  );
  const supplierBidItems = new Map<string, Map<string, { unit_price: number; total_price: number }>>();

  for (const item of bidItems) {
    const supplierId = bidIdToSupplier.get(item.bid_id as string)!;
    if (!supplierBidItems.has(supplierId)) {
      supplierBidItems.set(supplierId, new Map());
    }
    supplierBidItems.get(supplierId)!.set(item.rfq_item_id as string, {
      unit_price: parseFloat(item.unit_price as string),
      total_price: parseFloat(item.total_price as string),
    });
  }

  // 11. Load ALL latest bid items for theoretical minimum (all bidders, not just allocated)
  const allLatestBids = await db('bids')
    .where('rfq_id', rfqId)
    .where('is_latest', true)
    .whereNull('negotiation_id')
    .select('id');

  const allBidIds = allLatestBids.map((b: Record<string, unknown>) => b.id as string);
  const allBidItems = allBidIds.length > 0
    ? await db('bid_items')
        .whereIn('bid_id', allBidIds)
        .select('rfq_item_id', 'unit_price')
    : [];

  const parsedAllBidItems = allBidItems.map((item: Record<string, unknown>) => ({
    rfq_item_id: item.rfq_item_id as string,
    unit_price: parseFloat(item.unit_price as string),
  }));

  const parsedRfqItems = rfqItems.map((i: Record<string, unknown>) => ({
    id: i.id as string,
    quantity: parseFloat(i.quantity as string),
  }));

  // 12. Load supplier delivery days from rfq_suppliers (fallback to RFQ delivery_lead_time_days)
  const rfqSuppliers = await db('rfq_suppliers')
    .where('rfq_id', rfqId)
    .whereIn('supplier_id', uniqueSupplierIds)
    .select('supplier_id', 'supplier_delivery_days');

  const rfqDeliveryFallback = rfq.delivery_lead_time_days != null
    ? parseInt(rfq.delivery_lead_time_days as string, 10)
    : null;

  const deliveryMap = new Map(
    rfqSuppliers.map((rs: Record<string, unknown>) => [
      rs.supplier_id as string,
      rs.supplier_delivery_days != null
        ? parseInt(rs.supplier_delivery_days as string, 10)
        : rfqDeliveryFallback,
    ]),
  );

  // ── Calculations ──

  // Total procurement cost and per-supplier breakdown
  let totalProcurementCost = 0;
  const perSupplierBreakdown: SimulationResult['per_supplier_breakdown'] = [];

  for (const allocation of allocations) {
    const supplierItems = supplierBidItems.get(allocation.supplier_id);
    if (!supplierItems) {
      throw new AppError(422, 'SUPPLIER_HAS_NO_BID', `Supplier ${allocation.supplier_id} has not submitted a bid`);
    }

    let subtotal = 0;
    for (const itemId of allocation.item_ids) {
      const bidItem = supplierItems.get(itemId);
      const rfqItem = rfqItemMap.get(itemId);
      if (!bidItem || !rfqItem) {
        throw new AppError(422, 'ITEM_NOT_FOUND', `Item ${itemId} not found in bid or RFQ`);
      }
      subtotal += bidItem.unit_price * rfqItem.quantity;
    }

    totalProcurementCost += subtotal;

    // Find or update existing breakdown entry for this supplier
    const existingEntry = perSupplierBreakdown.find(
      (e) => e.supplier_code === supplierCodeMap.get(allocation.supplier_id),
    );
    if (existingEntry) {
      existingEntry.items_awarded_count += allocation.item_ids.length;
      existingEntry.subtotal += subtotal;
    } else {
      perSupplierBreakdown.push({
        supplier_code: supplierCodeMap.get(allocation.supplier_id) || '',
        items_awarded_count: allocation.item_ids.length,
        subtotal,
      });
    }
  }

  // Theoretical minimum
  const theoreticalMinimum = calculateTheoreticalMinimum(parsedAllBidItems, parsedRfqItems);

  // Delta
  const deltaVsL1Total = totalProcurementCost - theoreticalMinimum;

  // Delivery outcome
  const deliveryOutcomeDays = calculateDeliveryOutcome(uniqueSupplierIds, deliveryMap);

  const result: SimulationResult = {
    mode: input.mode,
    total_procurement_cost: parseFloat(totalProcurementCost.toFixed(4)),
    delivery_outcome_days: deliveryOutcomeDays,
    unique_supplier_count: uniqueSupplierIds.length,
    delta_vs_l1_total: parseFloat(deltaVsL1Total.toFixed(4)),
    theoretical_minimum_cost: parseFloat(theoreticalMinimum.toFixed(4)),
    per_supplier_breakdown: perSupplierBreakdown.map((b) => ({
      ...b,
      subtotal: parseFloat(b.subtotal.toFixed(4)),
    })),
    simulated_at: new Date().toISOString(),
  };

  // ZERO WRITE: No audit entry, no status change, no database writes.

  logger.info('Award simulation run', {
    rfqId,
    buyerId,
    mode: input.mode,
    totalProcurementCost,
    theoreticalMinimum,
  });

  return result;
}

// ── Negotiation simulation function ──

/**
 * Run an award simulation on a negotiation context (non-binding, zero-write).
 * Uses read-only SELECT queries only.
 * Does NOT create any audit log entry.
 * Does NOT change negotiation status.
 * Available for ACTIVE, CLOSED, and AWARDED negotiation states.
 */
export async function runNegotiationSimulation(
  negotiationId: string,
  buyerId: string,
  input: SimulationInput,
): Promise<SimulationResult> {
  const db = getDb();

  // 1. Verify buyer owns this negotiation
  const negotiation = await db('negotiation_events')
    .where({ id: negotiationId, buyer_id: buyerId })
    .first();

  if (!negotiation) {
    throw new AppError(404, 'NEGOTIATION_NOT_FOUND', 'Negotiation not found');
  }

  // 2. Verify status is ACTIVE, CLOSED, or AWARDED
  const allowedStatuses = [NegotiationStatus.ACTIVE, NegotiationStatus.CLOSED, NegotiationStatus.AWARDED];
  if (!allowedStatuses.includes(negotiation.status as NegotiationStatus)) {
    throw new AppError(
      409,
      'NEGOTIATION_NOT_ELIGIBLE',
      'Simulation is only available for ACTIVE, CLOSED, or AWARDED negotiations',
    );
  }

  const parentRfqId = negotiation.parent_rfq_id as string;

  // 3. Load items from parent RFQ
  const rfqItems = await db('rfq_items')
    .where('rfq_id', parentRfqId)
    .select('id', 'description', 'uom', 'quantity')
    .orderBy('sl_no');

  const rfqItemIds = rfqItems.map((i: Record<string, unknown>) => i.id as string);
  const rfqItemMap = new Map(
    rfqItems.map((i: Record<string, unknown>) => [
      i.id as string,
      { id: i.id as string, quantity: parseFloat(i.quantity as string) },
    ]),
  );

  // 4. Resolve mode-specific input into normalized allocations
  const allocations = resolveAllocations(input, rfqItemIds);

  // 5. Extract all covered item IDs for validation
  const allCoveredItemIds = allocations.flatMap((a) => a.item_ids);

  // 6. Validate coverage for split modes
  if (input.mode === 'item_split' || input.mode === 'category_split') {
    validateItemCoverage(rfqItemIds, allCoveredItemIds, input.mode);
  }

  // 7. Collect distinct supplier IDs
  const uniqueSupplierIds = [...new Set(allocations.map((a) => a.supplier_id))];

  // 8. Load supplier codes from negotiation_suppliers
  const negSuppliers = await db('negotiation_suppliers')
    .where('negotiation_id', negotiationId)
    .whereIn('supplier_id', uniqueSupplierIds)
    .select('supplier_id', 'supplier_code');

  const supplierCodeMap = new Map(
    negSuppliers.map((s: { supplier_id: string; supplier_code: string }) => [s.supplier_id, s.supplier_code]),
  );

  for (const sid of uniqueSupplierIds) {
    if (!supplierCodeMap.has(sid)) {
      throw new AppError(422, 'INVALID_SUPPLIER', `Supplier ${sid} not found in this negotiation`);
    }
  }

  // 9. Load latest negotiation bids for allocated suppliers
  const latestBids = await db('bids')
    .where('negotiation_id', negotiationId)
    .whereIn('supplier_id', uniqueSupplierIds)
    .where('is_latest', true)
    .select('id', 'supplier_id', 'supplier_code', 'total_price');

  const bidBySupplier = new Map(
    latestBids.map((b: Record<string, unknown>) => [b.supplier_id as string, b]),
  );

  // Validate all allocated suppliers have bids
  for (const sid of uniqueSupplierIds) {
    if (!bidBySupplier.has(sid)) {
      throw new AppError(422, 'SUPPLIER_HAS_NO_BID', `Supplier ${sid} has not submitted a bid`);
    }
  }

  // 10. Load bid items for allocated suppliers' bids
  const bidIds = latestBids.map((b: Record<string, unknown>) => b.id as string);
  const bidItems = await db('bid_items')
    .whereIn('bid_id', bidIds)
    .select('bid_id', 'rfq_item_id', 'unit_price', 'total_price');

  const bidIdToSupplier = new Map(
    latestBids.map((b: Record<string, unknown>) => [b.id as string, b.supplier_id as string]),
  );
  const supplierBidItems = new Map<string, Map<string, { unit_price: number; total_price: number }>>();

  for (const item of bidItems) {
    const supplierId = bidIdToSupplier.get(item.bid_id as string)!;
    if (!supplierBidItems.has(supplierId)) {
      supplierBidItems.set(supplierId, new Map());
    }
    supplierBidItems.get(supplierId)!.set(item.rfq_item_id as string, {
      unit_price: parseFloat(item.unit_price as string),
      total_price: parseFloat(item.total_price as string),
    });
  }

  // 11. Load ALL latest negotiation bid items for theoretical minimum
  const allLatestBids = await db('bids')
    .where('negotiation_id', negotiationId)
    .where('is_latest', true)
    .select('id');

  const allBidIds = allLatestBids.map((b: Record<string, unknown>) => b.id as string);
  const allBidItems = allBidIds.length > 0
    ? await db('bid_items')
        .whereIn('bid_id', allBidIds)
        .select('rfq_item_id', 'unit_price')
    : [];

  const parsedAllBidItems = allBidItems.map((item: Record<string, unknown>) => ({
    rfq_item_id: item.rfq_item_id as string,
    unit_price: parseFloat(item.unit_price as string),
  }));

  const parsedRfqItems = rfqItems.map((i: Record<string, unknown>) => ({
    id: i.id as string,
    quantity: parseFloat(i.quantity as string),
  }));

  // 12. Load supplier delivery days from parent RFQ's rfq_suppliers (fallback to RFQ delivery_lead_time_days)
  const rfqSuppliers = await db('rfq_suppliers')
    .where('rfq_id', parentRfqId)
    .whereIn('supplier_id', uniqueSupplierIds)
    .select('supplier_id', 'supplier_delivery_days');

  const parentRfq = await db('rfqs')
    .where('id', parentRfqId)
    .select('delivery_lead_time_days')
    .first();

  const negDeliveryFallback = parentRfq?.delivery_lead_time_days != null
    ? parseInt(parentRfq.delivery_lead_time_days as string, 10)
    : null;

  const deliveryMap = new Map(
    rfqSuppliers.map((rs: Record<string, unknown>) => [
      rs.supplier_id as string,
      rs.supplier_delivery_days != null
        ? parseInt(rs.supplier_delivery_days as string, 10)
        : negDeliveryFallback,
    ]),
  );

  // ── Calculations ──

  let totalProcurementCost = 0;
  const perSupplierBreakdown: SimulationResult['per_supplier_breakdown'] = [];

  for (const allocation of allocations) {
    const supplierItems = supplierBidItems.get(allocation.supplier_id);
    if (!supplierItems) {
      throw new AppError(422, 'SUPPLIER_HAS_NO_BID', `Supplier ${allocation.supplier_id} has not submitted a bid`);
    }

    let subtotal = 0;
    for (const itemId of allocation.item_ids) {
      const bidItem = supplierItems.get(itemId);
      const rfqItem = rfqItemMap.get(itemId);
      if (!bidItem || !rfqItem) {
        throw new AppError(422, 'ITEM_NOT_FOUND', `Item ${itemId} not found in bid or RFQ`);
      }
      subtotal += bidItem.unit_price * rfqItem.quantity;
    }

    totalProcurementCost += subtotal;

    const existingEntry = perSupplierBreakdown.find(
      (e) => e.supplier_code === supplierCodeMap.get(allocation.supplier_id),
    );
    if (existingEntry) {
      existingEntry.items_awarded_count += allocation.item_ids.length;
      existingEntry.subtotal += subtotal;
    } else {
      perSupplierBreakdown.push({
        supplier_code: supplierCodeMap.get(allocation.supplier_id) || '',
        items_awarded_count: allocation.item_ids.length,
        subtotal,
      });
    }
  }

  const theoreticalMinimum = calculateTheoreticalMinimum(parsedAllBidItems, parsedRfqItems);
  const deltaVsL1Total = totalProcurementCost - theoreticalMinimum;
  const deliveryOutcomeDays = calculateDeliveryOutcome(uniqueSupplierIds, deliveryMap);

  const result: SimulationResult = {
    mode: input.mode,
    total_procurement_cost: parseFloat(totalProcurementCost.toFixed(4)),
    delivery_outcome_days: deliveryOutcomeDays,
    unique_supplier_count: uniqueSupplierIds.length,
    delta_vs_l1_total: parseFloat(deltaVsL1Total.toFixed(4)),
    theoretical_minimum_cost: parseFloat(theoreticalMinimum.toFixed(4)),
    per_supplier_breakdown: perSupplierBreakdown.map((b) => ({
      ...b,
      subtotal: parseFloat(b.subtotal.toFixed(4)),
    })),
    simulated_at: new Date().toISOString(),
  };

  // ZERO WRITE: No audit entry, no status change, no database writes.

  logger.info('Negotiation simulation run', {
    negotiationId,
    buyerId,
    mode: input.mode,
    totalProcurementCost,
    theoreticalMinimum,
  });

  return result;
}
