/**
 * QuickBooks Invoice Controller
 * Phase 2.e: QB Invoice Automation
 * Created: 2025-12-13
 *
 * HTTP Request Handlers for QB Invoice operations
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import * as qbInvoiceService from '../services/qbInvoiceService';
import * as invoiceEmailService from '../services/invoiceEmailService';
import * as qbInvoiceRepo from '../repositories/qbInvoiceRepository';
import { sendErrorResponse } from '../utils/controllerHelpers';
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';
import {
  LinkInvoiceRequest,
  RecordPaymentRequest,
  SendEmailRequest,
  ScheduleEmailRequest,
  UpdateScheduledEmailRequest
} from '../types/qbInvoice';

// Helper to get order_id from order_number
async function getOrderIdFromNumber(orderNumber: string): Promise<number | null> {
  const rows = await query(
    'SELECT order_id FROM orders WHERE order_number = ?',
    [parseInt(orderNumber, 10)]
  ) as RowDataPacket[];
  return rows.length > 0 ? rows[0].order_id : null;
}

// =============================================
// INVOICE OPERATIONS
// =============================================

/**
 * Create QB invoice from order
 * POST /api/orders/:orderNumber/qb-invoice
 */
export const createInvoice = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { orderNumber } = req.params;

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const result = await qbInvoiceService.createInvoiceFromOrder(orderId, user.user_id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    const message = error instanceof Error ? error.message : 'Failed to create invoice';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Update QB invoice from order
 * PUT /api/orders/:orderNumber/qb-invoice
 */
export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { orderNumber } = req.params;

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const result = await qbInvoiceService.updateInvoiceFromOrder(orderId, user.user_id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    const message = error instanceof Error ? error.message : 'Failed to update invoice';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Get invoice details
 * GET /api/orders/:orderNumber/qb-invoice
 */
export const getInvoice = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const result = await qbInvoiceService.getInvoiceDetails(orderId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting invoice:', error);
    const message = error instanceof Error ? error.message : 'Failed to get invoice';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Link existing QB invoice to order
 * POST /api/orders/:orderNumber/qb-invoice/link
 */
export const linkInvoice = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { orderNumber } = req.params;
    const { qbInvoiceId, docNumber } = req.body as LinkInvoiceRequest;

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const invoiceIdOrDocNumber = qbInvoiceId || docNumber;
    if (!invoiceIdOrDocNumber) {
      return sendErrorResponse(res, 'qbInvoiceId or docNumber is required', 'VALIDATION_ERROR');
    }

    const result = await qbInvoiceService.linkExistingInvoice(
      orderId,
      invoiceIdOrDocNumber,
      user.user_id
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error linking invoice:', error);
    const message = error instanceof Error ? error.message : 'Failed to link invoice';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Unlink QB invoice from order
 * DELETE /api/orders/:orderNumber/qb-invoice/link
 */
export const unlinkInvoice = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { orderNumber } = req.params;

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const result = await qbInvoiceService.unlinkInvoice(orderId, user.user_id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error unlinking invoice:', error);
    const message = error instanceof Error ? error.message : 'Failed to unlink invoice';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Verify if linked QB invoice still exists
 * GET /api/orders/:orderNumber/qb-invoice/verify
 */
export const verifyInvoice = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const result = await qbInvoiceService.verifyLinkedInvoice(orderId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error verifying invoice:', error);
    const message = error instanceof Error ? error.message : 'Failed to verify invoice';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Search for a QB invoice (for preview before linking)
 * GET /api/qb-invoices/search?query=xxx&type=docNumber|id
 */
export const searchInvoice = async (req: Request, res: Response) => {
  try {
    const { query: searchValue, type: searchType } = req.query;

    if (!searchValue || typeof searchValue !== 'string') {
      return sendErrorResponse(res, 'Search query is required', 'VALIDATION_ERROR');
    }

    const validTypes = ['docNumber', 'id'];
    const resolvedType = validTypes.includes(searchType as string) ? (searchType as 'docNumber' | 'id') : 'docNumber';

    const result = await qbInvoiceService.searchInvoice(searchValue, resolvedType);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error searching invoice:', error);
    const message = error instanceof Error ? error.message : 'Failed to search invoice';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * List all QB invoices for the customer associated with an order
 * GET /api/orders/:orderNumber/customer-invoices?page=1&pageSize=10
 */
export const listCustomerInvoices = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const result = await qbInvoiceService.listCustomerInvoicesForLinking(orderId, page, pageSize);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error listing customer invoices:', error);
    const message = error instanceof Error ? error.message : 'Failed to list customer invoices';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Check if invoice needs update (staleness check - local only, fast)
 * GET /api/orders/:orderNumber/qb-invoice/check-updates
 */
export const checkInvoiceUpdates = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const result = await qbInvoiceService.checkInvoiceStaleness(orderId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking invoice updates:', error);
    const message = error instanceof Error ? error.message : 'Failed to check invoice updates';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

// =============================================
// PHASE 2: BI-DIRECTIONAL SYNC
// =============================================

/**
 * Deep comparison with QuickBooks (fetches current QB invoice)
 * GET /api/orders/:orderNumber/qb-invoice/compare
 *
 * Returns full sync status including QB-side changes
 */
export const compareInvoice = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Import comparison service
    const { checkFullSyncStatus } = await import('../services/qbInvoiceComparisonService');
    const result = await checkFullSyncStatus(orderId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error comparing invoice:', error);
    const message = error instanceof Error ? error.message : 'Failed to compare invoice';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Resolve sync conflict
 * POST /api/orders/:orderNumber/qb-invoice/resolve-conflict
 *
 * Body: { resolution: 'use_local' | 'use_qb' | 'keep_both' }
 */
export const resolveInvoiceConflict = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { orderNumber } = req.params;
    const { resolution } = req.body;

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Validate resolution type
    const validResolutions = ['use_local', 'use_qb', 'keep_both'];
    if (!resolution || !validResolutions.includes(resolution)) {
      return sendErrorResponse(
        res,
        'Invalid resolution. Must be one of: use_local, use_qb, keep_both',
        'VALIDATION_ERROR'
      );
    }

    // Import and call resolution service
    const { resolveConflict } = await import('../services/qbInvoiceComparisonService');
    const result = await resolveConflict(orderId, resolution, user.user_id);

    res.json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error('Error resolving invoice conflict:', error);
    const message = error instanceof Error ? error.message : 'Failed to resolve conflict';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Get invoice PDF from QuickBooks
 * GET /api/orders/:orderNumber/qb-invoice/pdf
 */
export const getInvoicePdf = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Get invoice record to get qb_invoice_id
    const invoiceRecord = await qbInvoiceRepo.getOrderInvoiceRecord(orderId);
    if (!invoiceRecord?.qb_invoice_id) {
      return sendErrorResponse(res, 'No invoice linked to this order', 'NOT_FOUND');
    }

    // Get realm ID
    const { quickbooksRepository } = await import('../repositories/quickbooksRepository');
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      return sendErrorResponse(res, 'QuickBooks not configured', 'CONFIGURATION_ERROR');
    }

    // Download PDF from QuickBooks
    const { getQBInvoicePdf } = await import('../utils/quickbooks/invoiceClient');
    const pdfBuffer = await getQBInvoicePdf(invoiceRecord.qb_invoice_id, realmId);

    // Send as base64 for frontend to display
    res.json({
      success: true,
      data: {
        pdf: pdfBuffer.toString('base64'),
        filename: `Invoice-${invoiceRecord.qb_invoice_doc_number || orderNumber}.pdf`
      }
    });
  } catch (error) {
    console.error('Error getting invoice PDF:', error);
    const message = error instanceof Error ? error.message : 'Failed to get invoice PDF';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

// =============================================
// PAYMENT OPERATIONS
// =============================================

/**
 * Record payment against invoice
 * POST /api/orders/:orderNumber/qb-payment
 */
export const recordPayment = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { orderNumber } = req.params;
    const paymentData = req.body as RecordPaymentRequest;

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Validate required fields
    if (!paymentData.amount || paymentData.amount <= 0) {
      return sendErrorResponse(res, 'Valid amount is required', 'VALIDATION_ERROR');
    }
    if (!paymentData.paymentDate) {
      return sendErrorResponse(res, 'Payment date is required', 'VALIDATION_ERROR');
    }

    const result = await qbInvoiceService.recordPayment(
      orderId,
      {
        amount: paymentData.amount,
        paymentDate: paymentData.paymentDate,
        paymentMethod: paymentData.paymentMethod,
        referenceNumber: paymentData.referenceNumber,
        memo: paymentData.memo
      },
      user.user_id
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    const message = error instanceof Error ? error.message : 'Failed to record payment';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

// =============================================
// EMAIL OPERATIONS
// =============================================

/**
 * Send invoice email immediately
 * POST /api/orders/:orderNumber/invoice-email/send
 */
export const sendInvoiceEmail = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { orderNumber } = req.params;
    const emailData = req.body as SendEmailRequest;

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Validate required fields
    if (!emailData.recipientEmails || emailData.recipientEmails.length === 0) {
      return sendErrorResponse(res, 'At least one recipient is required', 'VALIDATION_ERROR');
    }
    if (!emailData.subject) {
      return sendErrorResponse(res, 'Subject is required', 'VALIDATION_ERROR');
    }
    if (!emailData.body) {
      return sendErrorResponse(res, 'Email body is required', 'VALIDATION_ERROR');
    }

    const result = await invoiceEmailService.sendInvoiceEmail(
      orderId,
      emailData.recipientEmails,
      emailData.ccEmails || [],
      emailData.subject,
      emailData.body,
      user.user_id,
      emailData.bccEmails
    );

    res.json({
      success: result.success,
      data: result.success ? { messageId: result.messageId } : null,
      message: result.success ? 'Email sent successfully' : result.error
    });
  } catch (error) {
    console.error('Error sending invoice email:', error);
    const message = error instanceof Error ? error.message : 'Failed to send email';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Schedule invoice email for later
 * POST /api/orders/:orderNumber/invoice-email/schedule
 */
export const scheduleInvoiceEmail = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { orderNumber } = req.params;
    const emailData = req.body as ScheduleEmailRequest;

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Validate required fields
    if (!emailData.recipientEmails || emailData.recipientEmails.length === 0) {
      return sendErrorResponse(res, 'At least one recipient is required', 'VALIDATION_ERROR');
    }
    if (!emailData.scheduledFor) {
      return sendErrorResponse(res, 'Scheduled time is required', 'VALIDATION_ERROR');
    }

    const scheduledFor = new Date(emailData.scheduledFor);
    if (scheduledFor <= new Date()) {
      return sendErrorResponse(res, 'Scheduled time must be in the future', 'VALIDATION_ERROR');
    }

    const result = await invoiceEmailService.scheduleInvoiceEmail(
      orderId,
      emailData.recipientEmails,
      emailData.ccEmails,
      emailData.subject,
      emailData.body,
      scheduledFor,
      'full_invoice', // Default type
      user.user_id
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error scheduling invoice email:', error);
    const message = error instanceof Error ? error.message : 'Failed to schedule email';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Get scheduled email for order
 * GET /api/orders/:orderNumber/invoice-email/scheduled
 */
export const getScheduledEmail = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const scheduledEmail = await invoiceEmailService.getScheduledEmailForOrder(orderId);

    res.json({
      success: true,
      data: scheduledEmail
    });
  } catch (error) {
    console.error('Error getting scheduled email:', error);
    const message = error instanceof Error ? error.message : 'Failed to get scheduled email';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Get email history for order
 * GET /api/orders/:orderNumber/invoice-email/history
 */
export const getEmailHistory = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const history = await qbInvoiceRepo.getEmailHistoryForOrder(orderId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting email history:', error);
    const message = error instanceof Error ? error.message : 'Failed to get email history';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Update scheduled email
 * PUT /api/orders/:orderNumber/invoice-email/scheduled/:id
 */
export const updateScheduledEmailHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateScheduledEmailRequest;

    const updateData: any = {};
    if (updates.subject !== undefined) updateData.subject = updates.subject;
    if (updates.body !== undefined) updateData.body = updates.body;
    if (updates.scheduledFor !== undefined) updateData.scheduledFor = new Date(updates.scheduledFor);
    if (updates.recipientEmails !== undefined) updateData.recipientEmails = updates.recipientEmails;
    if (updates.ccEmails !== undefined) updateData.ccEmails = updates.ccEmails;

    await invoiceEmailService.updateScheduledEmail(parseInt(id, 10), updateData);

    res.json({
      success: true,
      message: 'Scheduled email updated successfully'
    });
  } catch (error) {
    console.error('Error updating scheduled email:', error);
    const message = error instanceof Error ? error.message : 'Failed to update scheduled email';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Cancel scheduled email
 * DELETE /api/orders/:orderNumber/invoice-email/scheduled/:id
 */
export const cancelScheduledEmailHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await invoiceEmailService.cancelScheduledEmail(parseInt(id, 10));

    res.json({
      success: true,
      message: 'Scheduled email cancelled'
    });
  } catch (error) {
    console.error('Error cancelling scheduled email:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel scheduled email';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Get email template
 * GET /api/email-templates/:templateKey
 */
export const getEmailTemplateHandler = async (req: Request, res: Response) => {
  try {
    const { templateKey } = req.params;

    const template = await qbInvoiceRepo.getEmailTemplate(templateKey);
    if (!template) {
      return sendErrorResponse(res, 'Template not found', 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error getting email template:', error);
    const message = error instanceof Error ? error.message : 'Failed to get template';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Get email preview with variables substituted
 * GET /api/orders/:orderNumber/invoice-email/preview/:templateKey
 */
export const getEmailPreview = async (req: Request, res: Response) => {
  try {
    const { orderNumber, templateKey } = req.params;

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const preview = await invoiceEmailService.getEmailPreview(
      orderId,
      templateKey as any
    );

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    console.error('Error getting email preview:', error);
    const message = error instanceof Error ? error.message : 'Failed to get preview';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

/**
 * Get styled email preview (4-part structure with logo/footer)
 * POST /api/orders/:orderNumber/invoice-email/styled-preview
 *
 * Body: { subject?, beginning?, end?, summaryConfig?, includePayButton?, invoiceData? }
 */
export const getStyledEmailPreview = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const emailContent = req.body;

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const preview = await invoiceEmailService.generateInvoiceEmailPreview(
      orderId,
      emailContent
    );

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    console.error('Error getting styled email preview:', error);
    const message = error instanceof Error ? error.message : 'Failed to get preview';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};
