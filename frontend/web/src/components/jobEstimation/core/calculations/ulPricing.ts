// UL Pricing Calculator
// Dedicated pricing logic for UL products (Product Type 12)
// Component-based calculation with override capabilities

import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, PricingCalculationData, ComponentItem } from './types/CalculatorTypes';
import { PricingDataResource } from '../../../../services/pricingDataResource';
import { formatPrice } from './utils/priceFormatter';

/**
 * Extract and type-cast field values from parsed input
 */
interface ExtractedULFields {
  quantity: number | null;
  basePlus: number | undefined;      // field1: UL Base+ (adds base + value*per_set)
  plusSets: number | undefined;      // field2: UL +sets (adds value*per_set)
  dollarFlat: number | undefined;    // field3: UL $ (straight dollar amount)
  baseDollarOverride: number | undefined;  // field8: UL Base$ (overrides base price)
  perSetOverride: number | undefined;      // field9: UL $/set (overrides per_set price)
}

const extractFields = (parsedValues: Record<string, unknown>): ExtractedULFields => {
  const quantityRaw = parsedValues.quantity as string;

  return {
    quantity: quantityRaw ? parseFloat(quantityRaw) : null,
    basePlus: parsedValues.field1 as number | undefined,
    plusSets: parsedValues.field2 as number | undefined,
    dollarFlat: parsedValues.field3 as number | undefined,
    baseDollarOverride: parsedValues.field8 as number | undefined,
    perSetOverride: parsedValues.field9 as number | undefined
  };
};

/**
 * Calculate pricing for UL products
 * Implements the ProductCalculator interface for product type ID 12
 *
 * Field mapping:
 * - field1: UL Base+ (positive float, adds base_fee + value × per_set_fee)
 * - field2: UL +sets (positive float, adds value × per_set_fee)
 * - field3: UL $ (float with negative, straight dollar amount)
 * - field8: UL Base$ (positive float, overrides default base_fee)
 * - field9: UL $/set (positive float, overrides default per_set_fee)
 *
 * Component Logic:
 * - If field1 ≠ 0: Create "Base ($price)" component = base_fee + (field1 × per_set_fee)
 * - If field2 > 0: Create "+ #Sets ($/set)" component = field2 × per_set_fee
 * - If field3 exists: Create "+ $Flat" component = field3
 * - field8 overrides base_fee for this row
 * - field9 overrides per_set_fee for this row
 */
export const calculateUL = async (input: ValidatedPricingInput): Promise<RowCalculationResult> => {
  // Skip calculation if validation errors exist
  if (input.hasValidationErrors) {
    return {
      status: 'pending',
      display: 'Fix validation errors first',
      data: null
    };
  }

  try {
    const fields = extractFields(input.parsedValues);

    // Validate quantity
    if (!fields.quantity || fields.quantity <= 0) {
      return {
        status: 'pending',
        display: 'Quantity required',
        data: null
      };
    }

    // Fetch pricing data from database
    const allPricingData = await PricingDataResource.getAllPricingData();
    const ulPricingData = allPricingData.ulListingPricing?.find(ul => ul.is_active);

    if (!ulPricingData) {
      return {
        status: 'error',
        display: 'UL pricing configuration not found. Please configure ul_listing_pricing table.',
        data: null
      };
    }

    // Apply overrides if present (field8 for base, field9 for per_set)
    // Convert database values to numbers (they may come as strings from MySQL)
    const baseFee = fields.baseDollarOverride !== undefined ? fields.baseDollarOverride : Number(ulPricingData.base_fee);
    const perSetFee = fields.perSetOverride !== undefined ? fields.perSetOverride : Number(ulPricingData.per_set_fee);

    // Track breakdown parts and total
    const breakdownParts: string[] = [];
    let totalUnitPrice = 0;
    let totalSets = 0;

    // Track if base fee should be added
    let includeBaseFee = false;

    // ========== FIELD 1: UL Base+ ==========
    // If field is filled (even with 0), add base_fee + (field1 × per_set_fee)
    // field1 = 0 → base_fee only
    // field1 = 1 → base_fee + 1×per_set_fee
    if (fields.basePlus !== undefined) {
      includeBaseFee = true;
      totalUnitPrice += baseFee;
      totalSets += fields.basePlus;
      totalUnitPrice += fields.basePlus * perSetFee;
    }

    // ========== FIELD 2: UL +sets ==========
    // Add field2 × per_set_fee
    if (fields.plusSets !== undefined && fields.plusSets > 0) {
      totalSets += fields.plusSets;
      totalUnitPrice += fields.plusSets * perSetFee;
    }

    // Build breakdown string combining base + total sets
    if (includeBaseFee && totalSets > 0) {
      const setsAmount = totalSets * perSetFee;
      breakdownParts.push(`Base ($${formatPrice(baseFee)}) + ${totalSets} Set${totalSets !== 1 ? 's' : ''} ($${formatPrice(setsAmount)})`);
    } else if (includeBaseFee) {
      breakdownParts.push(`Base ($${formatPrice(baseFee)})`);
    } else if (totalSets > 0) {
      const setsAmount = totalSets * perSetFee;
      breakdownParts.push(`${totalSets} Set${totalSets !== 1 ? 's' : ''} ($${formatPrice(setsAmount)})`);
    }

    // ========== FIELD 3: UL $ ==========
    // Straight dollar amount (can be negative)
    if (fields.dollarFlat !== undefined) {
      totalUnitPrice += fields.dollarFlat;
      const prefix = fields.dollarFlat >= 0 ? '+ ' : '';
      breakdownParts.push(`${prefix}$${formatPrice(Math.abs(fields.dollarFlat))} Flat`);
    }

    // ========== FINAL RESULT ==========
    if (breakdownParts.length === 0) {
      return {
        status: 'pending',
        display: 'Enter at least one UL value',
        data: null
      };
    }

    // Create single component with breakdown
    const components: ComponentItem[] = [{
      name: 'UL',
      price: totalUnitPrice,
      type: 'ul',
      calculationDisplay: breakdownParts.join(' ')
    }];

    const calculationData: PricingCalculationData = {
      productTypeId: 12,
      rowId: input.rowId,
      itemName: 'UL',
      unitPrice: totalUnitPrice,
      quantity: fields.quantity,
      components: components,
      hasCompleteSet: true
    };

    return {
      status: 'completed',
      display: '', // Not used - components have their own calculationDisplay
      data: calculationData
    };

  } catch (error) {
    console.error('UL pricing calculation error:', error);
    return {
      status: 'error',
      display: 'Calculation error',
      data: null
    };
  }
};
