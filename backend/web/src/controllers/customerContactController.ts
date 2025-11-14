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

const customerContactService = new CustomerContactService();

/**
 * Get unique emails for customer (dropdown)
 * GET /api/customers/:customerId/contacts/emails
 *
 * @permission orders.create
 */
export const getCustomerContactEmails = async (req: AuthRequest, res: Response) => {
  try {
    const customerId = parseInt(req.params.customerId);

    if (isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    const emails = await customerContactService.getUniqueEmailsForCustomer(customerId);

    res.json({
      success: true,
      emails
    });
  } catch (error) {
    console.error('Error fetching customer contact emails:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch contact emails'
    });
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
    const customerId = parseInt(req.params.customerId);

    if (isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    const contacts = await customerContactService.getContactsForCustomer(customerId);

    res.json({
      success: true,
      contacts,
      count: contacts.length
    });
  } catch (error) {
    console.error('Error fetching customer contacts:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch contacts'
    });
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
    const contactId = parseInt(req.params.contactId);

    if (isNaN(contactId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID'
      });
    }

    const contact = await customerContactService.getContactById(contactId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.json({
      success: true,
      contact
    });
  } catch (error) {
    console.error('Error fetching customer contact:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch contact'
    });
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
    const customerId = parseInt(req.params.customerId);
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    const { contact_name, contact_phone, contact_email, contact_role, notes } = req.body;

    const contactId = await customerContactService.createContact(
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

    res.status(201).json({
      success: true,
      contact_id: contactId,
      message: 'Contact created successfully'
    });
  } catch (error) {
    console.error('Error creating customer contact:', error);

    // Handle validation errors with appropriate status codes
    const errorMessage = error instanceof Error ? error.message : 'Failed to create contact';
    const statusCode = errorMessage.includes('already exists') ? 409 :
                       errorMessage.includes('Invalid') || errorMessage.includes('required') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      message: errorMessage
    });
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
    const contactId = parseInt(req.params.contactId);
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (isNaN(contactId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID'
      });
    }

    const { contact_name, contact_email, contact_phone, contact_role, is_active, notes } = req.body;

    const updated = await customerContactService.updateContact(
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

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found or no changes made'
      });
    }

    res.json({
      success: true,
      message: 'Contact updated successfully'
    });
  } catch (error) {
    console.error('Error updating customer contact:', error);

    // Handle validation errors with appropriate status codes
    const errorMessage = error instanceof Error ? error.message : 'Failed to update contact';
    const statusCode = errorMessage.includes('already exists') ? 409 :
                       errorMessage.includes('Invalid') || errorMessage.includes('not found') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      message: errorMessage
    });
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
    const contactId = parseInt(req.params.contactId);
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (isNaN(contactId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID'
      });
    }

    const deleted = await customerContactService.deleteContact(contactId, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer contact:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete contact'
    });
  }
};
