/**
 * Estimate Point Person Type Definitions
 * Phase 4c - Estimate Workflow Redesign
 */

import { EstimatePreviewData } from './orders';

// =============================================
// ESTIMATE POINT PERSON TYPES
// =============================================

export interface EstimatePointPerson {
  id: number;
  estimate_id: number;
  contact_id?: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
  display_order: number;
  created_at: Date;
}

export interface CreateEstimatePointPersonData {
  estimate_id: number;
  contact_id?: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
  display_order: number;
}

export interface EstimatePointPersonInput {
  contact_id?: number;           // If selecting from existing customer_contacts
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
  saveToDatabase?: boolean;      // If true, save custom contact to customer_contacts table
}

// =============================================
// EMAIL SUMMARY CONFIG TYPES
// =============================================

export interface EmailSummaryConfig {
  includeJobName: boolean;
  includeCustomerRef: boolean;
  includePO: boolean;              // PO # (auto-included if exists)
  includeOrderNumber: boolean;     // Internal order number
  includeQbEstimateNumber: boolean;
  includeEstimateDate: boolean;
  includeValidUntilDate: boolean;
  includeSubtotal: boolean;
  includeTax: boolean;
  includeTotal: boolean;
  includeBalance: boolean;         // Balance Due (from cached_balance)
}

// Default config - most checked except Valid Until Date
export const DEFAULT_EMAIL_SUMMARY_CONFIG: EmailSummaryConfig = {
  includeJobName: true,
  includeCustomerRef: true,
  includePO: true,              // Auto-include if exists
  includeOrderNumber: true,     // Include order number
  includeQbEstimateNumber: true,
  includeEstimateDate: true,
  includeValidUntilDate: false, // Unchecked by default
  includeSubtotal: false,       // Off by default (like invoice)
  includeTax: false,            // Off by default (like invoice)
  includeTotal: true,
  includeBalance: true          // Include balance due if > 0
};

// =============================================
// PREPARE/SEND REQUEST TYPES
// =============================================

export interface PrepareEstimateRequest {
  emailSubject?: string;
  emailBeginning?: string;
  emailEnd?: string;
  emailSummaryConfig?: EmailSummaryConfig;
  pointPersons?: EstimatePointPersonInput[];
  estimatePreviewData?: EstimatePreviewData; // For auto-filling QB descriptions
}

export interface SendEstimateRequest {
  // Currently no additional params needed - uses saved point persons and email content
}

export interface PrepareEstimateResult {
  success: boolean;
  estimateId: number;
  deletedRowCount: number;
  remainingRowCount: number;
}

export interface SendEstimateResult {
  success: boolean;
  estimateId: number;
  qbEstimateId?: string;
  qbEstimateUrl?: string;
  estimateDate?: string;  // QB TxnDate stored as estimate_date
  emailSentTo?: string[];
  message?: string; // Optional message (e.g., "This estimate was previously sent")
}
