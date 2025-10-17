import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for UL (Product Type 12)
 *
 * Field mappings:
 * - field1: UL Base+ (positive float, adds base price + value*price/set)
 * - field2: UL +sets (positive float, adds value*price/set)
 * - field3: UL $ (float with negative allowed, straight dollar amount)
 * - field8: UL Base$ (positive float, overrides base price for this row)
 * - field9: UL $/set (positive float, overrides price/set for this row)
 *
 * Pricing Logic:
 * - Three additive components:
 *   1. Base+ calculation: if field1 ≠ 0, add base_price + (field1 × price_per_set)
 *   2. +sets calculation: field2 × price_per_set
 *   3. $ amount: straight field3 value
 * - Two override fields:
 *   1. Base$ (field8): overrides default base_price
 *   2. $/set (field9): overrides default price_per_set
 */
export const ulValidation: Record<string, FieldValidationConfig> = {
  field1: {
    // UL Base+ - positive float only, no scientific notation
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false
    }
  },

  field2: {
    // UL +sets - positive float only (must be > 0), no scientific notation
    function: 'float',
    error_level: 'error',
    params: {
      min: 0.000001,  // Effectively > 0 (excludes 0)
      allow_negative: false
    }
  },

  field3: {
    // UL $ - float with negative allowed, no scientific notation
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true
    }
  },

  field8: {
    // UL Base$ - positive float only, overrides base price
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false
    }
  },

  field9: {
    // UL $/set - positive float only, overrides price per set
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false
    }
  }
};
