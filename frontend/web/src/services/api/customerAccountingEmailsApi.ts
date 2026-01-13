// File Clean up Finished: 2026-01-12
/**
 * Customer Accounting Emails API
 * Manages customer accounting email addresses for invoice sending
 */

import { api } from '../apiClient';

/**
 * Accounting email type for To/CC/BCC designation
 */
export type AccountingEmailType = 'to' | 'cc' | 'bcc';

/**
 * Customer Accounting Email record
 */
export interface CustomerAccountingEmail {
  id: number;
  customer_id: number;
  email: string;
  email_type: AccountingEmailType;
  label?: string;
  is_active: boolean;
  display_order: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create accounting email request data
 */
export interface CreateAccountingEmailData {
  email: string;
  email_type?: AccountingEmailType;
  label?: string;
  display_order?: number;
  notes?: string;
}

/**
 * Update accounting email request data
 */
export interface UpdateAccountingEmailData {
  email?: string;
  email_type?: AccountingEmailType;
  label?: string;
  is_active?: boolean;
  display_order?: number;
  notes?: string;
}

export const customerAccountingEmailsApi = {
  /**
   * Get all accounting emails for customer
   */
  async getEmails(customerId: number): Promise<CustomerAccountingEmail[]> {
    const response = await api.get(`/customers/${customerId}/accounting-emails`);
    return response.data.emails;
  },

  /**
   * Get single accounting email by ID
   */
  async getEmail(customerId: number, emailId: number): Promise<CustomerAccountingEmail> {
    const response = await api.get(`/customers/${customerId}/accounting-emails/${emailId}`);
    return response.data.email;
  },

  /**
   * Create new accounting email
   */
  async createEmail(customerId: number, data: CreateAccountingEmailData): Promise<{ email_id: number }> {
    const response = await api.post(`/customers/${customerId}/accounting-emails`, data);
    return response.data;
  },

  /**
   * Update accounting email
   */
  async updateEmail(customerId: number, emailId: number, data: UpdateAccountingEmailData): Promise<void> {
    await api.put(`/customers/${customerId}/accounting-emails/${emailId}`, data);
  },

  /**
   * Delete accounting email (soft delete)
   */
  async deleteEmail(customerId: number, emailId: number): Promise<void> {
    await api.delete(`/customers/${customerId}/accounting-emails/${emailId}`);
  }
};
