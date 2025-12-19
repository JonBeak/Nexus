/**
 * QB Description Types for Estimate Line Items
 * Allows custom QB descriptions that persist across sessions
 */

/**
 * Full database entity - returned from SELECT queries
 */
export interface EstimateLineDescription {
  id: number;
  estimate_id: number;
  line_index: number;
  qb_description: string | null;
  is_auto_filled: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Data for INSERT operations - excludes auto-generated fields
 */
export interface CreateEstimateLineDescriptionData {
  estimate_id: number;
  line_index: number;
  qb_description: string | null;
  is_auto_filled: boolean;
}

/**
 * Batch update format for auto-fill operation
 */
export interface BatchDescriptionUpdate {
  lineIndex: number;
  qbDescription: string;
  isAutoFilled: boolean;
}
