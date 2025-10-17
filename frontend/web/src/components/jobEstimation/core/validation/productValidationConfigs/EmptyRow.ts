import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Empty Row (Product Type 27)
 *
 * Empty Row is a special formatting item used for spacing in estimates.
 * It creates a blank row in the estimate preview with optional label text.
 *
 * Field mappings:
 * - field1: Optional label text (accepts any text, expandable)
 * - field2-10: Not used
 *
 * Behavior:
 * - Creates empty row in Estimate Preview (no qty, no price)
 * - If field1 has text, it appears in the calcDisplay column
 * - Product selector highlights blue (valid state)
 * - Primarily used for visual spacing and organization
 */
export const emptyRowValidation: Record<string, FieldValidationConfig> = {
  field1: {
    // Optional label text - accepts any text input
    // Using non_empty validation but this field is optional
    // If user enters text, it must be non-empty (no whitespace-only)
    function: 'non_empty',
    error_level: 'error',
    params: {
      allow_whitespace: false
    }
  }
  // fields 2-10 are not configured - they won't be validated or displayed
};
