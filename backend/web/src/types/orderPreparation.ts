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
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  contact_role?: string;
}
