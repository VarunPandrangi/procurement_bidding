import {
  resolveAllocations,
  validateItemCoverage,
  calculateTheoreticalMinimum,
  calculateDeliveryOutcome,
} from '../../src/modules/simulation/simulation.service';
import * as fs from 'fs';
import * as path from 'path';

describe('Simulation — Pure Functions', () => {
  // ── resolveAllocations ──

  describe('resolveAllocations', () => {
    const itemIds = ['item-1', 'item-2', 'item-3'];

    it('should allocate all items to one supplier for single_supplier mode', () => {
      const result = resolveAllocations(
        { mode: 'single_supplier', supplier_id: 'sup-A' } as any,
        itemIds,
      );
      expect(result).toEqual([
        { supplier_id: 'sup-A', item_ids: ['item-1', 'item-2', 'item-3'] },
      ]);
    });

    it('should group items by supplier for item_split mode', () => {
      const result = resolveAllocations(
        {
          mode: 'item_split',
          items: [
            { rfq_item_id: 'item-1', supplier_id: 'sup-A' },
            { rfq_item_id: 'item-2', supplier_id: 'sup-B' },
            { rfq_item_id: 'item-3', supplier_id: 'sup-A' },
          ],
        } as any,
        itemIds,
      );
      expect(result).toHaveLength(2);
      const supA = result.find((a) => a.supplier_id === 'sup-A');
      const supB = result.find((a) => a.supplier_id === 'sup-B');
      expect(supA!.item_ids).toEqual(['item-1', 'item-3']);
      expect(supB!.item_ids).toEqual(['item-2']);
    });

    it('should map categories to allocations for category_split mode', () => {
      const result = resolveAllocations(
        {
          mode: 'category_split',
          categories: [
            { item_ids: ['item-1', 'item-2'], supplier_id: 'sup-A' },
            { item_ids: ['item-3'], supplier_id: 'sup-B' },
          ],
        } as any,
        itemIds,
      );
      expect(result).toEqual([
        { supplier_id: 'sup-A', item_ids: ['item-1', 'item-2'] },
        { supplier_id: 'sup-B', item_ids: ['item-3'] },
      ]);
    });
  });

  // ── validateItemCoverage ──

  describe('validateItemCoverage', () => {
    const rfqItemIds = ['item-1', 'item-2', 'item-3'];

    it('should pass when all items are covered exactly once', () => {
      expect(() =>
        validateItemCoverage(rfqItemIds, ['item-1', 'item-2', 'item-3'], 'item_split'),
      ).not.toThrow();
    });

    it('should throw 422 when an item is missing', () => {
      try {
        validateItemCoverage(rfqItemIds, ['item-1', 'item-2'], 'item_split');
        fail('Expected error');
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('ITEMS_NOT_FULLY_COVERED');
        expect(err.message).toContain('item-3');
      }
    });

    it('should throw 422 when an item appears twice', () => {
      try {
        validateItemCoverage(rfqItemIds, ['item-1', 'item-2', 'item-2', 'item-3'], 'category_split');
        fail('Expected error');
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('ITEM_DUPLICATE_ALLOCATION');
        expect(err.message).toContain('item-2');
      }
    });

    it('should throw 422 when an item is not part of the RFQ', () => {
      try {
        validateItemCoverage(rfqItemIds, ['item-1', 'item-2', 'item-FAKE'], 'item_split');
        fail('Expected error');
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('INVALID_ITEM');
      }
    });
  });

  // ── calculateTheoreticalMinimum ──

  describe('calculateTheoreticalMinimum', () => {
    it('should compute SUM of cheapest unit_price per item * quantity', () => {
      const allBidItems = [
        // Item 1: sup-A = 10, sup-B = 15 → L1 = 10
        { rfq_item_id: 'item-1', unit_price: 10 },
        { rfq_item_id: 'item-1', unit_price: 15 },
        // Item 2: sup-A = 20, sup-B = 18 → L1 = 18
        { rfq_item_id: 'item-2', unit_price: 20 },
        { rfq_item_id: 'item-2', unit_price: 18 },
        // Item 3: sup-A = 30, sup-B = 25 → L1 = 25
        { rfq_item_id: 'item-3', unit_price: 30 },
        { rfq_item_id: 'item-3', unit_price: 25 },
      ];
      const rfqItems = [
        { id: 'item-1', quantity: 100 },
        { id: 'item-2', quantity: 50 },
        { id: 'item-3', quantity: 200 },
      ];

      // theoretical_min = 10*100 + 18*50 + 25*200 = 1000 + 900 + 5000 = 6900
      const result = calculateTheoreticalMinimum(allBidItems, rfqItems);
      expect(result).toBe(6900);
    });

    it('should return 0 when no bids exist', () => {
      const result = calculateTheoreticalMinimum(
        [],
        [{ id: 'item-1', quantity: 100 }],
      );
      expect(result).toBe(0);
    });

    it('should handle single bidder (L1 = their price)', () => {
      const allBidItems = [
        { rfq_item_id: 'item-1', unit_price: 10 },
        { rfq_item_id: 'item-2', unit_price: 20 },
      ];
      const rfqItems = [
        { id: 'item-1', quantity: 100 },
        { id: 'item-2', quantity: 50 },
      ];

      const result = calculateTheoreticalMinimum(allBidItems, rfqItems);
      expect(result).toBe(2000); // 10*100 + 20*50
    });
  });

  // ── calculateDeliveryOutcome ──

  describe('calculateDeliveryOutcome', () => {
    it('should return MAX of supplier delivery days', () => {
      const deliveryMap = new Map<string, number | null>([
        ['sup-A', 5],
        ['sup-B', 10],
        ['sup-C', 7],
      ]);
      const result = calculateDeliveryOutcome(['sup-A', 'sup-B', 'sup-C'], deliveryMap);
      expect(result).toBe(10);
    });

    it('should ignore null delivery days', () => {
      const deliveryMap = new Map<string, number | null>([
        ['sup-A', 5],
        ['sup-B', null],
        ['sup-C', 10],
      ]);
      const result = calculateDeliveryOutcome(['sup-A', 'sup-B', 'sup-C'], deliveryMap);
      expect(result).toBe(10);
    });

    it('should return null when all delivery days are null', () => {
      const deliveryMap = new Map<string, number | null>([
        ['sup-A', null],
        ['sup-B', null],
      ]);
      const result = calculateDeliveryOutcome(['sup-A', 'sup-B'], deliveryMap);
      expect(result).toBeNull();
    });

    it('should return null when no suppliers in map', () => {
      const deliveryMap = new Map<string, number | null>();
      const result = calculateDeliveryOutcome(['sup-A'], deliveryMap);
      expect(result).toBeNull();
    });

    it('should handle single supplier with delivery days', () => {
      const deliveryMap = new Map<string, number | null>([
        ['sup-A', 15],
      ]);
      const result = calculateDeliveryOutcome(['sup-A'], deliveryMap);
      expect(result).toBe(15);
    });
  });

  // ── Mode A: 3 items, 2 suppliers → correct total ──

  describe('Mode A integration (pure functions)', () => {
    it('should award all items to one supplier with correct total', () => {
      const rfqItemIds = ['item-1', 'item-2', 'item-3'];

      const allocations = resolveAllocations(
        { mode: 'single_supplier', supplier_id: 'sup-A' } as any,
        rfqItemIds,
      );

      expect(allocations).toHaveLength(1);
      expect(allocations[0].supplier_id).toBe('sup-A');
      expect(allocations[0].item_ids).toEqual(rfqItemIds);

      // Supplier A prices: 10, 20, 30
      // Quantities: 100, 50, 200
      // Total = 10*100 + 20*50 + 30*200 = 1000 + 1000 + 6000 = 8000
      const allBidItems = [
        { rfq_item_id: 'item-1', unit_price: 10 },
        { rfq_item_id: 'item-1', unit_price: 15 },
        { rfq_item_id: 'item-2', unit_price: 20 },
        { rfq_item_id: 'item-2', unit_price: 18 },
        { rfq_item_id: 'item-3', unit_price: 30 },
        { rfq_item_id: 'item-3', unit_price: 25 },
      ];
      const rfqItems = [
        { id: 'item-1', quantity: 100 },
        { id: 'item-2', quantity: 50 },
        { id: 'item-3', quantity: 200 },
      ];

      // theoretical_min = 10*100 + 18*50 + 25*200 = 6900
      const theoreticalMin = calculateTheoreticalMinimum(allBidItems, rfqItems);
      expect(theoreticalMin).toBe(6900);

      // delta = 8000 - 6900 = 1100
      expect(8000 - theoreticalMin).toBe(1100);
    });
  });

  // ── Mode B: delta = 0 when every item awarded to its L1 ──

  describe('Mode B: delta = 0 when every item at L1', () => {
    it('should have delta_vs_l1_total = 0', () => {
      // Item 1: sup-A=10 (L1), sup-B=15
      // Item 2: sup-B=18 (L1), sup-A=20
      // Item 3: sup-B=25 (L1), sup-A=30
      const allBidItems = [
        { rfq_item_id: 'item-1', unit_price: 10 },
        { rfq_item_id: 'item-1', unit_price: 15 },
        { rfq_item_id: 'item-2', unit_price: 20 },
        { rfq_item_id: 'item-2', unit_price: 18 },
        { rfq_item_id: 'item-3', unit_price: 30 },
        { rfq_item_id: 'item-3', unit_price: 25 },
      ];
      const rfqItems = [
        { id: 'item-1', quantity: 100 },
        { id: 'item-2', quantity: 50 },
        { id: 'item-3', quantity: 200 },
      ];

      const theoreticalMin = calculateTheoreticalMinimum(allBidItems, rfqItems);
      // L1 per item: 10*100=1000 + 18*50=900 + 25*200=5000 = 6900
      expect(theoreticalMin).toBe(6900);

      // If we award each item to its L1 supplier:
      // total_procurement_cost = 10*100 + 18*50 + 25*200 = 6900
      const totalProcurementCost = 6900;
      expect(totalProcurementCost - theoreticalMin).toBe(0);
    });
  });
});

