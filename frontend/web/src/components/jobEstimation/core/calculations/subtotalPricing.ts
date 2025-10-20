// Subtotal Pricing Calculator
// Special marker item for defining section boundaries
// Product Type 21

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput } from './types/CalculatorTypes';

/**
 * Calculate pricing for Subtotal
 * Implements the ProductCalculator interface for product type ID 21
 *
 * Subtotal is a special marker item used to define section boundaries.
 * It has no inputs, no price, no quantity, and does NOT appear in estimate preview.
 * Fields show informational prompts: "Subtotal" "for" "section" "calculations"
 *
 * Field mapping:
 * - All fields: Disabled, show informational prompts only
 * - No user input accepted
 *
 * Grid behavior:
 * - Product selector shows with brown background (valid state)
 * - All fields display informational text
 * - No validation needed (empty fields are expected)
 *
 * Estimate Preview behavior:
 * - Does NOT render in estimate preview (returns data: null like Divider)
 * - Acts as boundary marker for Multiplier Field 2 scope
 * - Acts as boundary marker for Discount/Fee Field 5/6 scope
 * - Future: Will calculate and display section subtotals in preview
 */
export const calculateSubtotal = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
  try {
    // Subtotal is a boundary marker only - it does not appear in estimate preview
    // Future: Will calculate section subtotals and display in preview
    // Return null data to indicate this row should not be rendered in estimates

    return {
      status: 'completed',
      display: '', // No display - subtotal doesn't appear in preview yet
      data: null   // Null data signals: "don't render in estimate preview"
    };

  } catch (error) {
    console.error('Subtotal calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      data: null
    };
  }
};
