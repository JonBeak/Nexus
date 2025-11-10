/**
 * Customer Contacts Type Definitions
 *
 * Defines interfaces for customer contact management system.
 * Supports multiple contacts per customer with full details.
 *
 * @module types/customerContacts
 * @created 2025-11-06
 * @phase Phase 1.5.a.5 - Approve Estimate Modal Enhancements
 */

/**
 * Customer Contact Database Record
 */
export interface CustomerContact {
  contact_id: number;
  customer_id: number;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  contact_role?: string;
  is_primary: boolean;    // Can have multiple primary contacts per customer - all auto-fill in order creation
  is_active: boolean;
  notes?: string;
  created_at: Date;
  created_by?: number;
  updated_at: Date;
  updated_by?: number;
}

/**
 * Create Customer Contact Request Data
 */
export interface CreateCustomerContactData {
  customer_id: number;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  contact_role?: string;
  notes?: string;
}

/**
 * Update Customer Contact Request Data
 */
export interface UpdateCustomerContactData {
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_role?: string;
  is_active?: boolean;
  notes?: string;
}

/**
 * Customer Contact with Display Text
 * (For dropdowns and UI display)
 */
export interface CustomerContactWithDetails extends CustomerContact {
  /** Formatted display text: "email (name - role)" */
  display_text: string;
}
