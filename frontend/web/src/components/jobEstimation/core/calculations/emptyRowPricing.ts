// Empty Row Pricing Calculator
// Special formatting item for visual spacing in estimates
// Product Type 27

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, PricingCalculationData } from './types/CalculatorTypes';

/**
 * Calculate pricing for Empty Row
 * Implements the ProductCalculator interface for product type ID 27
 *
 * Empty Row is a special item that creates blank spacing in estimates.
 * It has no price, no quantity, and no calculation.
 * Optional field1 text appears in the calcDisplay column.
 *
 * Field mapping:
 * - field1: Optional label text (expandable)
 * - field2-10: Not used
 *
 * Estimate Preview behavior:
 * - Creates a row with empty values for all columns (including # and price)
 * - If field1 has text, that text appears in the calcDisplay column
 * - Used for visual spacing and organization
 */
export const calculateEmptyRow = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
  try {
    // Extract optional label text from field1
    const labelText = input.parsedValues.field1 as string | undefined;

    // Empty Row has no validation requirements (except field1 non-empty if provided)
    // We allow it even with validation errors since it's a formatting item

    // Use labelText in display if provided, otherwise empty string
    const displayText = labelText && labelText.trim() !== '' ? labelText.trim() : '';

    // Create calculation data with a single empty component
    // This ensures Empty Row appears in the estimate preview as a blank row
    const calculationData: PricingCalculationData = {
      productTypeId: 27,
      rowId: input.rowId,
      itemName: '',  // Blank item name
      unitPrice: 0,
      quantity: 0,
      components: [
        {
          name: '',  // Blank component name
          price: 0,  // Zero price (will be handled specially in EstimateTable)
          type: 'empty_row',  // Special marker for rendering logic
          calculationDisplay: displayText  // Optional label text
        }
      ],
      hasCompleteSet: true
    };

    return {
      status: 'completed',
      display: displayText, // This will appear in calcDisplay column if present
      data: calculationData
    };

  } catch (error) {
    console.error('Empty Row calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      data: null
    };
  }
};
