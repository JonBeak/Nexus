// FINISHED: Migrated to ServiceResult<T> system - Completed 2025-11-15
// Changes:
// - Already had sendErrorResponse imported and used throughout
// - All error responses already use sendErrorResponse() helper
// - No parseInt() instances that need migration
// - All error responses use standardized error codes (VALIDATION_ERROR, INTERNAL_ERROR, NOT_FOUND)
// - Zero breaking changes - all endpoints maintain exact same behavior
// - Build verified - no TypeScript errors

// File Clean up Finished: 2025-11-15
/**
 * Print Controller
 * Handles server-side printing of Order Forms
 *
 * Cleanup Summary (2025-11-15):
 * - ✅ Removed direct pool.execute() database access (migrated to repository)
 * - ✅ Extracted getOrderFormPaths helper to orderFolderService.getOrderFormPaths()
 * - ✅ Extracted mergePDFs helper to pdfMergeService.mergePDFs()
 * - ✅ Achieved proper 3-layer architecture: Controller -> Service -> Repository
 * - ✅ Reduced from 391 lines to 262 lines by moving logic to appropriate layers
 * - ✅ Controller now handles only HTTP concerns (request/response)
 * - ✅ All imports cleaned up - removed unused pool, fs, os, PDFDocument, paths
 */

import { Request, Response } from 'express';
import { PrintService } from '../services/printService';
import { orderFolderService } from '../services/orderFolderService';
import { pdfMergeService } from '../services/pdf/pdfMergeService';
import { sendErrorResponse } from '../utils/controllerHelpers';

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
    return sendErrorResponse(res, error.message || 'Failed to get available printers', 'INTERNAL_ERROR');
  }
};

/**
 * Print Order Form (Single Form Type)
 * POST /api/print/order-form/:orderNumber
 * Body: { printerName?: string, formType?: 'master' | 'customer' | 'shop' | 'packing' }
 */
export const printOrderForm = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { printerName, formType = 'master' } = req.body;

    if (!orderNumber) {
      return sendErrorResponse(res, 'Order number is required', 'VALIDATION_ERROR');
    }

    // Get PDF paths from service
    const orderData = await orderFolderService.getOrderFormPaths(Number(orderNumber));
    const formTypeKey = formType as 'master' | 'shop' | 'customer' | 'packing' | 'estimate';
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
    return sendErrorResponse(res, error.message || 'Failed to print order form', 'INTERNAL_ERROR');
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

    // Validate request
    if (!orderNumber) {
      return sendErrorResponse(res, 'Order number is required', 'VALIDATION_ERROR');
    }

    if (!quantities) {
      return sendErrorResponse(res, 'Quantities object is required', 'VALIDATION_ERROR');
    }

    // Get PDF paths from service
    const orderData = await orderFolderService.getOrderFormPaths(Number(orderNumber));

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
      return sendErrorResponse(res, 'No forms to print - all quantities are 0', 'VALIDATION_ERROR');
    }

    // Merge PDFs using service
    console.log(`[Print Controller] Merging ${formsToInclude.length} form types into single PDF...`);
    const { mergedPath, skipped } = await pdfMergeService.mergePDFs(pdfsToMerge);
    mergedPdfPath = mergedPath;

    // Check if any forms were successfully merged
    if (skipped.length === formsToInclude.length) {
      return sendErrorResponse(res, 'No forms could be found to print', 'NOT_FOUND', { skipped });
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
      await pdfMergeService.cleanupTempFile(mergedPdfPath);
    }
  } catch (error: any) {
    console.error('Error in batch print:', error);

    // Clean up temp file on error
    if (mergedPdfPath) {
      await pdfMergeService.cleanupTempFile(mergedPdfPath);
    }

    return sendErrorResponse(res, error.message || 'Failed to print order forms', 'INTERNAL_ERROR');
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
      return sendErrorResponse(res, 'Job ID is required', 'VALIDATION_ERROR');
    }

    const result = await PrintService.cancelPrintJob(jobId);

    res.json(result);
  } catch (error: any) {
    console.error('Error cancelling print job:', error);
    return sendErrorResponse(res, error.message || 'Failed to cancel print job', 'INTERNAL_ERROR');
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
      return sendErrorResponse(res, 'Job ID is required', 'VALIDATION_ERROR');
    }

    const status = await PrintService.getPrintJobStatus(jobId);

    res.json({
      success: true,
      jobId,
      ...status
    });
  } catch (error: any) {
    console.error('Error getting print job status:', error);
    return sendErrorResponse(res, error.message || 'Failed to get print job status', 'INTERNAL_ERROR');
  }
};
