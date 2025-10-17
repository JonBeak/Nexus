// Divider Processor
// Post-processes Divider special items
// Part of the Special Items Post-Processor chain

import { EstimateLineItem } from '../../layers/CalculationLayer';
import { PricingCalculationContext } from '../../types/GridTypes';

/**
 * Process Dividers - currently a pass-through
 *
 * Dividers are already handled by their calculator (dividerPricing.ts)
 * which returns data: null (so they don't appear in estimate preview)
 *
 * This processor is here for architectural consistency and future extensibility.
 * Dividers serve as markers for Multiplier scope calculation.
 *
 * Potential future enhancements:
 * - Insert visual divider lines in estimate preview
 * - Group items between dividers with subtotals
 * - Add section headers based on divider labels
 *
 * @param items - Array of estimate line items
 * @param context - Pricing calculation context
 * @returns Items array (unchanged for now)
 */
export const processDividers = (
  items: EstimateLineItem[],
  context: PricingCalculationContext
): EstimateLineItem[] => {
  // Dividers don't require post-processing at this time
  // They are filtered out by returning data: null in their calculator
  // Their positions are tracked in row metadata for Multiplier scope calculation
  return items;
};
