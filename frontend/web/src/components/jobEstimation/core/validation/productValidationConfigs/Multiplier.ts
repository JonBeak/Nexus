import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Multiplier (Product Type 23)
 *
 * Multiplier is a special item that multiplies quantities of rows ABOVE it.
 * It does NOT appear in the Estimate Preview.
 *
 * Field mappings:
 * - field1: Multiplier value (affects rows above, stopping at first Divider/Subtotal)
 * - field2: Multiplier value (affects ALL rows above, ignores Dividers/Subtotals)
 * - field3-10: Not used
 *
 * Behavior:
 * - Does NOT create a row in Estimate Preview (filtered out by returning data: null)
 * - Affects quantities during Special Items Post-Processing
 * - Both fields are cumulative (Field1 × Field2)
 * - Multiple Multipliers are cumulative
 * - Sub-items are affected along with their parent rows
 */
export const multiplierValidation: Record<string, FieldValidationConfig> = {
  field1: {
    // Optional multiplier for sectional rows (stops at Divider/Subtotal)
    function: 'multiplier',
    error_level: 'error',
    params: {}
  },
  field2: {
    // Optional multiplier for all rows above (ignores Dividers/Subtotals)
    function: 'multiplier',
    error_level: 'error',
    params: {}
  }
  // Note: At least one field should have a value for the Multiplier to be useful,
  // but we allow both to be empty (user might be setting it up)
  // fields 3-10 are not configured - they won't be validated or displayed
};
