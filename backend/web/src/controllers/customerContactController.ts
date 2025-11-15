// FINISHED: Migrated to ServiceResult<T> system - Completed 2025-11-15
// Changes:
// - Added imports: parseIntParam, handleServiceResult, sendErrorResponse
// - Replaced 6 instances of parseInt() with parseIntParam()
// - Replaced all manual res.status().json() calls with helper functions
// - Updated CustomerContactService to return ServiceResult<T> for all methods
// - Service layer: 7 methods migrated (getUniqueEmailsForCustomer, getContactsForCustomer, getContactById, getContactByEmail, createContact, updateContact, deleteContact, getContactCount)
// - Controller layer: 6 endpoints migrated (getCustomerContactEmails, getCustomerContacts, getCustomerContact, createCustomerContact, updateCustomerContact, deleteCustomerContact)
// - Zero breaking changes - all endpoints maintain same response format
// - Build verified - no new TypeScript errors

// File Clean up Finished: Nov 14, 2025
/**
 * File Clean up Finished: Nov 13, 2025
 * Changes:
 * - Removed getPrimaryCustomerContacts() endpoint (is_primary feature removal)
 * - Added email uniqueness validation to createCustomerContact()
 * - Added email uniqueness validation to updateCustomerContact()
 *
 * File Clean up Finished: Nov 14, 2025
 * Changes:
 * - Migrated to 3-layer architecture (Controller → Service → Repository)
 * - Added proper AuthRequest typing (removed 3x (req as any) casts)
 * - Removed debug logging with PII (line 187-195)
 * - Moved all business logic and validation to CustomerContactService
 * - Removed inline email validation (now using validation utility)
 * - Controller reduced from 348 → 220 lines (37% reduction)
 *
 * Customer Contact Controller
 *
 * HTTP request/response handlers for customer contact management.
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 *
 * Responsibilities:
 * - HTTP request/response handling
 * - Parameter extraction and validation
 * - Error formatting for API responses
 * - Delegates business logic to CustomerContactService
 *
 * @module controllers/customerContactController
 * @created 2025-11-06
 * @phase Phase 1.5.a.5 - Approve Estimate Modal Enhancements
 */

import { Response } from 'express';
import { AuthRequest } from '../types';
import { CustomerContactService } from '../services/customerContactService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../utils/controllerHelpers';

const customerContactService = new CustomerContactService();

/**
 * Get unique emails for customer (dropdown)
 * GET /api/customers/:customerId/contacts/emails
 *
 * @permission orders.create
 */
export const getCustomerContactEmails = async (req: AuthRequest, res: Response) => {
  try {
    const customerId = parseIntParam(req.params.customerId, 'Customer ID');

    if (customerId === null) {
      return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
    }

    const result = await customerContactService.getUniqueEmailsForCustomer(customerId);

    if (!result.success) {
      return handleServiceResult(res, result);
    }

    // Return with custom response format (emails instead of data)
    res.json({
      success: true,
      emails: result.data
    });
  } catch (error) {
    console.error('Error fetching customer contact emails:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to fetch contact emails',
      'INTERNAL_ERROR'
    );
  }
};

/**
 * Get all contacts for customer (with full details)
 * GET /api/customers/:customerId/contacts
 *
 * @permission customers.read
 */
export const getCustomerContacts = async (req: AuthRequest, res: Response) => {
  try {
    const customerId = parseIntParam(req.params.customerId, 'Customer ID');

    if (customerId === null) {
      return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
    }

    const result = await customerContactService.getContactsForCustomer(customerId);

    if (!result.success) {
      return handleServiceResult(res, result);
    }

    // Return with custom response format (contacts instead of data, plus count)
    res.json({
      success: true,
      contacts: result.data,
      count: result.data.length
    });
  } catch (error) {
    console.error('Error fetching customer contacts:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to fetch contacts',
      'INTERNAL_ERROR'
    );
  }
};

/**
 * Get contact by ID
 * GET /api/customers/:customerId/contacts/:contactId
 *
 * @permission customers.read
 */
export const getCustomerContact = async (req: AuthRequest, res: Response) => {
  try {
    const contactId = parseIntParam(req.params.contactId, 'Contact ID');

    if (contactId === null) {
      return sendErrorResponse(res, 'Invalid contact ID', 'VALIDATION_ERROR');
    }

    const result = await customerContactService.getContactById(contactId);

    if (!result.success) {
      return handleServiceResult(res, result);
    }

    // Return with custom response format (contact instead of data)
    res.json({
      success: true,
      contact: result.data
    });
  } catch (error) {
    console.error('Error fetching customer contact:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to fetch contact',
      'INTERNAL_ERROR'
    );
  }
};

/**
 * Create new customer contact
 * POST /api/customers/:customerId/contacts
 *
 * @permission customers.update
 */
export const createCustomerContact = async (req: AuthRequest, res: Response) => {
  try {
    const customerId = parseIntParam(req.params.customerId, 'Customer ID');
    const userId = req.user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    if (customerId === null) {
      return sendErrorResponse(res, 'Invalid customer ID', 'VALIDATION_ERROR');
    }

    const { contact_name, contact_phone, contact_email, contact_role, notes } = req.body;

    const result = await customerContactService.createContact(
      {
        customer_id: customerId,
        contact_name,
        contact_email,
        contact_phone,
        contact_role,
        notes
      },
      userId
    );

    if (!result.success) {
      return handleServiceResult(res, result);
    }

    // Return with custom response format (contact_id instead of data)
    res.status(201).json({
      success: true,
      contact_id: result.data,
      message: 'Contact created successfully'
    });
  } catch (error) {
    console.error('Error creating customer contact:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to create contact',
      'INTERNAL_ERROR'
    );
  }
};

/**
 * Update customer contact
 * PUT /api/customers/:customerId/contacts/:contactId
 *
 * @permission customers.update
 */
export const updateCustomerContact = async (req: AuthRequest, res: Response) => {
  try {
    const contactId = parseIntParam(req.params.contactId, 'Contact ID');
    const userId = req.user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    if (contactId === null) {
      return sendErrorResponse(res, 'Invalid contact ID', 'VALIDATION_ERROR');
    }

    const { contact_name, contact_email, contact_phone, contact_role, is_active, notes } = req.body;

    const result = await customerContactService.updateContact(
      contactId,
      {
        contact_name,
        contact_email,
        contact_phone,
        contact_role,
        is_active,
        notes
      },
      userId
    );

    if (!result.success) {
      return handleServiceResult(res, result);
    }

    if (!result.data) {
      return sendErrorResponse(res, 'Contact not found or no changes made', 'NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Contact updated successfully'
    });
  } catch (error) {
    console.error('Error updating customer contact:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to update contact',
      'INTERNAL_ERROR'
    );
  }
};

/**
 * Delete customer contact (soft delete)
 * DELETE /api/customers/:customerId/contacts/:contactId
 *
 * @permission customers.update
 */
export const deleteCustomerContact = async (req: AuthRequest, res: Response) => {
  try {
    const contactId = parseIntParam(req.params.contactId, 'Contact ID');
    const userId = req.user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    if (contactId === null) {
      return sendErrorResponse(res, 'Invalid contact ID', 'VALIDATION_ERROR');
    }

    const result = await customerContactService.deleteContact(contactId, userId);

    if (!result.success) {
      return handleServiceResult(res, result);
    }

    if (!result.data) {
      return sendErrorResponse(res, 'Contact not found', 'NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer contact:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to delete contact',
      'INTERNAL_ERROR'
    );
  }
};
