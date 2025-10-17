import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Divider (Product Type 25)
 *
 * Divider is a special marker item used to define sections for Multiplier calculations.
 * It does NOT appear in the Estimate Preview.
 *
 * Field mappings:
 * - field1-10: Not used (all fields disabled with informational prompts)
 *
 * Behavior:
 * - Does NOT create a row in Estimate Preview (filtered out by returning data: null)
 * - Acts as a boundary marker for Multiplier Field 1 scope
 * - Product selector highlights blue (valid state)
 * - All fields show informational prompts: "Divider" "for QTY" "multi" "plier"
 */
export const dividerValidation: Record<string, FieldValidationConfig> = {
  // Divider has no user-editable fields
  // All fields are disabled and show informational prompts only
  // No validation rules needed - empty config allows it to pass through
};
