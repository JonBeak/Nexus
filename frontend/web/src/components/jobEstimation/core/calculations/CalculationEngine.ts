// Pricing Calculation Engine
// Clean router that extracts validation layer outputs and delegates to specific product calculators

import { PricingCalculationContext } from '../types/GridTypes';
import { RowCalculationResult } from '../types/LayerTypes';
import { calculateChannelLetters } from './channelLettersPricing';

// Clean, direct routing by product type ID
export const runRowPricingCalculationFromValidationOutput = (
  rowId: string,
  context: PricingCalculationContext
): RowCalculationResult => {
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

  // Create clean validated input for pricing calculators
  const validatedInput = {
    rowId,
    productTypeId,
    parsedValues,      // From validation layer
    calculatedValues,  // From validation layer
    hasValidationErrors, // From validation layer
    customerPreferences: context.customerPreferences
  };

  // Hard-coded routing by product type ID (clean and maintainable)
  switch (productTypeId) {
    case 1:
      return calculateChannelLetters(validatedInput);

    case 2:
      return {
        status: 'pending',
        display: 'Vinyl calculation not implemented',
        data: null
      };

    case 3:
      return {
        status: 'pending',
        display: 'Substrate calculation not implemented',
        data: null
      };

    default:
      return {
        status: 'not_configured',
        display: 'Product calculation not implemented',
        data: null
      };
  }
};