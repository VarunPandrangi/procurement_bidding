import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { getDb } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { RFQStatus } from '../../shared/types/enums';
import { calculateRankings } from '../ranking/ranking.service';
import { getAuditEntries } from '../audit/audit.service';

/**
 * Generate a PDF confirmation receipt for a supplier's bid.
 * Contains: RFQ number, supplier code, revision number, submitted_at, SHA-256 hash, total price, line items.
 */
export async function generateSupplierReceipt(rfqId: string, supplierId: string): Promise<Buffer> {
  const db = getDb();

  // Verify assignment
  const assignment = await db('rfq_suppliers')
    .where({ rfq_id: rfqId, supplier_id: supplierId })
    .first();

  if (!assignment) {
    throw new AppError(403, 'FORBIDDEN', 'You are not assigned to this RFQ');
  }

  // Get RFQ details
  const rfq = await db('rfqs')
    .where('id', rfqId)
    .select('id', 'rfq_number', 'title', 'status')
    .first();

  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  // Get latest bid
  const bid = await db('bids')
    .where({ rfq_id: rfqId, supplier_id: supplierId, is_latest: true })
    .first();

  if (!bid) {
    throw new AppError(404, 'NO_BID_FOUND', 'No bid found for this RFQ');
  }

  // Get bid items with RFQ item descriptions
  const bidItems = await db('bid_items')
    .join('rfq_items', 'bid_items.rfq_item_id', 'rfq_items.id')
    .where('bid_items.bid_id', bid.id)
    .select(
      'bid_items.rfq_item_id',
      'bid_items.unit_price',
      'bid_items.total_price',
      'rfq_items.sl_no',
      'rfq_items.description',
      'rfq_items.uom',
      'rfq_items.quantity',
    )
    .orderBy('rfq_items.sl_no');

  // Generate PDF
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('Bid Confirmation Receipt', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .font('Helvetica')
      .text('This receipt confirms the submission of a bid.', { align: 'center' });
    doc.moveDown(1.5);

    // RFQ Details
    doc.fontSize(12).font('Helvetica-Bold').text('RFQ Details');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`RFQ Number: ${rfq.rfq_number}`);
    doc.text(`Title: ${rfq.title}`);
    doc.text(`Status: ${rfq.status}`);
    doc.moveDown(1);

    // Bid Details
    doc.fontSize(12).font('Helvetica-Bold').text('Bid Details');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Supplier Code: ${bid.supplier_code}`);
    doc.text(`Revision Number: ${bid.revision_number}`);
    doc.text(`Submitted At: ${new Date(bid.submitted_at).toISOString()}`);
    doc.text(`Total Price: ${parseFloat(bid.total_price).toFixed(2)}`);
    doc.moveDown(0.5);
    doc.text(`SHA-256 Hash: ${bid.submission_hash}`);
    doc.moveDown(1);

    // Line Items Table
    doc.fontSize(12).font('Helvetica-Bold').text('Line Items');
    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y;
    const colX = [50, 80, 220, 290, 350, 420];
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('SL', colX[0], tableTop);
    doc.text('Description', colX[1], tableTop);
    doc.text('UOM', colX[2], tableTop);
    doc.text('Qty', colX[3], tableTop);
    doc.text('Unit Price', colX[4], tableTop);
    doc.text('Total', colX[5], tableTop);

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(545, tableTop + 15)
      .stroke();

    let y = tableTop + 20;
    doc.fontSize(9).font('Helvetica');

    for (const item of bidItems) {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }
      doc.text(String(item.sl_no), colX[0], y);
      doc.text(String(item.description).substring(0, 25), colX[1], y);
      doc.text(String(item.uom), colX[2], y);
      doc.text(String(parseFloat(item.quantity)), colX[3], y);
      doc.text(parseFloat(item.unit_price).toFixed(2), colX[4], y);
      doc.text(parseFloat(item.total_price).toFixed(2), colX[5], y);
      y += 18;
    }

    // Total line
    doc.moveTo(50, y).lineTo(545, y).stroke();
    y += 5;
    doc.font('Helvetica-Bold');
    doc.text('Total:', colX[4], y);
    doc.text(parseFloat(bid.total_price).toFixed(2), colX[5], y);

    // Footer
    doc.moveDown(3);
    doc.fontSize(8).font('Helvetica').fillColor('#666666');
    doc.text(
      'This is an automatically generated receipt. The SHA-256 hash above can be used to verify the integrity of this bid submission.',
      50,
      doc.y,
      { align: 'center', width: 495 },
    );
    doc.text(`Generated at: ${new Date().toISOString()}`, { align: 'center' });

    doc.end();
  });
}

/**
 * Generate Excel export with 4 sheets: Cover, Item Comparison, Audit Trail, Supplier Summary.
 * Only available for CLOSED or AWARDED RFQs.
 */
export async function generateExcelExport(rfqId: string, buyerId: string): Promise<Buffer> {
  const db = getDb();

  const rfq = await db('rfqs').where({ id: rfqId, buyer_id: buyerId }).first();

  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  if (rfq.status !== RFQStatus.CLOSED && rfq.status !== RFQStatus.AWARDED) {
    throw new AppError(
      409,
      'RFQ_NOT_CLOSED',
      'Export is only available for CLOSED or AWARDED RFQs',
    );
  }

  // Load data
  const rfqItems = await db('rfq_items')
    .where('rfq_id', rfqId)
    .orderBy('sl_no')
    .select('id', 'sl_no', 'description', 'specification', 'uom', 'quantity');

  const rankings = await calculateRankings(rfqId);
  const { entries: auditEntries } = await getAuditEntries({ rfqId, limit: 1000 });

  // Get all latest bids with items
  const latestBids = await db('bids')
    .where({ rfq_id: rfqId, is_latest: true })
    .orderBy('total_price', 'asc');

  const bidIds = latestBids.map((b: Record<string, unknown>) => b.id as string);
  const allBidItems = bidIds.length > 0 ? await db('bid_items').whereIn('bid_id', bidIds) : [];

  const bidItemsByBid = new Map<string, Array<Record<string, unknown>>>();
  for (const item of allBidItems) {
    const list = bidItemsByBid.get(item.bid_id as string) || [];
    list.push(item);
    bidItemsByBid.set(item.bid_id as string, list);
  }

  // Get supplier info
  const supplierIds = latestBids.map((b: Record<string, unknown>) => b.supplier_id as string);
  const suppliers =
    supplierIds.length > 0
      ? await db('suppliers')
          .whereIn('id', supplierIds)
          .select('id', 'unique_code', 'company_name', 'credibility_class')
      : [];
  const supplierMap = new Map(suppliers.map((s: Record<string, unknown>) => [s.id as string, s]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Procurement Platform';
  workbook.created = new Date();

  // ── Sheet 1: Cover ──
  const coverSheet = workbook.addWorksheet('Cover');
  coverSheet.columns = [
    { header: 'Field', key: 'field', width: 30 },
    { header: 'Value', key: 'value', width: 50 },
  ];
  coverSheet.addRow({ field: 'RFQ Number', value: rfq.rfq_number });
  coverSheet.addRow({ field: 'Title', value: rfq.title });
  coverSheet.addRow({ field: 'Status', value: rfq.status });
  coverSheet.addRow({
    field: 'Bid Open',
    value: rfq.bid_open_at ? new Date(rfq.bid_open_at).toISOString() : 'N/A',
  });
  coverSheet.addRow({
    field: 'Bid Close',
    value: rfq.bid_close_at ? new Date(rfq.bid_close_at).toISOString() : 'N/A',
  });
  coverSheet.addRow({ field: 'Payment Terms', value: rfq.payment_terms || 'N/A' });
  coverSheet.addRow({ field: 'Freight Terms', value: rfq.freight_terms || 'N/A' });
  coverSheet.addRow({
    field: 'Delivery Lead Time (days)',
    value: rfq.delivery_lead_time_days ?? 'N/A',
  });
  coverSheet.addRow({ field: 'Max Revisions', value: rfq.max_revisions });
  coverSheet.addRow({ field: 'Min Change %', value: rfq.min_change_percent });
  coverSheet.addRow({ field: 'Cooling Time (min)', value: rfq.cooling_time_minutes });
  coverSheet.addRow({ field: 'Total Items', value: rfqItems.length });
  coverSheet.addRow({ field: 'Total Bidders', value: latestBids.length });
  coverSheet.addRow({ field: 'Export Generated', value: new Date().toISOString() });

  // Bold headers
  coverSheet.getRow(1).font = { bold: true };

  // ── Sheet 2: Item Comparison ──
  const compSheet = workbook.addWorksheet('Item Comparison');
  const supplierCodes = latestBids.map((b: Record<string, unknown>) => b.supplier_code as string);

  // Build header: SL, Description, UOM, Qty, then for each supplier: Unit Price, Total
  const compHeaders = ['SL', 'Description', 'UOM', 'Qty'];
  for (const code of supplierCodes) {
    compHeaders.push(`${code} Unit`, `${code} Total`);
  }
  compHeaders.push('L1 Unit', 'L1 Total');
  compSheet.addRow(compHeaders);
  compSheet.getRow(1).font = { bold: true };

  // Build item-level bid lookup: rfq_item_id -> supplier_code -> { unit_price, total_price }
  const itemBidLookup = new Map<string, Map<string, { unit_price: number; total_price: number }>>();
  for (const bid of latestBids) {
    const items = bidItemsByBid.get(bid.id as string) || [];
    for (const item of items) {
      const itemId = item.rfq_item_id as string;
      if (!itemBidLookup.has(itemId)) {
        itemBidLookup.set(itemId, new Map());
      }
      itemBidLookup.get(itemId)!.set(bid.supplier_code as string, {
        unit_price: parseFloat(item.unit_price as string),
        total_price: parseFloat(item.total_price as string),
      });
    }
  }

  for (const rfqItem of rfqItems) {
    const row: (string | number)[] = [
      rfqItem.sl_no,
      rfqItem.description,
      rfqItem.uom,
      parseFloat(rfqItem.quantity),
    ];

    const bidsBySupplier = itemBidLookup.get(rfqItem.id) || new Map();

    // Find L1 (lowest unit price) for this item
    let l1Unit = Infinity;
    let l1Total = Infinity;
    for (const [, prices] of bidsBySupplier) {
      if (prices.unit_price < l1Unit) {
        l1Unit = prices.unit_price;
        l1Total = prices.total_price;
      }
    }

    for (const code of supplierCodes) {
      const prices = bidsBySupplier.get(code);
      if (prices) {
        row.push(prices.unit_price, prices.total_price);
      } else {
        row.push('N/A', 'N/A');
      }
    }

    row.push(l1Unit === Infinity ? 'N/A' : (l1Unit as number));
    row.push(l1Total === Infinity ? 'N/A' : (l1Total as number));

    compSheet.addRow(row);
  }

  // Auto-width columns
  compSheet.columns.forEach((col) => {
    col.width = 15;
  });

  // ── Sheet 3: Audit Trail ──
  const auditSheet = workbook.addWorksheet('Audit Trail');
  auditSheet.columns = [
    { header: 'Timestamp', key: 'timestamp', width: 25 },
    { header: 'Event Type', key: 'event_type', width: 25 },
    { header: 'Actor Type', key: 'actor_type', width: 15 },
    { header: 'Actor Code', key: 'actor_code', width: 15 },
    { header: 'Details', key: 'details', width: 60 },
  ];
  auditSheet.getRow(1).font = { bold: true };

  for (const entry of auditEntries) {
    const eventData =
      typeof entry.event_data === 'string'
        ? JSON.parse(entry.event_data as string)
        : entry.event_data;

    auditSheet.addRow({
      timestamp: new Date(entry.created_at as string).toISOString(),
      event_type: entry.event_type,
      actor_type: entry.actor_type,
      actor_code: entry.actor_code || 'SYSTEM',
      details: JSON.stringify(eventData).substring(0, 500),
    });
  }

  // ── Sheet 4: Supplier Summary ──
  const summarySheet = workbook.addWorksheet('Supplier Summary');
  summarySheet.columns = [
    { header: 'Supplier Code', key: 'code', width: 20 },
    { header: 'Company', key: 'company', width: 30 },
    { header: 'Total Bid', key: 'total', width: 15 },
    { header: 'Rank', key: 'rank', width: 10 },
    { header: 'Credibility', key: 'credibility', width: 15 },
  ];
  summarySheet.getRow(1).font = { bold: true };

  for (const totalRank of rankings.total_rankings) {
    const supplier = supplierMap.get(totalRank.supplier_id);
    summarySheet.addRow({
      code: totalRank.supplier_code,
      company: (supplier?.company_name as string) || 'N/A',
      total: totalRank.total_price,
      rank: totalRank.rank,
      credibility: (supplier?.credibility_class as string) || 'N/A',
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate PDF export with same content as Excel: Cover, Item Comparison, Audit Trail, Supplier Summary.
 * Only available for CLOSED or AWARDED RFQs.
 */
export async function generatePdfExport(rfqId: string, buyerId: string): Promise<Buffer> {
  const db = getDb();

  const rfq = await db('rfqs').where({ id: rfqId, buyer_id: buyerId }).first();

  if (!rfq) {
    throw new AppError(404, 'RFQ_NOT_FOUND', 'RFQ not found');
  }

  if (rfq.status !== RFQStatus.CLOSED && rfq.status !== RFQStatus.AWARDED) {
    throw new AppError(
      409,
      'RFQ_NOT_CLOSED',
      'Export is only available for CLOSED or AWARDED RFQs',
    );
  }

  // Load data
  const rfqItems = await db('rfq_items')
    .where('rfq_id', rfqId)
    .orderBy('sl_no')
    .select('id', 'sl_no', 'description', 'uom', 'quantity');

  const rankings = await calculateRankings(rfqId);
  const { entries: auditEntries } = await getAuditEntries({ rfqId, limit: 200 });

  const latestBids = await db('bids')
    .where({ rfq_id: rfqId, is_latest: true })
    .orderBy('total_price', 'asc');

  const bidIds = latestBids.map((b: Record<string, unknown>) => b.id as string);
  const allBidItems = bidIds.length > 0 ? await db('bid_items').whereIn('bid_id', bidIds) : [];

  const bidItemsByBid = new Map<string, Array<Record<string, unknown>>>();
  for (const item of allBidItems) {
    const list = bidItemsByBid.get(item.bid_id as string) || [];
    list.push(item);
    bidItemsByBid.set(item.bid_id as string, list);
  }

  const supplierIds = latestBids.map((b: Record<string, unknown>) => b.supplier_id as string);
  const suppliers =
    supplierIds.length > 0
      ? await db('suppliers')
          .whereIn('id', supplierIds)
          .select('id', 'unique_code', 'company_name', 'credibility_class')
      : [];
  const supplierMap = new Map(suppliers.map((s: Record<string, unknown>) => [s.id as string, s]));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Section 1: Cover ──
    doc.fontSize(20).font('Helvetica-Bold').text('RFQ Export Report', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(11).font('Helvetica');
    const coverFields = [
      ['RFQ Number', rfq.rfq_number],
      ['Title', rfq.title],
      ['Status', rfq.status],
      ['Bid Open', rfq.bid_open_at ? new Date(rfq.bid_open_at).toISOString() : 'N/A'],
      ['Bid Close', rfq.bid_close_at ? new Date(rfq.bid_close_at).toISOString() : 'N/A'],
      ['Payment Terms', rfq.payment_terms || 'N/A'],
      ['Freight Terms', rfq.freight_terms || 'N/A'],
      ['Max Revisions', String(rfq.max_revisions)],
      ['Min Change %', String(rfq.min_change_percent)],
      ['Total Items', String(rfqItems.length)],
      ['Total Bidders', String(latestBids.length)],
    ];

    for (const [label, value] of coverFields) {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(String(value));
    }

    // ── Section 2: Supplier Summary ──
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Supplier Summary');
    doc.moveDown(0.5);

    const summaryTop = doc.y;
    const sumColX = [40, 130, 280, 380, 440];
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Code', sumColX[0], summaryTop);
    doc.text('Company', sumColX[1], summaryTop);
    doc.text('Total Bid', sumColX[2], summaryTop);
    doc.text('Rank', sumColX[3], summaryTop);
    doc.text('Credibility', sumColX[4], summaryTop);
    doc
      .moveTo(40, summaryTop + 14)
      .lineTo(555, summaryTop + 14)
      .stroke();

    let sy = summaryTop + 18;
    doc.fontSize(9).font('Helvetica');
    for (const totalRank of rankings.total_rankings) {
      if (sy > 760) {
        doc.addPage();
        sy = 50;
      }
      const supplier = supplierMap.get(totalRank.supplier_id);
      doc.text(totalRank.supplier_code, sumColX[0], sy);
      doc.text(((supplier?.company_name as string) || 'N/A').substring(0, 25), sumColX[1], sy);
      doc.text(totalRank.total_price.toFixed(2), sumColX[2], sy);
      doc.text(String(totalRank.rank), sumColX[3], sy);
      doc.text((supplier?.credibility_class as string) || 'N/A', sumColX[4], sy);
      sy += 16;
    }

    // ── Section 3: Item Comparison ──
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Item Comparison');
    doc.moveDown(0.5);

    // Build item-level lookup
    const itemBidLookup = new Map<
      string,
      Map<string, { unit_price: number; total_price: number }>
    >();
    for (const bid of latestBids) {
      const items = bidItemsByBid.get(bid.id as string) || [];
      for (const item of items) {
        const itemId = item.rfq_item_id as string;
        if (!itemBidLookup.has(itemId)) {
          itemBidLookup.set(itemId, new Map());
        }
        itemBidLookup.get(itemId)!.set(bid.supplier_code as string, {
          unit_price: parseFloat(item.unit_price as string),
          total_price: parseFloat(item.total_price as string),
        });
      }
    }

    for (const rfqItem of rfqItems) {
      if (doc.y > 700) {
        doc.addPage();
      }
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(
          `${rfqItem.sl_no}. ${rfqItem.description} (${rfqItem.uom}, Qty: ${parseFloat(rfqItem.quantity)})`,
        );
      doc.moveDown(0.2);

      const bidsBySupplier = itemBidLookup.get(rfqItem.id) || new Map();
      doc.fontSize(9).font('Helvetica');
      for (const bid of latestBids) {
        const prices = bidsBySupplier.get(bid.supplier_code as string);
        if (prices) {
          doc.text(
            `  ${bid.supplier_code}: Unit ${prices.unit_price.toFixed(2)}  |  Total ${prices.total_price.toFixed(2)}`,
          );
        }
      }
      doc.moveDown(0.3);
    }

    // ── Section 4: Audit Trail (abbreviated) ──
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Audit Trail');
    doc.moveDown(0.5);

    doc.fontSize(9).font('Helvetica');
    for (const entry of auditEntries.slice(0, 100)) {
      if (doc.y > 750) {
        doc.addPage();
      }
      const ts = new Date(entry.created_at as string).toISOString().substring(0, 19);
      doc.text(`[${ts}] ${entry.event_type} by ${entry.actor_code || 'SYSTEM'}`);
    }

    if (auditEntries.length > 100) {
      doc.moveDown(0.5);
      doc.text(
        `... and ${auditEntries.length - 100} more entries (see Excel export for full list)`,
      );
    }

    // ── Footer on all pages ──
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).font('Helvetica').fillColor('#999999');
      doc.text(
        `Generated: ${new Date().toISOString()} | RFQ: ${rfq.rfq_number} | Page ${i + 1} of ${pageCount}`,
        40,
        790,
        { align: 'center', width: 515 },
      );
    }

    doc.end();
  });
}
