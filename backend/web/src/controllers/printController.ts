// File Clean up Started: 2025-11-14
/**
 * Print Controller
 * Handles server-side printing of Order Forms
 */

import { Request, Response } from 'express';
import { PrintService } from '../services/printService';
import path from 'path';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2/promise';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import os from 'os';
import { SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER } from '../config/paths';

/**
 * Merge multiple PDFs into a single document
 * @param pdfPaths Array of { path: string, copies: number } to merge in order
 * @returns Object with merged PDF path and list of skipped forms
 */
async function mergePDFs(pdfPaths: Array<{ path: string; copies: number; label: string }>): Promise<{
  mergedPath: string;
  skipped: string[];
}> {
  const mergedPdf = await PDFDocument.create();
  const skipped: string[] = [];

  for (const { path: pdfPath, copies, label } of pdfPaths) {
    if (copies === 0) continue;

    console.log(`[PDF Merge] Adding ${copies}x ${label} from: ${pdfPath}`);

    try {
      // Check if file exists first
      const fileExists = await fs.access(pdfPath).then(() => true).catch(() => false);

      if (!fileExists) {
        console.warn(`[PDF Merge] ⚠️ Skipping ${label} - file not found: ${pdfPath}`);
        skipped.push(label);
        continue;
      }

      // Read the source PDF
      const pdfBytes = await fs.readFile(pdfPath);
      const sourcePdf = await PDFDocument.load(pdfBytes);

      // Copy all pages the specified number of times
      for (let i = 0; i < copies; i++) {
        const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
        console.log(`[PDF Merge] Added copy ${i + 1}/${copies} of ${label} (${sourcePdf.getPageCount()} pages)`);
      }
    } catch (error: any) {
      console.error(`[PDF Merge] ⚠️ Error adding ${label}:`, error.message);
      skipped.push(label);
    }
  }

  // Save merged PDF to temp file
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const tempPath = path.join(tempDir, `merged-order-forms-${timestamp}.pdf`);

  const mergedBytes = await mergedPdf.save();
  await fs.writeFile(tempPath, mergedBytes);

  const totalPages = mergedPdf.getPageCount();
  console.log(`[PDF Merge] ✅ Created merged PDF with ${totalPages} total pages: ${tempPath}`);

  return {
    mergedPath: tempPath,
    skipped
  };
}

/**
 * Helper function to get the correct PDF paths for an order
 */
