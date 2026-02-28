import { Request, Response, NextFunction } from 'express';
import { generateSupplierReceipt, generateExcelExport, generatePdfExport } from './export.service';
import { getSupplierIdFromUserId } from '../../shared/utils/supplier-lookup';

/**
 * @swagger
 * /api/supplier/rfqs/{id}/receipt:
 *   get:
 *     tags: [Supplier Export]
 *     summary: Download bid receipt PDF
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
 *     responses:
 *       200:
 *         description: PDF receipt file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Authentication required
 *       404:
 *         description: No bid found for this RFQ
 */
export async function supplierReceiptHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const supplierId = await getSupplierIdFromUserId(req.user!.userId);
    const rfqId = req.params.id;

    const pdfBuffer = await generateSupplierReceipt(rfqId, supplierId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${rfqId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/buyer/rfqs/{id}/export/excel:
 *   get:
 *     tags: [Buyer Export]
 *     summary: Download RFQ comparison Excel report
 *     description: 4-sheet XLSX with Cover, Item Comparison, Audit Trail, Supplier Summary
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
 *     responses:
 *       200:
 *         description: Excel file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Authentication required
 *       404:
 *         description: RFQ not found or not owned by buyer
 */
export async function excelExportHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const rfqId = req.params.id;

    const buffer = await generateExcelExport(rfqId, buyerId);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="rfq-export-${rfqId}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/buyer/rfqs/{id}/export/pdf:
 *   get:
 *     tags: [Buyer Export]
 *     summary: Download RFQ comparison PDF report
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
 *     responses:
 *       200:
 *         description: PDF report file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Authentication required
 *       404:
 *         description: RFQ not found or not owned by buyer
 */
export async function pdfExportHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buyerId = req.user!.userId;
    const rfqId = req.params.id;

    const pdfBuffer = await generatePdfExport(rfqId, buyerId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rfq-export-${rfqId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}
