/**
 * File Clean up Finished: Nov 13, 2025
 * Changes:
 * - Removed getPrimaryContacts() method
 */

import { api } from '../apiClient';

/**
 * Customer Contacts API
 * Manages customer contact persons and communication details
 */
export const customerContactsApi = {
  /**
   * Get unique contact emails for customer (for dropdown)
   */
  async getEmails(customerId: number): Promise<string[]> {
    const response = await api.get(`/customers/${customerId}/contacts/emails`);
    return response.data.emails;
  },

  /**
   * Get all contacts for customer (with full details)
   */
  async getContacts(customerId: number): Promise<any[]> {
    const response = await api.get(`/customers/${customerId}/contacts`);
    return response.data.contacts;
  },

  /**
   * Get single contact by ID
   */
  async getContact(customerId: number, contactId: number): Promise<any> {
    const response = await api.get(`/customers/${customerId}/contacts/${contactId}`);
    return response.data.contact;
  },

  /**
   * Create new customer contact
   */
  async createContact(customerId: number, contactData: {
    contact_name: string;
    contact_email: string;
    contact_phone?: string;
    contact_role?: string;
    notes?: string;
  }): Promise<{ contact_id: number }> {
    const response = await api.post(`/customers/${customerId}/contacts`, contactData);
    return response.data;
  },

  /**
   * Update customer contact
   */
  async updateContact(customerId: number, contactId: number, contactData: {
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_role?: string;
    is_active?: boolean;
    notes?: string;
  }): Promise<void> {
    await api.put(`/customers/${customerId}/contacts/${contactId}`, contactData);
  },

  /**
   * Delete customer contact (soft delete)
   */
  async deleteContact(customerId: number, contactId: number): Promise<void> {
    await api.delete(`/customers/${customerId}/contacts/${contactId}`);
  }
};