async function getOrderFormPaths(orderNumber: number): Promise<{
  order_name: string;
  folder_name: string;
  folder_location: 'active' | 'finished' | 'none';
  is_migrated: boolean;
  paths: {
    master: string;
    shop: string;
    customer: string;
    estimate: string;
    packing: string;
  };
}> {
  // Query order details
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT order_number, order_name, folder_name, folder_location, is_migrated
     FROM orders
     WHERE order_number = ?`,
    [orderNumber]
  );

  if (!rows || rows.length === 0) {
    throw new Error(`Order ${orderNumber} not found`);
  }

  const order = rows[0];

  if (!order.folder_name || order.folder_location === 'none') {
    throw new Error(`Order ${orderNumber} does not have a folder`);
  }

  // Build folder paths using same logic as pdfGenerationService
  let basePath: string;
  if (order.is_migrated) {
    // Legacy orders: use old paths (root or root/1Finished)
    basePath = order.folder_location === 'active'
      ? SMB_ROOT
      : path.join(SMB_ROOT, FINISHED_FOLDER);
  } else {
    // New app-created orders: use Orders subfolder
    basePath = order.folder_location === 'active'
      ? path.join(SMB_ROOT, ORDERS_FOLDER)
      : path.join(SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER);
  }

  const orderFolderRoot = path.join(basePath, order.folder_name);
  const specsSubfolder = path.join(orderFolderRoot, 'Specs');

  // Build filenames
  const orderNum = order.order_number;
  const jobName = order.order_name;

  return {
    order_name: order.order_name,
    folder_name: order.folder_name,
    folder_location: order.folder_location,
    is_migrated: order.is_migrated,
    paths: {
      master: path.join(orderFolderRoot, `${orderNum} - ${jobName}.pdf`),
      shop: path.join(orderFolderRoot, `${orderNum} - ${jobName} - Shop.pdf`),
      customer: path.join(specsSubfolder, `${orderNum} - ${jobName} - Specs.pdf`),
      estimate: path.join(specsSubfolder, `${orderNum} - ${jobName} - Estimate.pdf`),
      packing: path.join(specsSubfolder, `${orderNum} - ${jobName} - Packing List.pdf`)
    }
  };
}

/**
 * Get available printers
 * GET /api/print/printers
 */
export const getAvailablePrinters = async (req: Request, res: Response) => {
  try {
    const printers = await PrintService.getAvailablePrinters();

    res.json({
      success: true,
      printers
    });
  } catch (error: any) {
    console.error('Error getting printers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get available printers'
    });
  }
};

/**
 * Print Order Form (Master)
 * POST /api/print/order-form/:orderNumber
 * Body: { printerName?: string, formType?: 'master' | 'customer' | 'shop' }
 */
export const printOrderForm = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { printerName, formType = 'master' } = req.body;

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: 'Order number is required'
      });
    }

    // Get correct PDF paths for this order
    const orderData = await getOrderFormPaths(Number(orderNumber));
    const formTypeKey = formType as 'master' | 'shop' | 'customer' | 'packing';
    const pdfPath = orderData.paths[formTypeKey];

    console.log(`[Print Controller] Printing ${formType} form for order ${orderNumber}`);
    console.log(`[Print Controller] Order folder: ${orderData.folder_name}`);
    console.log(`[Print Controller] PDF path: ${pdfPath}`);
    console.log(`[Print Controller] Printer: ${printerName || 'default'}`);

    // Print the PDF
    const result = await PrintService.printOrderFormMaster(pdfPath, printerName);

    res.json({
      success: true,
      message: result.message,
      jobId: result.jobId,
      orderNumber,
      formType
    });
  } catch (error: any) {
    console.error('Error printing order form:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to print order form'
    });
  }
};

/**
 * Print Multiple Order Forms with Quantities
 * POST /api/print/order-forms-batch/:orderNumber
 * Body: { quantities: { master: number, estimate: number, shop: number, packing: number }, printerName?: string }
 */
export const printOrderFormsBatch = async (req: Request, res: Response) => {
  let mergedPdfPath: string | null = null;

  try {
    const { orderNumber } = req.params;
    const { quantities, printerName } = req.body;

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: 'Order number is required'
      });
    }

    if (!quantities) {
      return res.status(400).json({
        success: false,
        message: 'Quantities object is required'
      });
    }

    // Get correct PDF paths for this order
    const orderData = await getOrderFormPaths(Number(orderNumber));

    console.log(`[Print Controller] Batch printing for order ${orderNumber}`);
    console.log(`[Print Controller] Order folder: ${orderData.folder_name}`);
    console.log(`[Print Controller] Quantities:`, quantities);
    console.log(`[Print Controller] Printer: ${printerName || 'default'}`);

    // Build array of PDFs to merge in correct order
    const pdfsToMerge = [
      { path: orderData.paths.master, copies: quantities.master || 0, label: 'Master Form' },
      { path: orderData.paths.estimate, copies: quantities.estimate || 0, label: 'Estimate Form' },
      { path: orderData.paths.shop, copies: quantities.shop || 0, label: 'Shop Form' },
      { path: orderData.paths.packing, copies: quantities.packing || 0, label: 'Packing List' }
    ];

    // Filter out forms with 0 copies
    const formsToInclude = pdfsToMerge.filter(p => p.copies > 0);

    if (formsToInclude.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No forms to print - all quantities are 0'
      });
    }

    // Merge all PDFs into one document
    console.log(`[Print Controller] Merging ${formsToInclude.length} form types into single PDF...`);
    const { mergedPath, skipped } = await mergePDFs(pdfsToMerge);
    mergedPdfPath = mergedPath;

    // Check if any forms were successfully merged
    if (skipped.length === formsToInclude.length) {
      return res.status(404).json({
        success: false,
        message: 'No forms could be found to print',
        skipped
      });
    }

    // Print the merged PDF as a single job
    console.log(`[Print Controller] Sending merged PDF to printer...`);
    const result = await PrintService.printOrderFormMaster(mergedPdfPath, printerName);

    // Calculate totals for response
    const totalCopies = pdfsToMerge.reduce((sum, p) => sum + p.copies, 0);
    const printedCopies = pdfsToMerge
      .filter(p => p.copies > 0 && !skipped.includes(p.label))
      .reduce((sum, p) => sum + p.copies, 0);

    // Build response message
    let message = `Successfully printed ${printedCopies} forms in single job`;
    if (skipped.length > 0) {
      message += `. Note: ${skipped.join(', ')} not found and skipped`;
    }

    res.json({
      success: true,
      message,
      orderNumber,
      jobId: result.jobId,
      summary: {
        master: quantities.master || 0,
        estimate: quantities.estimate || 0,
        shop: quantities.shop || 0,
        packing: quantities.packing || 0,
        totalCopies,
        printedCopies,
        skipped
      }
    });

    // Clean up temp file after successful print
    if (mergedPdfPath) {
      await fs.unlink(mergedPdfPath).catch(err =>
        console.warn(`[Print Controller] Failed to cleanup temp file ${mergedPdfPath}:`, err.message)
      );
    }
  } catch (error: any) {
    console.error('Error in batch print:', error);

    // Clean up temp file on error
    if (mergedPdfPath) {
      await fs.unlink(mergedPdfPath).catch(err =>
        console.warn(`[Print Controller] Failed to cleanup temp file ${mergedPdfPath}:`, err.message)
      );
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to print order forms'
    });
  }
};

/**
 * Cancel print job
 * DELETE /api/print/job/:jobId
 */
export const cancelPrintJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required'
      });
    }

    const result = await PrintService.cancelPrintJob(jobId);

    res.json(result);
  } catch (error: any) {
    console.error('Error cancelling print job:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel print job'
    });
  }
};

/**
 * Get print job status
 * GET /api/print/job/:jobId
 */
export const getPrintJobStatus = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required'
      });
    }

    const status = await PrintService.getPrintJobStatus(jobId);

    res.json({
      success: true,
      jobId,
      ...status
    });
  } catch (error: any) {
    console.error('Error getting print job status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get print job status'
    });
  }
};
