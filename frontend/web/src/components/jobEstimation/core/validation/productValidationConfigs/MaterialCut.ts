import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Material Cut (Product Type 11)
 *
 * Field mappings:
 * - field1: Material Type (dropdown: "Material Only", "Material + Cut")
 * - field2: Prime Ret (dropdown: "Yes", "No")
 * - field3: (disabled/empty)
 * - field4: 3" Return (linear feet - float, no scientific notation, no negative)
 * - field5: 4" Return (linear feet - float, no scientific notation, no negative)
 * - field6: 5" Return (linear feet - float, no scientific notation, no negative)
 * - field7: Trim Cap (linear feet - float, no scientific notation, no negative)
 * - field8: PC (length in inches - float, no scientific notation, no negative)
 * - field9: ACM (length in inches - float, no scientific notation, no negative)
 * - field10: Design (hours - float, no scientific notation, no negative)
 *
 * Component Logic:
 * - Returns (field4-7): Rounded up to multiples of 100, priced based on Material Type and Prime Ret
 * - Sheets (field8-9): Formula-based pricing with ceil(length/96) calculations
 * - Design (field10): Hours multiplied by design fee
 *
 * Validation Rules:
 * 1. field1 and field2 are dropdowns (no validation needed, handled by UI)
 * 2. field4-10: float values, no scientific notation, no negative values
 * 3. All fields are optional (no required validation)
 */
export const materialCutValidation: Record<string, FieldValidationConfig> = {
  field4: {
    // 3" Return - linear feet
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false
    }
  },
  field5: {
    // 4" Return - linear feet
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false
    }
  },
  field6: {
    // 5" Return - linear feet
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false
    }
  },
  field7: {
    // Trim Cap - linear feet
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false
    }
  },
  field8: {
    // PC - length in inches
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false
    }
  },
  field9: {
    // ACM - length in inches
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false
    }
  },
  field10: {
    // Design - hours
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false,
      allow_scientific: false
    }
  }
};
