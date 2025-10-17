import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Shipping (Product Type 13)
 *
 * Field mappings:
 * - field1: Base - accepts float, no scientific notation, +/-
 * - field2: Multi - accepts float, no scientific notation, positive only
 * - field3: b (small box count) - accepts float, positive only
 * - field4: bb (medium box count) - accepts float, positive only
 * - field5: B (large box count) - accepts float, positive only
 * - field6: BB (extra large box count) - accepts float, positive only
 * - field7: Pallet - flat dollar amount, positive only
 * - field8: Crate - flat dollar amount, positive only
 * - field9: Tailgate - accepts float count, positive only
 * - field10: #Days - accepts positive integers, include 0
 *
 * Pricing formula:
 * Price = Base * Multi + (#b * $b_rate) + (#bb * $bb_rate) + (#B * $big_b_rate) +
 *         (#BB * $big_bb_rate) + (#Tailgate * $tailgate_rate) + Pallet + Crate
 *
 * Description format:
 * Base(xMulti) + each count of b, bb, B, BB, Pallet, Crate, Tailgate [#Days]
 */
export const shippingValidation: Record<string, FieldValidationConfig> = {
  field1: {
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true, // Base can be negative
      decimal_places: 2
    },
    complimentary_fields: [10] // If field10 (#Days) is filled, Base is required
  },
  field2: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false, // Multi must be positive
      decimal_places: 2
    }
  },
  field3: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false, // b count must be positive
      decimal_places: 2
    }
  },
  field4: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false, // bb count must be positive
      decimal_places: 2
    }
  },
  field5: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false, // B count must be positive
      decimal_places: 2
    }
  },
  field6: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false, // BB count must be positive
      decimal_places: 2
    }
  },
  field7: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false, // Pallet flat amount must be positive
      decimal_places: 2
    }
  },
  field8: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false, // Crate flat amount must be positive
      decimal_places: 2
    }
  },
  field9: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false, // Tailgate count must be positive
      decimal_places: 2
    }
  },
  field10: {
    function: 'float',
    error_level: 'error',
    params: {
      min: 0,
      allow_negative: false, // #Days must be 0 or positive
      decimal_places: 0 // Integer only (0, 1, 2, 3, ...)
    },
    complimentary_fields: [1] // If field1 (Base) is filled, #Days is required
  }
};
