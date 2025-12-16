/**
 * Customer Accounting Email Controller
 *
 * HTTP request/response handlers for customer accounting email management.
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 *
 * Responsibilities:
 * - HTTP request/response handling
 * - Parameter extraction and validation
 * - Error formatting for API responses
 * - Delegates business logic to CustomerAccountingEmailService
 *
 * @module controllers/customerAccountingEmailController
 * @created 2025-12-17
 */

import { Response } from 'express';
import { AuthRequest } from '../types';
import { CustomerAccountingEmailService } from '../services/customerAccountingEmailService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../utils/controllerHelpers';

const customerAccountingEmailService = new CustomerAccountingEmailService();

/**
 * Get all accounting emails for customer
 * GET /api/customers/:customerId/accounting-emails
 *
 * @permission customers.read
 */
export const getAccountingEmails = async (req: AuthRequest, res: Response) => {
  try {
    const customerId = parseIntParam(req.params.customerId, 'Customer ID');

    if (customerId === null) {
      return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
    }

    const result = await customerAccountingEmailService.getEmailsForCustomer(customerId);

    if (!result.success) {
      return handleServiceResult(res, result);
    }

    res.json({
      success: true,
      emails: result.data,
      count: result.data.length
    });
  } catch (error) {
    console.error('Error fetching customer accounting emails:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to fetch accounting emails',
      'INTERNAL_ERROR'
    );
  }
};

/**
 * Get single accounting email by ID
 * GET /api/customers/:customerId/accounting-emails/:emailId
 *
 * @permission customers.read
 */
export const getAccountingEmail = async (req: AuthRequest, res: Response) => {
  try {
    const emailId = parseIntParam(req.params.emailId, 'Email ID');

    if (emailId === null) {
      return sendErrorResponse(res, 'Invalid email ID', 'VALIDATION_ERROR');
    }

    const result = await customerAccountingEmailService.getEmailById(emailId);

    if (!result.success) {
      return handleServiceResult(res, result);
    }

    res.json({
      success: true,
      email: result.data
    });
  } catch (error) {
    console.error('Error fetching customer accounting email:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to fetch accounting email',
      'INTERNAL_ERROR'
    );
  }
};

/**
 * Create new customer accounting email
 * POST /api/customers/:customerId/accounting-emails
 *
 * @permission customers.update
 */
export const createAccountingEmail = async (req: AuthRequest, res: Response) => {
  try {
    const customerId = parseIntParam(req.params.customerId, 'Customer ID');
    const userId = req.user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    if (customerId === null) {
      return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
    }

    const { email, email_type, label, display_order, notes } = req.body;

    const result = await customerAccountingEmailService.createEmail(
      {
        customer_id: customerId,
        email,
        email_type,
        label,
        display_order,
        notes
      },
      userId
    );

    if (!result.success) {
      return handleServiceResult(res, result);
    }

    res.status(201).json({
      success: true,
      email_id: result.data,
      message: 'Accounting email created successfully'
    });
  } catch (error) {
    console.error('Error creating customer accounting email:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to create accounting email',
      'INTERNAL_ERROR'
    );
  }
};

/**
 * Update customer accounting email
 * PUT /api/customers/:customerId/accounting-emails/:emailId
 *
 * @permission customers.update
 */
export const updateAccountingEmail = async (req: AuthRequest, res: Response) => {
  try {
    const emailId = parseIntParam(req.params.emailId, 'Email ID');
    const userId = req.user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    if (emailId === null) {
      return sendErrorResponse(res, 'Invalid email ID', 'VALIDATION_ERROR');
    }

    const { email, email_type, label, is_active, display_order, notes } = req.body;

    const result = await customerAccountingEmailService.updateEmail(
      emailId,
      {
        email,
        email_type,
        label,
        is_active,
        display_order,
        notes
      },
      userId
    );

    if (!result.success) {
      return handleServiceResult(res, result);
    }

    if (!result.data) {
      return sendErrorResponse(res, 'Accounting email not found or no changes made', 'NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Accounting email updated successfully'
    });
  } catch (error) {
    console.error('Error updating customer accounting email:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to update accounting email',
      'INTERNAL_ERROR'
    );
  }
};

/**
 * Delete customer accounting email (soft delete)
 * DELETE /api/customers/:customerId/accounting-emails/:emailId
 *
 * @permission customers.update
 */
export const deleteAccountingEmail = async (req: AuthRequest, res: Response) => {
  try {
    const emailId = parseIntParam(req.params.emailId, 'Email ID');
    const userId = req.user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    if (emailId === null) {
      return sendErrorResponse(res, 'Invalid email ID', 'VALIDATION_ERROR');
    }

    const result = await customerAccountingEmailService.deleteEmail(emailId, userId);

    if (!result.success) {
      return handleServiceResult(res, result);
    }

    if (!result.data) {
      return sendErrorResponse(res, 'Accounting email not found', 'NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Accounting email deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer accounting email:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to delete accounting email',
      'INTERNAL_ERROR'
    );
  }
};
