/**
 * Customer Accounting Email Service
 *
 * Business logic layer for customer accounting email management.
 * Handles validation, uniqueness checks, and email operations.
 *
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 *
 * Responsibilities:
 * - Email validation (format, required fields)
 * - Email uniqueness enforcement per customer
 * - Email CRUD orchestration
 * - Business rule enforcement
 *
 * @module services/customerAccountingEmailService
 * @created 2025-12-17
 */

import { CustomerAccountingEmailRepository } from '../repositories/customerAccountingEmailRepository';
import {
  CustomerAccountingEmail,
  CreateCustomerAccountingEmailData,
  UpdateCustomerAccountingEmailData
} from '../types/customerAccountingEmails';
import { isValidEmail, getTrimmedString, getTrimmedStringOrEmpty } from '../utils/validation';
import { ServiceResult } from '../types/serviceResults';

export class CustomerAccountingEmailService {
  /**
   * Get all accounting emails for customer
   *
   * @param customerId - Customer ID
   * @returns Array of customer accounting emails
   */
  async getEmailsForCustomer(customerId: number): Promise<ServiceResult<CustomerAccountingEmail[]>> {
    try {
      if (!customerId || customerId <= 0) {
        return {
          success: false,
          error: 'Invalid customer ID',
          code: 'VALIDATION_ERROR'
        };
      }

      const emails = await CustomerAccountingEmailRepository.getEmailsForCustomer(customerId);
      return { success: true, data: emails };
    } catch (error) {
      console.error('Service error fetching accounting emails:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch accounting emails',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Get accounting email by ID
   *
   * @param emailId - Accounting email ID
   * @returns Customer accounting email or null if not found
   */
  async getEmailById(emailId: number): Promise<ServiceResult<CustomerAccountingEmail>> {
    try {
      if (!emailId || emailId <= 0) {
        return {
          success: false,
          error: 'Invalid email ID',
          code: 'VALIDATION_ERROR'
        };
      }

      const email = await CustomerAccountingEmailRepository.getEmailById(emailId);

      if (!email) {
        return {
          success: false,
          error: 'Accounting email not found',
          code: 'NOT_FOUND'
        };
      }

      return { success: true, data: email };
    } catch (error) {
      console.error('Service error fetching accounting email by ID:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch accounting email',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Create new customer accounting email
   *
   * Validates input data and enforces email uniqueness per customer
   *
   * @param data - Accounting email data
   * @param userId - User creating the email
   * @returns ID of newly created accounting email
   */
  async createEmail(data: CreateCustomerAccountingEmailData, userId: number): Promise<ServiceResult<number>> {
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
      const trimmedEmail = getTrimmedStringOrEmpty(data.email);

      if (!trimmedEmail || trimmedEmail.length === 0) {
        return {
          success: false,
          error: 'Email address is required',
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

      // Validate email_type if provided
      if (data.email_type && !['to', 'cc', 'bcc'].includes(data.email_type)) {
        return {
          success: false,
          error: 'Invalid email type. Must be "to", "cc", or "bcc"',
          code: 'VALIDATION_ERROR'
        };
      }

      // Check email uniqueness for this customer
      const emailExists = await CustomerAccountingEmailRepository.emailExistsForCustomer(
        data.customer_id,
        trimmedEmail
      );

      if (emailExists) {
        return {
          success: false,
          error: 'This email address already exists for this customer',
          code: 'ALREADY_EXISTS'
        };
      }

      // Prepare clean data for repository
      const emailData: CreateCustomerAccountingEmailData = {
        customer_id: data.customer_id,
        email: trimmedEmail,
        email_type: data.email_type || 'to',
        label: getTrimmedString(data.label),
        display_order: data.display_order || 0,
        notes: getTrimmedString(data.notes)
      };

      const emailId = await CustomerAccountingEmailRepository.createEmail(emailData, userId);
      return { success: true, data: emailId };
    } catch (error) {
      console.error('Service error creating accounting email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create accounting email',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Update customer accounting email
   *
   * Validates updates and enforces email uniqueness per customer
   *
   * @param emailId - Accounting email ID
   * @param data - Updated accounting email data
   * @param userId - User updating the email
   * @returns True if updated, false if not found
   */
  async updateEmail(
    emailId: number,
    data: UpdateCustomerAccountingEmailData,
    userId: number
  ): Promise<ServiceResult<boolean>> {
    try {
      // Validate email ID
      if (!emailId || emailId <= 0) {
        return {
          success: false,
          error: 'Invalid email ID',
          code: 'VALIDATION_ERROR'
        };
      }

      // Get existing email
      const existingEmail = await CustomerAccountingEmailRepository.getEmailById(emailId);
      if (!existingEmail) {
        return {
          success: false,
          error: 'Accounting email not found',
          code: 'NOT_FOUND'
        };
      }

      // Validate email if being updated
      if (data.email !== undefined) {
        const trimmedEmail = getTrimmedStringOrEmpty(data.email);

        if (!trimmedEmail) {
          return {
            success: false,
            error: 'Email address cannot be empty',
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

        // Check email uniqueness (excluding current email)
        const emailExists = await CustomerAccountingEmailRepository.emailExistsForCustomer(
          existingEmail.customer_id,
          trimmedEmail,
          emailId
        );

        if (emailExists) {
          return {
            success: false,
            error: 'This email address already exists for this customer',
            code: 'ALREADY_EXISTS'
          };
        }

        data.email = trimmedEmail;
      }

      // Validate email_type if provided
      if (data.email_type && !['to', 'cc', 'bcc'].includes(data.email_type)) {
        return {
          success: false,
          error: 'Invalid email type. Must be "to", "cc", or "bcc"',
          code: 'VALIDATION_ERROR'
        };
      }

      // Trim string fields
      const updateData: UpdateCustomerAccountingEmailData = {
        email: data.email,
        email_type: data.email_type,
        label: getTrimmedString(data.label),
        is_active: data.is_active,
        display_order: data.display_order,
        notes: getTrimmedString(data.notes)
      };

      const updated = await CustomerAccountingEmailRepository.updateEmail(emailId, updateData, userId);
      return { success: true, data: updated };
    } catch (error) {
      console.error('Service error updating accounting email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update accounting email',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Delete customer accounting email (soft delete)
   *
   * @param emailId - Accounting email ID
   * @param userId - User deleting the email
   * @returns True if deleted, false if not found
   */
  async deleteEmail(emailId: number, userId: number): Promise<ServiceResult<boolean>> {
    try {
      if (!emailId || emailId <= 0) {
        return {
          success: false,
          error: 'Invalid email ID',
          code: 'VALIDATION_ERROR'
        };
      }

      const deleted = await CustomerAccountingEmailRepository.deleteEmail(emailId, userId);
      return { success: true, data: deleted };
    } catch (error) {
      console.error('Service error deleting accounting email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete accounting email',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Get email count for customer
   *
   * @param customerId - Customer ID
   * @returns Number of active accounting emails
   */
  async getEmailCount(customerId: number): Promise<ServiceResult<number>> {
    try {
      if (!customerId || customerId <= 0) {
        return {
          success: false,
          error: 'Invalid customer ID',
          code: 'VALIDATION_ERROR'
        };
      }

      const count = await CustomerAccountingEmailRepository.getEmailCount(customerId);
      return { success: true, data: count };
    } catch (error) {
      console.error('Service error getting accounting email count:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get accounting email count',
        code: 'INTERNAL_ERROR'
      };
    }
  }
}
