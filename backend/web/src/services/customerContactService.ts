// File Clean up Finished: Nov 14, 2025
// Changes:
// - Deep analysis completed - no cleanup needed
// - File is brand new from 3-layer refactoring (created Nov 14, 2025)
// - All methods follow best practices with proper validation and error handling
// - Two unused methods kept as future interfaces: getContactByEmail, getContactCount
// - Note: orderConversionService.ts:190 violates 3-layer by calling repository directly
/**
 * Customer Contact Service
 *
 * Business logic layer for customer contact management.
 * Handles validation, uniqueness checks, and contact operations.
 *
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 *
 * Responsibilities:
 * - Contact validation (email format, required fields)
 * - Email uniqueness enforcement per customer
 * - Contact CRUD orchestration
 * - Business rule enforcement
 *
 * @module services/customerContactService
 * @created 2025-11-14
 */

import { CustomerContactRepository } from '../repositories/customerContactRepository';
import { CustomerContact, CreateCustomerContactData, UpdateCustomerContactData } from '../types/customerContacts';
import { isValidEmail } from '../utils/validation';
import { ServiceResult } from '../types/serviceResults';

export class CustomerContactService {
  /**
   * Get unique emails for customer (for dropdown)
   *
   * @param customerId - Customer ID
   * @returns Array of unique email addresses
   */
  async getUniqueEmailsForCustomer(customerId: number): Promise<ServiceResult<string[]>> {
    try {
      if (!customerId || customerId <= 0) {
        return {
          success: false,
          error: 'Invalid customer ID',
          code: 'VALIDATION_ERROR'
        };
      }

      const emails = await CustomerContactRepository.getUniqueEmailsForCustomer(customerId);
      return { success: true, data: emails };
    } catch (error) {
      console.error('Service error fetching unique emails:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contact emails',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Get all contacts for customer with full details
   *
   * @param customerId - Customer ID
   * @returns Array of customer contacts
   */
  async getContactsForCustomer(customerId: number): Promise<ServiceResult<CustomerContact[]>> {
    try {
      if (!customerId || customerId <= 0) {
        return {
          success: false,
          error: 'Invalid customer ID',
          code: 'VALIDATION_ERROR'
        };
      }

      const contacts = await CustomerContactRepository.getContactsForCustomer(customerId);
      return { success: true, data: contacts };
    } catch (error) {
      console.error('Service error fetching contacts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contacts',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Get contact by ID
   *
   * @param contactId - Contact ID
   * @returns Customer contact or null if not found
   */
  async getContactById(contactId: number): Promise<ServiceResult<CustomerContact>> {
    try {
      if (!contactId || contactId <= 0) {
        return {
          success: false,
          error: 'Invalid contact ID',
          code: 'VALIDATION_ERROR'
        };
      }

      const contact = await CustomerContactRepository.getContactById(contactId);

      if (!contact) {
        return {
          success: false,
          error: 'Contact not found',
          code: 'NOT_FOUND'
        };
      }

      return { success: true, data: contact };
    } catch (error) {
      console.error('Service error fetching contact by ID:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contact',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Get contact by email for customer
   *
   * @param customerId - Customer ID
   * @param email - Contact email
   * @returns Customer contact or null if not found
   */
  async getContactByEmail(customerId: number, email: string): Promise<ServiceResult<CustomerContact>> {
    try {
      if (!customerId || customerId <= 0) {
        return {
          success: false,
          error: 'Invalid customer ID',
          code: 'VALIDATION_ERROR'
        };
      }

      if (!email || !isValidEmail(email)) {
        return {
          success: false,
          error: 'Invalid email format',
          code: 'VALIDATION_ERROR'
        };
      }

      const contact = await CustomerContactRepository.getContactByEmail(customerId, email);

      if (!contact) {
        return {
          success: false,
          error: 'Contact not found',
          code: 'NOT_FOUND'
        };
      }

      return { success: true, data: contact };
    } catch (error) {
      console.error('Service error fetching contact by email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contact',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Create new customer contact
   *
   * Validates input data and enforces email uniqueness per customer
   *
   * @param data - Contact data
   * @param userId - User creating the contact
   * @returns Contact ID of newly created contact
   */
  async createContact(data: CreateCustomerContactData, userId: number): Promise<ServiceResult<number>> {
    try {
      // Validate customer ID
      if (!data.customer_id || data.customer_id <= 0) {
        return {
          success: false,
          error: 'Invalid customer ID',
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate required fields
      const trimmedName = data.contact_name?.trim() || '';
      const trimmedEmail = data.contact_email?.trim() || '';

      if (!trimmedName || trimmedName.length === 0) {
        return {
          success: false,
          error: 'Contact name is required',
          code: 'VALIDATION_ERROR'
        };
      }

      if (!trimmedEmail || trimmedEmail.length === 0) {
        return {
          success: false,
          error: 'Contact email is required',
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate email format
      if (!isValidEmail(trimmedEmail)) {
        return {
          success: false,
          error: 'Invalid email format',
          code: 'VALIDATION_ERROR'
        };
      }

      // Check email uniqueness for this customer
      const emailExists = await CustomerContactRepository.emailExistsForCustomer(
        data.customer_id,
        trimmedEmail
      );

      if (emailExists) {
        return {
          success: false,
          error: 'A contact with this email already exists for this customer',
          code: 'ALREADY_EXISTS'
        };
      }

      // Prepare clean data for repository
      const contactData: CreateCustomerContactData = {
        customer_id: data.customer_id,
        contact_name: trimmedName,
        contact_email: trimmedEmail,
        contact_phone: data.contact_phone?.trim() || undefined,
        contact_role: data.contact_role?.trim() || undefined,
        notes: data.notes?.trim() || undefined
      };

      const contactId = await CustomerContactRepository.createContact(contactData, userId);
      return { success: true, data: contactId };
    } catch (error) {
      console.error('Service error creating contact:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create contact',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Update customer contact
   *
   * Validates updates and enforces email uniqueness per customer
   *
   * @param contactId - Contact ID
   * @param data - Updated contact data
   * @param userId - User updating the contact
   * @returns True if updated, false if not found
   */
  async updateContact(
    contactId: number,
    data: UpdateCustomerContactData,
    userId: number
  ): Promise<ServiceResult<boolean>> {
    try {
      // Validate contact ID
      if (!contactId || contactId <= 0) {
        return {
          success: false,
          error: 'Invalid contact ID',
          code: 'VALIDATION_ERROR'
        };
      }

      // Get existing contact
      const existingContact = await CustomerContactRepository.getContactById(contactId);
      if (!existingContact) {
        return {
          success: false,
          error: 'Contact not found',
          code: 'NOT_FOUND'
        };
      }

      // Validate email if being updated
      if (data.contact_email !== undefined) {
        const trimmedEmail = data.contact_email.trim();

        if (trimmedEmail.length === 0) {
          return {
            success: false,
            error: 'Contact email cannot be empty',
            code: 'VALIDATION_ERROR'
          };
        }

        // Validate email format
        if (!isValidEmail(trimmedEmail)) {
          return {
            success: false,
            error: 'Invalid email format',
            code: 'VALIDATION_ERROR'
          };
        }

        // Check email uniqueness (excluding current contact)
        const emailExists = await CustomerContactRepository.emailExistsForCustomer(
          existingContact.customer_id,
          trimmedEmail,
          contactId
        );

        if (emailExists) {
          return {
            success: false,
            error: 'A contact with this email already exists for this customer',
            code: 'ALREADY_EXISTS'
          };
        }

        data.contact_email = trimmedEmail;
      }

      // Trim string fields
      const updateData: UpdateCustomerContactData = {
        contact_name: data.contact_name?.trim(),
        contact_email: data.contact_email,
        contact_phone: data.contact_phone?.trim(),
        contact_role: data.contact_role?.trim(),
        is_active: data.is_active,
        notes: data.notes?.trim()
      };

      const updated = await CustomerContactRepository.updateContact(contactId, updateData, userId);
      return { success: true, data: updated };
    } catch (error) {
      console.error('Service error updating contact:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update contact',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Delete customer contact (soft delete)
   *
   * @param contactId - Contact ID
   * @param userId - User deleting the contact
   * @returns True if deleted, false if not found
   */
  async deleteContact(contactId: number, userId: number): Promise<ServiceResult<boolean>> {
    try {
      if (!contactId || contactId <= 0) {
        return {
          success: false,
          error: 'Invalid contact ID',
          code: 'VALIDATION_ERROR'
        };
      }

      const deleted = await CustomerContactRepository.deleteContact(contactId, userId);
      return { success: true, data: deleted };
    } catch (error) {
      console.error('Service error deleting contact:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete contact',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Get contact count for customer
   *
   * Useful for determining if auto-primary logic should apply
   * (if count = 1, auto-select as primary)
   *
   * @param customerId - Customer ID
   * @returns Number of active contacts
   */
  async getContactCount(customerId: number): Promise<ServiceResult<number>> {
    try {
      if (!customerId || customerId <= 0) {
        return {
          success: false,
          error: 'Invalid customer ID',
          code: 'VALIDATION_ERROR'
        };
      }

      const count = await CustomerContactRepository.getContactCount(customerId);
      return { success: true, data: count };
    } catch (error) {
      console.error('Service error getting contact count:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get contact count',
        code: 'INTERNAL_ERROR'
      };
    }
  }
}
