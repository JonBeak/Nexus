/**
 * Customer Contact Repository
 *
 * Data access layer for customer_contacts table.
 * Handles all database queries for customer contact management.
 *
 * @module repositories/customerContactRepository
 * @created 2025-11-06
 * @phase Phase 1.5.a.5 - Approve Estimate Modal Enhancements
 */

import { pool } from '../config/database';
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
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT contact_email
         FROM customer_contacts
         WHERE customer_id = ? AND is_active = TRUE
         ORDER BY contact_email ASC`,
        [customerId]
      );
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
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT *
         FROM customer_contacts
         WHERE customer_id = ? AND is_active = TRUE
         ORDER BY contact_name ASC`,
        [customerId]
      );
      return rows as CustomerContact[];
    } catch (error) {
      console.error('Error fetching contacts for customer:', error);
      throw error;
    }
  }

  /**
   * Get primary contacts for customer (for auto-fill in order creation)
   * Returns all contacts where is_primary = TRUE
   * Sorted by contact name
   *
   * @param customerId - Customer ID
   * @returns Array of primary customer contacts
   */
  static async getPrimaryContactsForCustomer(customerId: number): Promise<CustomerContact[]> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT *
         FROM customer_contacts
         WHERE customer_id = ? AND is_primary = TRUE AND is_active = TRUE
         ORDER BY contact_name ASC`,
        [customerId]
      );
      return rows as CustomerContact[];
    } catch (error) {
      console.error('Error fetching primary contacts for customer:', error);
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
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT *
         FROM customer_contacts
         WHERE contact_id = ?`,
        [contactId]
      );
      return rows.length > 0 ? (rows[0] as CustomerContact) : null;
    } catch (error) {
      console.error('Error fetching contact by ID:', error);
      throw error;
    }
  }

  /**
   * Get contact details by email (for populating form)
   * Returns first match if multiple contacts share the same email
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
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT *
         FROM customer_contacts
         WHERE customer_id = ? AND contact_email = ? AND is_active = TRUE
         LIMIT 1`,
        [customerId, email]
      );
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
      const [result] = await pool.execute<ResultSetHeader>(
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
      );
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

      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE customer_contacts
         SET ${updateFields.join(', ')}
         WHERE contact_id = ?`,
        updateValues
      );

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
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE customer_contacts
         SET is_active = FALSE, updated_by = ?
         WHERE contact_id = ?`,
        [userId, contactId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting customer contact:', error);
      throw error;
    }
  }

  /**
   * Check if email already exists for customer
   * (Note: Duplicate emails are ALLOWED by design)
   *
   * @param customerId - Customer ID
   * @param email - Contact email
   * @returns True if email exists, false otherwise
   */
  static async emailExistsForCustomer(
    customerId: number,
    email: string
  ): Promise<boolean> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count
         FROM customer_contacts
         WHERE customer_id = ? AND contact_email = ? AND is_active = TRUE`,
        [customerId, email]
      );
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
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count
         FROM customer_contacts
         WHERE customer_id = ? AND is_active = TRUE`,
        [customerId]
      );
      return rows[0].count;
    } catch (error) {
      console.error('Error getting contact count:', error);
      throw error;
    }
  }
}