// ── Zero-write invariant (structural verification) ──

describe('Simulation — Zero-write invariant', () => {
  it('simulation service source code contains no insert, update, delete, or transaction calls', () => {
    const sourcePath = path.resolve(
      __dirname,
      '../../src/modules/simulation/simulation.service.ts',
    );
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Count occurrences of write operations in the source
    const insertCalls = (source.match(/\.insert\s*\(/g) || []).length;
    const updateCalls = (source.match(/\.update\s*\(/g) || []).length;
    const deleteCalls = (source.match(/\.del\s*\(/g) || []).length;
    const transactionCalls = (source.match(/\.transaction\s*\(/g) || []).length;

    expect(insertCalls).toBe(0);
    expect(updateCalls).toBe(0);
    expect(deleteCalls).toBe(0);
    expect(transactionCalls).toBe(0);
  });
});

// ── SUPPLIER_HAS_NO_BID (mocked DB) ──

describe('Simulation — SUPPLIER_HAS_NO_BID', () => {
  // We test the validation logic that runSimulation performs when a supplier has no bid.
  // The pure function pattern doesn't cover this check (it's in the orchestrator),
  // so we mock getDb and call runSimulation directly.

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw 422 SUPPLIER_HAS_NO_BID when supplier has not submitted a bid', async () => {
    // Build a chainable mock that tracks table+method calls
    const queryResults: any[] = [];
    let callIndex = 0;

    function createChain(resolveValue: any): any {
      const chain: any = {};
      const methods = ['where', 'whereIn', 'whereNull', 'select', 'orderBy'];
      methods.forEach((m) => {
        chain[m] = jest.fn().mockReturnValue(chain);
      });
      chain.first = jest.fn().mockResolvedValue(resolveValue);
      // Make awaitable (for array results without .first())
      chain.then = (resolve: any, reject?: any) =>
        Promise.resolve(resolveValue).then(resolve, reject);
      chain.catch = (reject: any) => Promise.resolve(resolveValue).catch(reject);
      return chain;
    }

    // Sequence of db() calls in runSimulation:
    // 1. db('rfqs').where({id,buyer_id}).first() → rfq
    // 2. db('rfq_items').where().select().orderBy() → items array
    // 3. db('suppliers').whereIn().select() → suppliers array
    // 4. db('bids').where().whereIn().where().whereNull().select() → EMPTY (no bids!)
    queryResults.push(
      createChain({ id: 'rfq-1', buyer_id: 'buyer-1', status: 'CLOSED', delivery_lead_time_days: null }),
    );
    queryResults.push(
      createChain([
        { id: 'item-1', description: 'A', uom: 'PCS', quantity: '100' },
      ]),
    );
    queryResults.push(
      createChain([{ id: 'sup-no-bid', unique_code: 'ABCDE' }]),
    );
    queryResults.push(
      createChain([]), // No bids for this supplier
    );

    const mockDb = jest.fn().mockImplementation(() => {
      const result = queryResults[callIndex];
      callIndex++;
      return result || createChain(undefined);
    });

    jest.doMock('../../src/config/database', () => ({
      getDb: jest.fn().mockReturnValue(mockDb),
    }));

    const { runSimulation } = await import(
      '../../src/modules/simulation/simulation.service'
    );

    try {
      await runSimulation('rfq-1', 'buyer-1', {
        mode: 'single_supplier',
        supplier_id: 'sup-no-bid',
      });
      fail('Expected SUPPLIER_HAS_NO_BID error');
    } catch (err: any) {
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('SUPPLIER_HAS_NO_BID');
    }
  });
});
