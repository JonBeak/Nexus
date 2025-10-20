import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Subtotal (Product Type 21)
 *
 * Subtotal calculates section subtotals with tax breakdown in Estimate Preview.
 *
 * Field mappings:
 * - field1: Optional memo text (displayed on first line of subtotal breakdown, expandable)
 * - field2-10: Not used (disabled with informational prompts)
 *
 * Behavior:
 * - Calculates sum of all items above it until previous Subtotal or start
 * - Creates line item in Estimate Preview showing section subtotal with tax
 * - Does NOT affect final total (informational only)
 * - Supports optional memo text in field1 - accepts any text input (expandable for long text)
 * - Acts as boundary marker for Multiplier Field 2 and Discount/Fee Fields 5/6
 */
export const subtotalValidation: Record<string, FieldValidationConfig> = {
  field1: {
    // Optional memo text - accepts any text input (including empty)
    function: 'optional_text',
    error_level: 'error',
    params: {}
  }
  // Fields 2-10 have no validation (disabled)
};
