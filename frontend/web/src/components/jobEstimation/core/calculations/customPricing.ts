// Custom Product Pricing Calculator
// Dedicated pricing logic for Custom products (Product Type 9)
// Each column (A, B, C) becomes a separate line item if populated

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, ComponentItem, PricingCalculationData } from './types/CalculatorTypes';

/**
 * Calculate pricing for Custom products
 * Implements the ProductCalculator interface for product type ID 9
 *
 * Field mapping (3 columns: A, B, C):
 * Column A:
 * - field1: A.Name (any text)
 * - field2: A.Details (any text)
 * - field3: A.Price (float)
 *
 * Column B:
 * - field4: B.Name (any text)
 * - field5: B.Details (any text)
 * - field6: B.Price (float)
 *
 * Column C:
 * - field7: C.Name (any text)
 * - field8: C.Details (any text)
 * - field9: C.Price (float)
 *
 * Each column appears as a separate component in the estimate if it has:
 * - At least one of Name or Details
 * - Price
 */
export const calculateCustom = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
  // Skip calculation if validation errors exist
  if (input.hasValidationErrors) {
    return {
      status: 'pending',
      display: 'Fix validation errors first',
      data: null
    };
  }

  try {
    // Extract quantity
    const quantityRaw = input.parsedValues.quantity as string;
    const quantity = quantityRaw ? parseFloat(quantityRaw) : null;

    if (!quantity || quantity <= 0) {
      return {
        status: 'pending',
        display: 'Quantity required',
        data: null
      };
    }

    // Components array to collect each column's line item
    const components: ComponentItem[] = [];

    // ========== COLUMN A (field1, field2, field3) ==========
    const columnA = processColumn(
      input.parsedValues.field1 as string | undefined,  // Name
      input.parsedValues.field2 as string | undefined,  // Details
      input.parsedValues.field3 as number | undefined   // Price
    );
    if (columnA) {
      components.push(columnA);
    }

    // ========== COLUMN B (field4, field5, field6) ==========
    const columnB = processColumn(
      input.parsedValues.field4 as string | undefined,  // Name
      input.parsedValues.field5 as string | undefined,  // Details
      input.parsedValues.field6 as number | undefined   // Price
    );
    if (columnB) {
      components.push(columnB);
    }

    // ========== COLUMN C (field7, field8, field9) ==========
    const columnC = processColumn(
      input.parsedValues.field7 as string | undefined,  // Name
      input.parsedValues.field8 as string | undefined,  // Details
      input.parsedValues.field9 as number | undefined   // Price
    );
    if (columnC) {
      components.push(columnC);
    }

    // ========== FINAL RESULT ==========
    if (components.length === 0) {
      return {
        status: 'pending',
        display: 'Enter at least one custom item',
        data: null
      };
    }

    // Custom products don't have a single "unit price" - each component has its own
    // For the overall row calculation data, we'll sum all component prices
    const totalUnitPrice = components.reduce((sum, comp) => sum + comp.price, 0);

    const calculationData: PricingCalculationData = {
      productTypeId: 9,
      rowId: input.rowId,
      itemName: 'Custom',
      unitPrice: totalUnitPrice,
      quantity: quantity,
      components: components,
      hasCompleteSet: true
    };

    return {
      status: 'completed',
      display: '', // Not used - components have their own calculationDisplay
      data: calculationData
    };

  } catch (error) {
    console.error('Custom pricing calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      data: null
    };
  }
};

/**
 * Process a single column (A, B, or C) and return a component if valid
 * @param name - Product name (field1/4/7)
 * @param details - Description/details (field2/5/8)
 * @param price - Unit price (field3/6/9)
 * @returns ComponentItem or null if column is empty/incomplete
 */
function processColumn(
  name: string | undefined,
  details: string | undefined,
  price: number | undefined
): ComponentItem | null {
  // Column must have at least one of Name or Details, AND Price
  const hasName = name && name.trim() !== '';
  const hasDetails = details && details.trim() !== '';
  const hasPrice = price !== undefined && price !== null;

  // Skip if no identifying information or no price
  if (!hasPrice || (!hasName && !hasDetails)) {
    return null;
  }

  // Item name: use Name if exists, otherwise empty string
  const componentName = hasName ? name!.trim() : '';

  // calculationDisplay shows only the details field content (if it exists)
  const calculationDisplay = hasDetails ? details!.trim() : '';

  // Round price to 2 decimal places
  const roundedPrice = Math.round(price * 100) / 100;

  return {
    name: componentName,
    price: roundedPrice,
    type: 'custom',
    calculationDisplay: calculationDisplay
  };
}

/**
 * Format price (integer if whole number, 2 decimals if not)
 */
function formatPrice(price: number): string {
  return price % 1 === 0 ? price.toString() : price.toFixed(2);
}
