// Discount/Fee Pricing Calculator
// Special item for applying discounts or surcharges to previous items
// Product Type 22

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput } from './types/CalculatorTypes';

/**
 * Calculate pricing for Discount/Fee
 * Implements the ProductCalculator interface for product type ID 22
 *
 * Discount/Fee is a special item that applies discounts or surcharges to rows ABOVE it.
 * It has no price itself as an input row, but DOES create a line item in estimate preview.
 * The discount/fee calculation and line item creation is handled by discountFeeProcessor.ts
 *
 * Field mapping:
 * - Field 1: Label "Divider:" (no input)
 * - Field 2: % discount/fee (stops at previous Divider)
 * - Field 3: $ flat discount/fee (stops at previous Divider)
 * - Field 4: Label "Subtotal:" (no input)
 * - Field 5: % discount/fee (stops at previous Subtotal)
 * - Field 6: $ flat discount/fee (stops at previous Subtotal)
 * - Field 7: Label "Estimate:" (no input)
 * - Field 8: % discount/fee (whole estimate - all previous items)
 * - Field 9: $ flat discount/fee (whole estimate - all previous items)
 * - Field 10: Empty (spacing)
 *
 * Calculation logic (per pair):
 * 1. Calculate subtotal of affected items
 * 2. Apply percentage first: subtotal × (percentage / 100)
 * 3. Add flat dollar amount
 * 4. Sum all three pairs
 * 5. Generate line item:
 *    - "Discount" if result is negative
 *    - "Surcharge" if result is zero or positive
 *
 * Grid behavior:
 * - Accepts numeric input in Fields 2, 3, 5, 6, 8, 9
 * - Validation allows negative numbers (negative = discount, positive = surcharge)
 * - Both % and $ can be filled in each pair
 *
 * Estimate Preview behavior:
 * - Does NOT render the input row itself
 * - Post-processor creates a single line item showing the discount/surcharge
 * - Line item appears after all affected items
 */
export const calculateDiscountFee = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
  try {
    // Discount/Fee is a pricing modifier only - it does not appear as an input row in estimate preview
    // The actual discount/fee calculation and line item creation is handled by discountFeeProcessor.ts
    // Return null data to indicate this input row should not be rendered in estimates

    return {
      status: 'completed',
      display: '', // No display - discount/fee input row doesn't appear in preview
      data: null   // Null data signals: "don't render this input row in estimate preview"
    };

  } catch (error) {
    console.error('Discount/Fee calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      data: null
    };
  }
};
