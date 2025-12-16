/**
 * Customer Accounting Email Repository
 *
 * Data access layer for customer_accounting_emails table.
 * Handles all database queries for customer accounting email management.
 *
 * @module repositories/customerAccountingEmailRepository
 * @created 2025-12-17
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
  CustomerAccountingEmail,
  CreateCustomerAccountingEmailData,
  UpdateCustomerAccountingEmailData
} from '../types/customerAccountingEmails';

export class CustomerAccountingEmailRepository {
  /**
   * Get all accounting emails for customer
   * Returns sorted by display_order, then by id
   *
   * @param customerId - Customer ID
   * @returns Array of customer accounting emails
   */
  static async getEmailsForCustomer(customerId: number): Promise<CustomerAccountingEmail[]> {
    try {
      const rows = await query(
        `SELECT *
         FROM customer_accounting_emails
         WHERE customer_id = ? AND is_active = TRUE
         ORDER BY display_order ASC, id ASC`,
        [customerId]
      ) as RowDataPacket[];
      return rows as CustomerAccountingEmail[];
    } catch (error) {
      console.error('Error fetching accounting emails for customer:', error);
      throw error;
    }
  }

  /**
   * Get accounting email by ID
   *
   * @param emailId - Accounting email ID
   * @returns Customer accounting email or null if not found
   */
  static async getEmailById(emailId: number): Promise<CustomerAccountingEmail | null> {
    try {
      const rows = await query(
        `SELECT *
         FROM customer_accounting_emails
         WHERE id = ?`,
        [emailId]
      ) as RowDataPacket[];
      return rows.length > 0 ? (rows[0] as CustomerAccountingEmail) : null;
    } catch (error) {
      console.error('Error fetching accounting email by ID:', error);
      throw error;
    }
  }

  /**
   * Create new customer accounting email
   *
   * @param data - Accounting email data
   * @param userId - User creating the email
   * @returns ID of newly created accounting email
   */
  static async createEmail(
    data: CreateCustomerAccountingEmailData,
    userId: number
  ): Promise<number> {
    try {
      const result = await query(
        `INSERT INTO customer_accounting_emails
         (customer_id, email, email_type, label, display_order, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.customer_id,
          data.email,
          data.email_type || 'to',
          data.label || null,
          data.display_order || 0,
          data.notes || null,
          userId
        ]
      ) as ResultSetHeader;
      return result.insertId;
    } catch (error) {
      console.error('Error creating customer accounting email:', error);
      throw error;
    }
  }

  /**
   * Update customer accounting email
   *
   * @param emailId - Accounting email ID
   * @param data - Updated accounting email data
   * @param userId - User updating the email
   * @returns True if updated, false if not found
   */
  static async updateEmail(
    emailId: number,
    data: UpdateCustomerAccountingEmailData,
    userId: number
  ): Promise<boolean> {
    try {
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (data.email !== undefined) {
        updateFields.push('email = ?');
        updateValues.push(data.email);
      }
      if (data.email_type !== undefined) {
        updateFields.push('email_type = ?');
        updateValues.push(data.email_type);
      }
      if (data.label !== undefined) {
        updateFields.push('label = ?');
        updateValues.push(data.label || null);
      }
      if (data.is_active !== undefined) {
        updateFields.push('is_active = ?');
        updateValues.push(data.is_active);
      }
      if (data.display_order !== undefined) {
        updateFields.push('display_order = ?');
        updateValues.push(data.display_order);
      }
      if (data.notes !== undefined) {
        updateFields.push('notes = ?');
        updateValues.push(data.notes || null);
      }

      if (updateFields.length === 0) {
        return false; // Nothing to update
      }

      updateFields.push('updated_by = ?');
      updateValues.push(userId);
      updateValues.push(emailId);

      const result = await query(
        `UPDATE customer_accounting_emails
         SET ${updateFields.join(', ')}
         WHERE id = ?`,
        updateValues
      ) as ResultSetHeader;

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating customer accounting email:', error);
      throw error;
    }
  }

  /**
   * Soft delete customer accounting email (sets is_active = FALSE)
   *
   * @param emailId - Accounting email ID
   * @param userId - User deleting the email
   * @returns True if deleted, false if not found
   */
  static async deleteEmail(emailId: number, userId: number): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE customer_accounting_emails
         SET is_active = FALSE, updated_by = ?
         WHERE id = ?`,
        [userId, emailId]
      ) as ResultSetHeader;
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting customer accounting email:', error);
      throw error;
    }
  }

  /**
   * Check if email already exists for customer
   * Used to enforce unique emails per customer
   *
   * @param customerId - Customer ID
   * @param email - Email address
   * @param excludeEmailId - Optional email ID to exclude (for update operations)
   * @returns True if email exists, false otherwise
   */
  static async emailExistsForCustomer(
    customerId: number,
    email: string,
    excludeEmailId?: number
  ): Promise<boolean> {
    try {
      let sql = `SELECT COUNT(*) as count
                 FROM customer_accounting_emails
                 WHERE customer_id = ? AND email = ? AND is_active = TRUE`;
      const params: any[] = [customerId, email];

      if (excludeEmailId !== undefined) {
        sql += ' AND id != ?';
        params.push(excludeEmailId);
      }

      const rows = await query(sql, params) as RowDataPacket[];
      return rows[0].count > 0;
    } catch (error) {
      console.error('Error checking if accounting email exists:', error);
      throw error;
    }
  }

  /**
   * Get email count for customer
   *
   * @param customerId - Customer ID
   * @returns Number of active accounting emails
   */
  static async getEmailCount(customerId: number): Promise<number> {
    try {
      const rows = await query(
        `SELECT COUNT(*) as count
         FROM customer_accounting_emails
         WHERE customer_id = ? AND is_active = TRUE`,
        [customerId]
      ) as RowDataPacket[];
      return rows[0].count;
    } catch (error) {
      console.error('Error getting accounting email count:', error);
      throw error;
    }
  }
}
