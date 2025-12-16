/**
 * Customer Accounting Emails Type Definitions
 *
 * Defines interfaces for customer accounting email management.
 * Supports multiple accounting emails per customer with email type (to/cc/bcc).
 *
 * @module types/customerAccountingEmails
 * @created 2025-12-17
 */

/**
 * Email type for accounting emails
 */
export type AccountingEmailType = 'to' | 'cc' | 'bcc';

/**
 * Customer Accounting Email Database Record
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
  created_at: Date;
  created_by?: number;
  updated_at: Date;
  updated_by?: number;
}

/**
 * Create Customer Accounting Email Request Data
 */
export interface CreateCustomerAccountingEmailData {
  customer_id: number;
  email: string;
  email_type?: AccountingEmailType;
  label?: string;
  display_order?: number;
  notes?: string;
}

/**
 * Update Customer Accounting Email Request Data
 */
export interface UpdateCustomerAccountingEmailData {
  email?: string;
  email_type?: AccountingEmailType;
  label?: string;
  is_active?: boolean;
  display_order?: number;
  notes?: string;
}

/**
 * Order Accounting Email (simplified for JSON storage on orders)
 */
export interface OrderAccountingEmail {
  email: string;
  email_type: AccountingEmailType;
  label?: string;
}
