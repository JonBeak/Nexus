// Pricing Calculation Engine
// Clean router that extracts validation layer outputs and delegates to specific product calculators

import { PricingCalculationContext } from '../types/GridTypes';
import { RowCalculationResult } from '../types/LayerTypes';
import { ValidatedPricingInput, ProductCalculator } from './types/CalculatorTypes';
import { calculateChannelLetters } from './channelLettersPricing';
import { calculateVinyl } from './vinylPricing';
import { calculateSubstrateCut } from './substrateCutPricing';
import { calculateBacker } from './backerPricing';
import { calculatePushThru } from './pushThruPricing';
import { calculateBladeSign } from './bladeSignPricing';
import { calculateLedNeon } from './ledNeonPricing';
import { calculatePainting } from './paintingPricing';
import { calculateCustom } from './customPricing';
import { calculateWiring } from './wiringPricing';
import { calculateUL } from './ulPricing';
import { calculateShipping } from './shippingPricing';
import { calculateMaterialCut } from './materialCutPricing';
import { calculateLed } from './ledPricing';
import { calculateEmptyRow } from './emptyRowPricing';
import { calculateDivider } from './dividerPricing';
import { calculateSubtotal } from './subtotalPricing';
import { calculateMultiplier } from './multiplierPricing';
import { calculateDiscountFee } from './discountFeePricing';

// Future Enhancement: Dynamic calculator registry
// Instead of switch statement, could use Map<number, ProductCalculator>
// Example: calculatorRegistry.set(1, calculateChannelLetters);
// For now, keeping the simple switch for clarity and type safety

// Clean, direct routing by product type ID
export const runRowPricingCalculationFromValidationOutput = async (
  rowId: string,
  context: PricingCalculationContext,
  ulExistsInPreviousRows: boolean = false
): Promise<RowCalculationResult> => {
  if (!context.validationResultsManager) {
    return {
      status: 'not_configured',
      display: 'No validation data available',
      data: null
    };
  }

  // Extract ONLY validation layer outputs - no raw grid data
  const parsedValues = context.validationResultsManager.getAllParsedValues(rowId) || {};
  const calculatedValues = context.validationResultsManager.getCalculatedValues(rowId) || {};
  const hasValidationErrors = context.validationResultsManager.hasBlockingErrors() || false;

  // Get product type from row metadata (where it's actually stored)
  const rowMetadata = context.validationResultsManager.getRowMetadata(rowId);
  const productTypeId = rowMetadata?.productTypeId;

  if (!productTypeId) {
    return {
      status: 'not_configured',
      display: 'No product type selected',
      data: null
    };
  }

  // Log validation status for debugging
  if (hasValidationErrors) {
    console.warn('[CalculationEngine] Row has validation errors', {
      rowId,
      productTypeId,
      hasValidationErrors,
      parsedValues,
      calculatedValues
    });
  }

  // Create clean validated input for pricing calculators
  const validatedInput: ValidatedPricingInput = {
    rowId,
    productTypeId,
    parsedValues,      // From validation layer
    calculatedValues,  // From validation layer
    hasValidationErrors, // From validation layer
    customerPreferences: context.customerPreferences,
    ulExistsInPreviousRows // Job-level UL tracking from calculation layer
  };

  // Product calculator routing
  // Each case delegates to a specific calculator implementing ProductCalculator interface
  switch (productTypeId) {
    case 1: // Channel Letters
      return await calculateChannelLetters(validatedInput);

    case 2: // Vinyl
      return await calculateVinyl(validatedInput);

    case 16: // ↳ Vinyl (sub-item) - uses same calculation as main Vinyl
      return await calculateVinyl(validatedInput);

    case 17: // ↳ Painting (sub-item) - uses same calculation as main Painting
      return await calculatePainting(validatedInput);

    case 18: // ↳ LED (sub-item) - uses same calculation as main LED
      return await calculateLed(validatedInput);

    case 3: // Substrate Cut
      return await calculateSubstrateCut(validatedInput);

    case 28: // ↳ Substrate Cut (sub-item) - uses same calculation as main Substrate Cut
      return await calculateSubstrateCut(validatedInput);

    case 4: // Backer
      return await calculateBacker(validatedInput, context.backerLookupTables);

    case 5: // Push Thru
      return await calculatePushThru(validatedInput, context.backerLookupTables);

    case 6: // Blade Sign
      return await calculateBladeSign(validatedInput);

    case 7: // LED Neon
      return await calculateLedNeon(validatedInput);

    case 8: // Painting
      return await calculatePainting(validatedInput);

    case 9: // Custom
      return await calculateCustom(validatedInput);

    case 10: // Wiring
      return await calculateWiring(validatedInput);

    case 11: // Material Cut
      return await calculateMaterialCut(validatedInput);

    case 12: // UL
      return await calculateUL(validatedInput);

    case 13: // Shipping
      return await calculateShipping(validatedInput);

    case 19: // ↳ Wiring (sub-item) - uses same calculation as main Wiring
      return await calculateWiring(validatedInput);

    case 20: // ↳ Material Cut (sub-item) - uses same calculation as main Material Cut
      return await calculateMaterialCut(validatedInput);

    case 26: // LED
      return await calculateLed(validatedInput);

    // Special Items
    case 0: // Select Type (placeholder, doesn't render in preview, doesn't affect calculations)
      return {
        status: 'completed',
        display: '',
        data: null
      };

    case 25: // Divider (marker for Multiplier sections, doesn't render in preview)
      return await calculateDivider(validatedInput);

    case 21: // Subtotal (section boundary marker, doesn't render in preview yet)
      return await calculateSubtotal(validatedInput);

    case 27: // Empty Row (spacing/formatting, optional label in field1)
      return await calculateEmptyRow(validatedInput);

    case 23: // Multiplier (quantity multiplier, doesn't render in preview, post-processed)
      return await calculateMultiplier(validatedInput);

    case 22: // Discount/Fee (pricing adjustment, doesn't render input row, post-processor creates line item)
      return await calculateDiscountFee(validatedInput);

    // Add more product types as needed:
    // case 14: Assembly

    default:
      return {
        status: 'not_configured',
        display: `Product type ${productTypeId} not implemented`,
        data: null
      };
  }
};