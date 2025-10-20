import { FieldValidationConfig } from '../ValidationEngine';

/**
 * Validation configuration for Discount/Fee (Product Type 22)
 *
 * Discount/Fee is a special item that applies discounts or surcharges to previous items.
 * It does NOT render as an input row in Estimate Preview, but DOES create a line item showing the discount/surcharge.
 *
 * Field mappings:
 * - field1: Label "Divider:" (no input, just prompt text)
 * - field2: % discount/fee (stops at previous Divider)
 * - field3: $ flat discount/fee (stops at previous Divider)
 * - field4: Label "Subtotal:" (no input, just prompt text)
 * - field5: % discount/fee (stops at previous Subtotal)
 * - field6: $ flat discount/fee (stops at previous Subtotal)
 * - field7: Label "Estimate:" (no input, just prompt text)
 * - field8: % discount/fee (whole estimate - all previous items)
 * - field9: $ flat discount/fee (whole estimate - all previous items)
 * - field10: Optional notes text (appears in Estimate Preview description, expandable)
 *
 * Calculation logic (per pair):
 * 1. Calculate subtotal of affected items
 * 2. Apply percentage first: subtotal × (percentage / 100)
 * 3. Add flat dollar amount
 * 4. Sum all three pairs
 * 5. Generate single line item:
 *    - "Discount" if result is negative
 *    - "Surcharge" if result is zero or positive
 *
 * Behavior:
 * - Does NOT create an input row in Estimate Preview (returns data: null from calculator)
 * - Post-processor creates a single line item showing the total discount/surcharge
 * - Affects pricing during Special Items Post-Processing
 * - Both % and $ can be filled in each pair (% applied first, then $)
 * - Negative values = discount, Positive values = surcharge
 * - field10 notes appear in itemName (like Subtotal memo)
 */
export const discountFeeValidation: Record<string, FieldValidationConfig> = {
  // Field 1: Label "Divider:" - no validation config needed (just displays label)

  field2: {
    // % discount/fee for items stopping at Divider
    // Positive = surcharge, Negative = discount
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true,
      decimal_places: 2
    }
  },
  field3: {
    // $ flat discount/fee for items stopping at Divider
    // Positive = surcharge, Negative = discount
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true,
      decimal_places: 2
    }
  },

  // Field 4: Label "Subtotal:" - no validation config needed (just displays label)

  field5: {
    // % discount/fee for items stopping at Subtotal
    // Positive = surcharge, Negative = discount
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true,
      decimal_places: 2
    }
  },
  field6: {
    // $ flat discount/fee for items stopping at Subtotal
    // Positive = surcharge, Negative = discount
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true,
      decimal_places: 2
    }
  },

  // Field 7: Label "Estimate:" - no validation config needed (just displays label)

  field8: {
    // % discount/fee for entire estimate (all items)
    // Positive = surcharge, Negative = discount
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true,
      decimal_places: 2
    }
  },
  field9: {
    // $ flat discount/fee for entire estimate (all items)
    // Positive = surcharge, Negative = discount
    function: 'float',
    error_level: 'error',
    params: {
      allow_negative: true,
      decimal_places: 2
    }
  },

  field10: {
    // Optional notes text - appears in Estimate Preview itemName (expandable)
    function: 'optional_text',
    error_level: 'error',
    params: {}
  }

  // Note: At least one field should have a value for the Discount/Fee to be useful,
  // but we allow all to be empty (user might be setting it up)
};
