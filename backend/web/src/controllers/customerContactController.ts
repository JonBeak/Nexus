/**
 * Customer Contact Controller
 *
 * Handles HTTP requests for customer contact management.
 * Provides endpoints for viewing, creating, updating, and deleting customer contacts.
 *
 * @module controllers/customerContactController
 * @created 2025-11-06
 * @phase Phase 1.5.a.5 - Approve Estimate Modal Enhancements
 */

import { Request, Response } from 'express';
import { CustomerContactRepository } from '../repositories/customerContactRepository';

/**
 * Get unique emails for customer (dropdown)
 * GET /api/customers/:customerId/contacts/emails
 *
 * @permission orders.create
 */
export const getCustomerContactEmails = async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.customerId);

    if (isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    const emails = await CustomerContactRepository.getUniqueEmailsForCustomer(customerId);

    res.json({
      success: true,
      emails
    });
  } catch (error) {
    console.error('Error fetching customer contact emails:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact emails'
    });
  }
};

/**
 * Get all contacts for customer (with full details)
 * GET /api/customers/:customerId/contacts
 *
 * @permission customers.view
 */
export const getCustomerContacts = async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.customerId);

    if (isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    const contacts = await CustomerContactRepository.getContactsForCustomer(customerId);

    res.json({
      success: true,
      contacts,
      count: contacts.length
    });
  } catch (error) {
    console.error('Error fetching customer contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contacts'
    });
  }
};

/**
 * Get primary contacts for customer (for auto-fill in order creation)
 * GET /api/customers/:customerId/contacts/primary
 *
 * @permission orders.create
 */
export const getPrimaryCustomerContacts = async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.customerId);

    if (isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    const contacts = await CustomerContactRepository.getPrimaryContactsForCustomer(customerId);

    res.json({
      success: true,
      contacts,
      count: contacts.length
    });
  } catch (error) {
    console.error('Error fetching primary customer contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch primary contacts'
    });
  }
};

/**
 * Get contact by ID
 * GET /api/customers/:customerId/contacts/:contactId
 *
 * @permission customers.view
 */
export const getCustomerContact = async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId);

    if (isNaN(contactId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID'
      });
    }

    const contact = await CustomerContactRepository.getContactById(contactId);

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
      message: 'Failed to fetch contact'
    });
  }
};

/**
 * Create new customer contact
 * POST /api/customers/:customerId/contacts
 *
 * @permission customers.update
 */
export const createCustomerContact = async (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.customerId);
    const userId = (req as any).user.user_id;

    if (isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    const { contact_name, contact_phone, contact_email, contact_role, notes } = req.body;

    // Validation
    if (!contact_name || !contact_email) {
      return res.status(400).json({
        success: false,
        message: 'Contact name and email are required'
      });
    }

    // Trim values
    const trimmedName = contact_name.trim();
    const trimmedEmail = contact_email.trim();

    if (trimmedName.length === 0 || trimmedEmail.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Contact name and email cannot be empty'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Debug: Log received data
    console.log('📞 Creating contact with data:', {
      customer_id: customerId,
      contact_name: trimmedName,
      contact_email: trimmedEmail,
      contact_phone: contact_phone,
      contact_role: contact_role,
      notes: notes,
      userId
    });

    const contactId = await CustomerContactRepository.createContact(
      {
        customer_id: customerId,
        contact_name: trimmedName,
        contact_email: trimmedEmail,
        contact_phone: contact_phone?.trim() || null,
        contact_role: contact_role?.trim() || null,
        notes: notes?.trim() || null
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
    res.status(500).json({
      success: false,
      message: 'Failed to create contact'
    });
  }
};

/**
 * Update customer contact
 * PUT /api/customers/:customerId/contacts/:contactId
 *
 * @permission customers.update
 */
export const updateCustomerContact = async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const userId = (req as any).user.user_id;

    if (isNaN(contactId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID'
      });
    }

    const { contact_name, contact_email, contact_phone, contact_role, is_active, notes } = req.body;

    // Email validation if provided
    if (contact_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact_email.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
    }

    const updated = await CustomerContactRepository.updateContact(
      contactId,
      {
        contact_name: contact_name?.trim(),
        contact_email: contact_email?.trim(),
        contact_phone: contact_phone?.trim(),
        contact_role: contact_role?.trim(),
        is_active,
        notes: notes?.trim()
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
    res.status(500).json({
      success: false,
      message: 'Failed to update contact'
    });
  }
};

/**
 * Delete customer contact (soft delete)
 * DELETE /api/customers/:customerId/contacts/:contactId
 *
 * @permission customers.update
 */
export const deleteCustomerContact = async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const userId = (req as any).user.user_id;

    if (isNaN(contactId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact ID'
      });
    }

    const deleted = await CustomerContactRepository.deleteContact(contactId, userId);

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
      message: 'Failed to delete contact'
    });
  }
};
