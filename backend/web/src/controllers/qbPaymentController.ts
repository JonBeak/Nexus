/**
 * QuickBooks Payment Controller
 * Created: 2025-12-17
 *
 * HTTP Request Handlers for multi-invoice payment operations
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import * as qbPaymentService from '../services/qbPaymentService';
import { sendErrorResponse } from '../utils/controllerHelpers';
import { MultiPaymentInput } from '../types/qbInvoice';

// =============================================
// INVOICE QUERIES
// =============================================

/**
 * Get open invoices for a customer
 * GET /api/payments/customer/:customerId/open-invoices
 */
export const getOpenInvoices = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { customerId } = req.params;

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const customerIdNum = parseInt(customerId, 10);
    if (isNaN(customerIdNum)) {
      return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
    }

    const openInvoices = await qbPaymentService.getOpenInvoicesForCustomer(customerIdNum);

    // Also get the QB customer ID to include in response
    const qbCustomerId = await qbPaymentService.getQBCustomerId(customerIdNum);

    res.json({
      success: true,
      data: {
        qbCustomerId,
        invoices: openInvoices
      }
    });
  } catch (error) {
    console.error('Error fetching open invoices:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch open invoices';
    return sendErrorResponse(res, message, 'INTERNAL_ERROR');
  }
};

// =============================================
// PAYMENT OPERATIONS
// =============================================

/**
 * Record a payment against multiple invoices
 * POST /api/payments
 */
export const recordPayment = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const input: MultiPaymentInput = req.body;

    // Validate required fields
    if (!input.qbCustomerId) {
      return sendErrorResponse(res, 'QB customer ID is required', 'VALIDATION_ERROR');
    }

    if (!input.allocations || input.allocations.length === 0) {
      return sendErrorResponse(res, 'At least one invoice allocation is required', 'VALIDATION_ERROR');
    }

    if (!input.paymentDate) {
      return sendErrorResponse(res, 'Payment date is required', 'VALIDATION_ERROR');
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate)) {
      return sendErrorResponse(res, 'Payment date must be in YYYY-MM-DD format', 'VALIDATION_ERROR');
    }

    const result = await qbPaymentService.createMultiInvoicePayment(input);

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
