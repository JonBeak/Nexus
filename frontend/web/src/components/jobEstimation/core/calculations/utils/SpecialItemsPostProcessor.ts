// Special Items Post-Processor
// Orchestrates post-processing of special items in defined order
// Runs AFTER individual row calculations, BEFORE estimate preview

import { EstimateLineItem } from '../../layers/CalculationLayer';
import { PricingCalculationContext } from '../../types/GridTypes';
import { processEmptyRows } from './emptyRowProcessor';
import { processDividers } from './dividerProcessor';
import { processMultipliers } from './multiplierProcessor';
import { processDiscountsFees } from './discountFeeProcessor';
import { processSubtotals } from './subtotalProcessor';

/**
 * Post-process special items in the correct order
 *
 * All special items go through this processor for architectural consistency,
 * even if some are currently pass-through operations.
 *
 * Processing order (as defined in architecture):
 * 1. Empty Row - Pass-through (future: filtering, grouping, custom styling)
 * 2. Assembly - Future implementation (group related items, calculate assembly pricing)
 * 3. Divider - Pass-through (future: section headers, visual separators in preview)
 * 4. Multiplier - ✅ Implemented: Modify quantities of affected items retroactively
 * 5. Discount/Fee - ✅ Implemented: Apply discounts/fees and create line items
 * 6. Subtotal - ✅ Implemented: Calculate and display section subtotals with tax breakdown
 *
 * Architecture Benefits:
 * - Clear separation: special items handled separately from regular products
 * - Extensibility: easy to add functionality to any step
 * - Consistency: all special items follow same pattern
 * - Order matters: each step can depend on previous steps' results
 *
 * @param items - Array of estimate line items from calculation layer
 * @param context - Pricing calculation context with validation data
 * @returns Modified array of estimate line items
 */
export const applySpecialItemsPostProcessing = (
  items: EstimateLineItem[],
  context: PricingCalculationContext
): EstimateLineItem[] => {
  console.log('[SpecialItemsPostProcessor] Starting post-processing', {
    initialItemCount: items.length
  });

  // Create a working copy to avoid mutating the original array
  let processedItems = [...items];

  // Step 1: Empty Row - Pass-through for now (future: filtering, grouping, styling)
  processedItems = processEmptyRows(processedItems, context);

  // Step 2: Assembly - Future implementation
  // processedItems = processAssemblies(processedItems, context);

  // Step 3: Divider - Pass-through for now (future: section headers, visual dividers)
  processedItems = processDividers(processedItems, context);

  // Step 4: Multiplier - Modify quantities retroactively
  processedItems = processMultipliers(processedItems, context);

  // Step 5: Discount/Fee - Apply discounts/fees and create line items
  processedItems = processDiscountsFees(processedItems, context);

  // Step 6: Subtotal - Calculate and display section subtotals with tax breakdown
  processedItems = processSubtotals(processedItems, context);

  console.log('[SpecialItemsPostProcessor] Post-processing complete', {
    finalItemCount: processedItems.length
  });

  return processedItems;
};
