// Empty Row Processor
// Post-processes Empty Row special items
// Part of the Special Items Post-Processor chain

import { EstimateLineItem } from '../../layers/CalculationLayer';
import { PricingCalculationContext } from '../../types/GridTypes';

/**
 * Process Empty Rows - currently a pass-through
 *
 * Empty Rows are already handled by their calculator (emptyRowPricing.ts)
 * which returns data: { components: [], quantity: 0 }
 *
 * This processor is here for architectural consistency and future extensibility.
 * Potential future enhancements:
 * - Filter out Empty Rows from preview based on user preference
 * - Group consecutive Empty Rows
 * - Add custom styling metadata
 *
 * @param items - Array of estimate line items
 * @param context - Pricing calculation context
 * @returns Items array (unchanged for now)
 */
export const processEmptyRows = (
  items: EstimateLineItem[],
  context: PricingCalculationContext
): EstimateLineItem[] => {
  // Empty Rows don't require post-processing at this time
  // They appear in the estimate preview with $0 value as intended
  return items;
};
