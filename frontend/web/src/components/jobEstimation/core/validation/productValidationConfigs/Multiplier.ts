import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Multiplier (Product Type 23)
 *
 * Multiplier is a special item that multiplies quantities of rows ABOVE it.
 * It does NOT appear in the Estimate Preview.
 *
 * Field mappings:
 * - field1: Multiplier value (affects rows above, stopping at first Divider)
 * - field2: Multiplier value (affects rows above, stopping at first Subtotal)
 * - field3: Multiplier value (affects ALL rows above in entire estimate)
 * - field4-10: Not used
 *
 * Behavior:
 * - Does NOT create a row in Estimate Preview (filtered out by returning data: null)
 * - Affects quantities during Special Items Post-Processing
 * - All three fields are cumulative (Field1 × Field2 × Field3)
 * - Multiple Multipliers are cumulative
 * - Sub-items are affected along with their parent rows
 */
export const multiplierValidation: Record<string, FieldValidationConfig> = {
  field1: {
    // Optional multiplier for sectional rows (stops at Divider)
    function: 'multiplier',
    error_level: 'error',
    params: {}
  },
  field2: {
    // Optional multiplier for sectional rows (stops at Subtotal)
    function: 'multiplier',
    error_level: 'error',
    params: {}
  },
  field3: {
    // Optional multiplier for entire estimate (all rows above)
    function: 'multiplier',
    error_level: 'error',
    params: {}
  }
  // Note: At least one field should have a value for the Multiplier to be useful,
  // but we allow all to be empty (user might be setting it up)
  // fields 4-10 are not configured - they won't be validated or displayed
};
