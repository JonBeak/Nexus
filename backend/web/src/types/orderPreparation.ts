// File Clean up Finished: 2025-11-18
// Analysis: Types defined for future "Order Finalization - Prepare & Send Workflow" feature
// Status: NOT CURRENTLY USED - Zero imports found in codebase
// Findings:
//   - OrderPointPerson: DUPLICATED in orders.ts (better version with more fields)
//   - QBEstimateRecord: References non-existent database table structure
//   - StalenessCheckResult, StepResult, FinalizationOptions, FinalizationResult: Not used
//   - Phase 1.5.c.6 workflow: Never implemented
//
// TODO: Decide whether to implement this feature or delete these unused types
//       If implementing: Use OrderPointPerson from orders.ts, verify QBEstimateRecord schema
//       If not implementing: Delete this file to reduce dead code
//
// Preserved for potential future implementation - no changes made

/**
 * Order Preparation Type Definitions
 * Phase 1.5.c.6: Order Finalization - Prepare & Send Workflow
 */

// =============================================
// QB ESTIMATE TYPES
// =============================================

export interface QBEstimateRecord {
  id: number;
  order_id: number;
  qb_estimate_id: string;
  qb_estimate_number: string;
  created_at: Date;
  created_by: number | null;
  is_current: boolean;
  estimate_data_hash: string;
  qb_estimate_url: string | null;
}

export interface StalenessCheckResult {
  exists: boolean;
  isStale: boolean;
  currentHash: string | null;
  storedHash: string | null;
  qbEstimateNumber: string | null;
  createdAt: Date | null;
}

// =============================================
// STEP EXECUTION TYPES
// =============================================

export interface StepResult {
  success: boolean;
  stepId: string;
  message: string;
  data?: any;
  error?: string;
}

export interface FinalizationOptions {
  sendEmail: boolean;
  recipients: string[];
  orderFormPath?: string;
  qbEstimatePath?: string;
}

export interface FinalizationResult {
  success: boolean;
  emailSent: boolean;
  statusUpdated: boolean;
  message: string;
}

// =============================================
// POINT PERSON TYPES
// =============================================

export interface OrderPointPerson {
  id: number;
  order_id: number;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  contact_role?: string;
  is_primary: boolean;
  created_at: Date;
  created_by: number;
}

// =============================================
// REPOSITORY DATA TYPES
// =============================================

export interface OrderDataForQBEstimate {
  order_id: number;
  order_number: number;
  customer_id: number;
  order_name: string;
  tax_name: string | null;
  folder_location: string;
  customer_po: string | null;
  customer_job_number: string | null;
  customer_name: string;
  quickbooks_name: string | null;
}

export interface OrderPartForQBEstimate {
  part_id: number;
  part_number: number;
  invoice_description: string | null;
  qb_item_name: string | null;
  qb_description: string | null;
  specs_display_name: string | null;
  quantity: number | null;
  unit_price: number | null;
  extended_price: number | null;
  product_type: string | null;
  is_taxable: boolean;
}

export interface OrderPartForHash {
  part_id: number;
  part_number: number;
  display_number: number | null;
  is_parent: boolean;
  product_type: string | null;
  part_scope: string | null;
  qb_item_name: string | null;
  qb_description: string | null;
  specs_display_name: string | null;
  product_type_id: number | null;
  channel_letter_type_id: number | null;
  base_product_type_id: number | null;
  quantity: number | null;
  specifications: any; // JSON field
  invoice_description: string | null;
  unit_price: number | null;
  extended_price: number | null;
  production_notes: string | null;
}

export interface OrderDataForHash {
  order_name: string | null;
  customer_po: string | null;
  customer_job_number: string | null;
  order_date: Date | null;
  due_date: Date | null;
  production_notes: string | null;
  manufacturing_note: string | null;
  internal_note: string | null;
  invoice_email: string | null;
  terms: string | null;
  deposit_required: boolean;
  cash: boolean;
  discount: number | null;
  tax_name: string | null;
  invoice_notes: string | null;
  shipping_required: boolean;
  sign_image_path: string | null;
}

export interface BasicOrderInfo {
  order_id: number;
  order_number: number;
  customer_id: number;
  order_name: string;
  status: string;
  folder_name: string | null;
  folder_location: string;
}
