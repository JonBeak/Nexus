// Multiplier Pricing Calculator
// Special item for multiplying quantities of rows above it
// Product Type 23

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput } from './types/CalculatorTypes';

/**
 * Calculate pricing for Multiplier
 * Implements the ProductCalculator interface for product type ID 23
 *
 * Multiplier is a special item that multiplies quantities of rows ABOVE it.
 * It has no price itself and does NOT appear in estimate preview.
 * The multiplication logic is handled in CalculationLayer.ts
 *
 * Field mapping:
 * - Field 1: Multiplier value (affects rows above, stopping at first Divider)
 * - Field 2: Multiplier value (affects rows above, stopping at first Subtotal)
 * - Field 3: Multiplier value (affects ALL rows above in entire estimate)
 * - All three fields are cumulative (Field1 × Field2 × Field3)
 * - Multiple Multipliers are cumulative
 *
 * Grid behavior:
 * - Accepts numeric input in Field 1, Field 2, and/or Field 3
 * - Validation ensures positive numbers only
 *
 * Estimate Preview behavior:
 * - Does NOT render in estimate preview (like Divider)
 * - Affects quantities of rows above it during preview generation
 * - Sub-items are multiplied along with their parent rows
 */
export const calculateMultiplier = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
  try {
    // Multiplier is a quantity modifier only - it does not appear in estimate preview
    // The actual multiplication logic is handled in CalculationLayer.ts
    // Return null data to indicate this row should not be rendered in estimates

    return {
      status: 'completed',
      display: '', // No display - multiplier doesn't appear in preview
      data: null   // Null data signals: "don't render in estimate preview"
    };

  } catch (error) {
    console.error('Multiplier calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      data: null
    };
  }
};
