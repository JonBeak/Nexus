/**
 * File Clean up Finished: Nov 13, 2025
 * Changes:
 * - Added future implementation note for auto-primary contact logic
 * - Removed getPrimaryContactsForCustomer() method (is_primary feature removal)
 * - Migrated all 8 methods from pool.execute() to query() helper
 * - Enhanced emailExistsForCustomer() with excludeContactId parameter for update validation
 *
 * Customer Contact Repository
 *
 * Data access layer for customer_contacts table.
 * Handles all database queries for customer contact management.
 *
 * TODO: FUTURE IMPLEMENTATION - Auto-Primary Contact Logic
 * When retrieving contacts for order creation, implement auto-primary logic:
 * - If customer has only 1 active contact → Automatically treat as primary (auto-fill in UI)
 * - If customer has multiple contacts → User must select from dropdown
 * - This logic should be in the service/controller layer, NOT in the database
 * - No is_primary column needed - it's a dynamic business rule based on count
 *
 * @module repositories/customerContactRepository
 * @created 2025-11-06
 * @phase Phase 1.5.a.5 - Approve Estimate Modal Enhancements
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { CustomerContact, CreateCustomerContactData, UpdateCustomerContactData } from '../types/customerContacts';

export class CustomerContactRepository {
  /**
   * Get unique emails for customer (for dropdown)
   * Returns sorted alphabetically
   *
   * @param customerId - Customer ID
   * @returns Array of unique email addresses
   */
  static async getUniqueEmailsForCustomer(customerId: number): Promise<string[]> {
    try {
      const rows = await query(
        `SELECT DISTINCT contact_email
         FROM customer_contacts
         WHERE customer_id = ? AND is_active = TRUE
         ORDER BY contact_email ASC`,
        [customerId]
      ) as RowDataPacket[];
      return rows.map(r => r.contact_email);
    } catch (error) {
      console.error('Error fetching unique emails for customer:', error);
      throw error;
    }
  }

  /**
   * Get all contacts for customer with full details
   * Returns sorted by contact name
   *
   * @param customerId - Customer ID
   * @returns Array of customer contacts
   */
  static async getContactsForCustomer(customerId: number): Promise<CustomerContact[]> {
    try {
      const rows = await query(
        `SELECT *
         FROM customer_contacts
         WHERE customer_id = ? AND is_active = TRUE
         ORDER BY contact_name ASC`,
        [customerId]
      ) as RowDataPacket[];
      return rows as CustomerContact[];
    } catch (error) {
      console.error('Error fetching contacts for customer:', error);
      throw error;
    }
  }

  /**
   * Get contact by ID
   *
   * @param contactId - Contact ID
   * @returns Customer contact or null if not found
   */
  static async getContactById(contactId: number): Promise<CustomerContact | null> {
    try {
      const rows = await query(
        `SELECT *
         FROM customer_contacts
         WHERE contact_id = ?`,
        [contactId]
      ) as RowDataPacket[];
      return rows.length > 0 ? (rows[0] as CustomerContact) : null;
    } catch (error) {
      console.error('Error fetching contact by ID:', error);
      throw error;
    }
  }

  /**
   * Get contact details by email (for populating form)
   * NOTE: This should only return one contact as we enforce unique emails per customer
   *
   * @param customerId - Customer ID
   * @param email - Contact email
   * @returns Customer contact or null if not found
   */
  static async getContactByEmail(
    customerId: number,
    email: string
  ): Promise<CustomerContact | null> {
    try {
      const rows = await query(
        `SELECT *
         FROM customer_contacts
         WHERE customer_id = ? AND contact_email = ? AND is_active = TRUE
         LIMIT 1`,
        [customerId, email]
      ) as RowDataPacket[];
      return rows.length > 0 ? (rows[0] as CustomerContact) : null;
    } catch (error) {
      console.error('Error fetching contact by email:', error);
      throw error;
    }
  }

  /**
   * Create new customer contact
   *
   * @param data - Contact data
   * @param userId - User creating the contact
   * @returns Contact ID of newly created contact
   */
  static async createContact(
    data: CreateCustomerContactData,
    userId: number
  ): Promise<number> {
    try {
      const result = await query(
        `INSERT INTO customer_contacts
         (customer_id, contact_name, contact_email, contact_phone, contact_role, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.customer_id,
          data.contact_name,
          data.contact_email,
          data.contact_phone || null,
          data.contact_role || null,
          data.notes || null,
          userId
        ]
      ) as ResultSetHeader;
      return result.insertId;
    } catch (error) {
      console.error('Error creating customer contact:', error);
      throw error;
    }
  }

  /**
   * Update customer contact
   *
   * @param contactId - Contact ID
   * @param data - Updated contact data
   * @param userId - User updating the contact
   * @returns True if updated, false if not found
   */
  static async updateContact(
    contactId: number,
    data: UpdateCustomerContactData,
    userId: number
  ): Promise<boolean> {
    try {
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (data.contact_name !== undefined) {
        updateFields.push('contact_name = ?');
        updateValues.push(data.contact_name);
      }
      if (data.contact_email !== undefined) {
        updateFields.push('contact_email = ?');
        updateValues.push(data.contact_email);
      }
      if (data.contact_phone !== undefined) {
        updateFields.push('contact_phone = ?');
        updateValues.push(data.contact_phone || null);
      }
      if (data.contact_role !== undefined) {
        updateFields.push('contact_role = ?');
        updateValues.push(data.contact_role || null);
      }
      if (data.is_active !== undefined) {
        updateFields.push('is_active = ?');
        updateValues.push(data.is_active);
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
      updateValues.push(contactId);

      const result = await query(
        `UPDATE customer_contacts
         SET ${updateFields.join(', ')}
         WHERE contact_id = ?`,
        updateValues
      ) as ResultSetHeader;

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating customer contact:', error);
      throw error;
    }
  }

  /**
   * Soft delete customer contact (sets is_active = FALSE)
   *
   * @param contactId - Contact ID
   * @param userId - User deleting the contact
   * @returns True if deleted, false if not found
   */
  static async deleteContact(contactId: number, userId: number): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE customer_contacts
         SET is_active = FALSE, updated_by = ?
         WHERE contact_id = ?`,
        [userId, contactId]
      ) as ResultSetHeader;
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting customer contact:', error);
      throw error;
    }
  }

  /**
   * Check if email already exists for customer
   * Used to enforce unique emails per customer
   *
   * @param customerId - Customer ID
   * @param email - Contact email
   * @param excludeContactId - Optional contact ID to exclude (for update operations)
   * @returns True if email exists, false otherwise
   */
  static async emailExistsForCustomer(
    customerId: number,
    email: string,
    excludeContactId?: number
  ): Promise<boolean> {
    try {
      let sql = `SELECT COUNT(*) as count
                 FROM customer_contacts
                 WHERE customer_id = ? AND contact_email = ? AND is_active = TRUE`;
      const params: any[] = [customerId, email];

      if (excludeContactId !== undefined) {
        sql += ' AND contact_id != ?';
        params.push(excludeContactId);
      }

      const rows = await query(sql, params) as RowDataPacket[];
      return rows[0].count > 0;
    } catch (error) {
      console.error('Error checking if email exists:', error);
      throw error;
    }
  }

  /**
   * Get contact count for customer
   *
   * @param customerId - Customer ID
   * @returns Number of active contacts
   */
  static async getContactCount(customerId: number): Promise<number> {
    try {
      const rows = await query(
        `SELECT COUNT(*) as count
         FROM customer_contacts
         WHERE customer_id = ? AND is_active = TRUE`,
        [customerId]
      ) as RowDataPacket[];
      return rows[0].count;
    } catch (error) {
      console.error('Error getting contact count:', error);
      throw error;
    }
  }
}
