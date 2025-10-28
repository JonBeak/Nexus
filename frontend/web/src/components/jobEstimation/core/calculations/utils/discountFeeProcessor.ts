// Discount/Fee Processor
// Post-processes estimate items to apply discounts or surcharges
// Part of the Special Items Post-Processor chain

import { EstimateLineItem } from '../../layers/CalculationLayer';
import { PricingCalculationContext } from '../../types/GridTypes';
import { RowMetadata } from '../../validation/ValidationResultsManager';

// Product Type IDs
const DISCOUNT_FEE_PRODUCT_TYPE_ID = 22;
const DIVIDER_PRODUCT_TYPE_ID = 25;
const SUBTOTAL_PRODUCT_TYPE_ID = 21;

interface RowPosition {
  rowId: string;
  index: number;
  metadata: RowMetadata;
}

/**
 * Process Discount/Fee - calculate discounts/surcharges and create line items
 *
 * Algorithm:
 * 1. Build ordered array of all rows (from metadata)
 * 2. Find all Discount/Fee rows
 * 3. For each Discount/Fee row:
 *    a. Calculate affected items for Field 2 & 3 (stops at Divider)
 *    b. Calculate affected items for Field 5 & 6 (stops at Subtotal)
 *    c. Calculate affected items for Field 8 & 9 (whole estimate)
 *    d. For each pair: apply % first, then add flat $
 *    e. Sum all three pairs
 *    f. Create line item with "Discount" or "Surcharge" name
 * 4. Insert line items at appropriate positions
 *
 * @param items - Array of estimate line items
 * @param context - Pricing calculation context
 * @returns Modified array with discount/fee line items added
 */
export const processDiscountsFees = (
  items: EstimateLineItem[],
  context: PricingCalculationContext
): EstimateLineItem[] => {
  try {
    // Get all row metadata in order
    const allRowMetadata = context.validationResultsManager.getAllRowMetadata();

    // Build ordered array of row positions
    const rowPositions: RowPosition[] = [];
    let index = 0;
    for (const [rowId, metadata] of allRowMetadata) {
      rowPositions.push({ rowId, index, metadata });
      index++;
    }

    // Find all Discount/Fee rows
    const discountFeeRows = rowPositions.filter(
      pos => pos.metadata.productTypeId === DISCOUNT_FEE_PRODUCT_TYPE_ID
    );

    if (discountFeeRows.length === 0) {
      // No discount/fees - return items unchanged
      return items;
    }

    console.log('[DiscountFeeProcessor] Found discount/fee rows:', discountFeeRows.length);

    // Process each Discount/Fee row and collect line items to insert
    const lineItemsToInsert: Array<{ afterRowId: string; lineItem: EstimateLineItem }> = [];

    for (const discountFeeRow of discountFeeRows) {
      const parsedValues = context.validationResultsManager.getAllParsedValues(discountFeeRow.rowId);

      // Extract field values
      const field2Percent = (parsedValues.field2 as number) || 0;
      const field3Flat = (parsedValues.field3 as number) || 0;
      const field5Percent = (parsedValues.field5 as number) || 0;
      const field6Flat = (parsedValues.field6 as number) || 0;
      const field8Percent = (parsedValues.field8 as number) || 0;
      const field9Flat = (parsedValues.field9 as number) || 0;
      const notesText = (parsedValues.field10 as string) || '';

      console.log(`[DiscountFeeProcessor] Processing Discount/Fee at index ${discountFeeRow.index}:`, {
        field2Percent,
        field3Flat,
        field5Percent,
        field6Flat,
        field8Percent,
        field9Flat,
        notesText: notesText || '(none)'
      });

      // Calculate discount/fee for each pair
      let totalDiscountFee = 0;

      // Pair 1: Fields 2 & 3 (stops at Divider)
      if (field2Percent !== 0 || field3Flat !== 0) {
        const affectedIndices = getAffectedIndicesStopAtDivider(discountFeeRow.index, rowPositions);
        const subtotal = calculateSubtotal(affectedIndices, rowPositions, items);
        const percentAmount = subtotal * (field2Percent / 100);
        const pairTotal = percentAmount + field3Flat;
        totalDiscountFee += pairTotal;

        console.log(`[DiscountFeeProcessor] Pair 1 (Divider): subtotal=${subtotal}, percent=${percentAmount}, flat=${field3Flat}, total=${pairTotal}`);
      }

      // Pair 2: Fields 5 & 6 (stops at Subtotal)
      if (field5Percent !== 0 || field6Flat !== 0) {
        const affectedIndices = getAffectedIndicesStopAtSubtotal(discountFeeRow.index, rowPositions);
        const subtotal = calculateSubtotal(affectedIndices, rowPositions, items);
        const percentAmount = subtotal * (field5Percent / 100);
        const pairTotal = percentAmount + field6Flat;
        totalDiscountFee += pairTotal;

        console.log(`[DiscountFeeProcessor] Pair 2 (Subtotal): subtotal=${subtotal}, percent=${percentAmount}, flat=${field6Flat}, total=${pairTotal}`);
      }

      // Pair 3: Fields 8 & 9 (whole estimate)
      if (field8Percent !== 0 || field9Flat !== 0) {
        const affectedIndices = getAffectedIndicesWholeEstimate(discountFeeRow.index);
        const subtotal = calculateSubtotal(affectedIndices, rowPositions, items);
        const percentAmount = subtotal * (field8Percent / 100);
        const pairTotal = percentAmount + field9Flat;
        totalDiscountFee += pairTotal;

        console.log(`[DiscountFeeProcessor] Pair 3 (Estimate): subtotal=${subtotal}, percent=${percentAmount}, flat=${field9Flat}, total=${pairTotal}`);
      }

      // Check if any fields have values (to determine if we should create a line item)
      const hasAnyInput =
        field2Percent !== 0 || field3Flat !== 0 ||
        field5Percent !== 0 || field6Flat !== 0 ||
        field8Percent !== 0 || field9Flat !== 0;

      // Only create line item if at least one field has input
      if (hasAnyInput) {
        // Determine line item name based on final amount
        // Negative = "Discount", Zero or Positive = "Surcharge"
        const itemName = totalDiscountFee < 0 ? 'Discount' : 'Surcharge';

        // Build calculationDisplay with notes and breakdown
        let calculationDisplay = '';

        // Add notes text on first line if present
        if (notesText.trim()) {
          calculationDisplay = notesText.trim();
        }

        // Build breakdown lines for each pair
        const breakdownLines: string[] = [];

        // Pair 1: Divider (fields 2 & 3)
        if (field2Percent !== 0 || field3Flat !== 0) {
          const parts: string[] = [];
          if (field2Percent !== 0) {
            parts.push(field2Percent >= 0 ? `+${field2Percent}%` : `${field2Percent}%`);
          }
          if (field3Flat !== 0) {
            parts.push(field3Flat >= 0 ? `+ $${field3Flat.toFixed(2)}` : `- $${Math.abs(field3Flat).toFixed(2)}`);
          }
          breakdownLines.push(`Divider: ${parts.join(' ')}`);
        }

        // Pair 2: Subtotal (fields 5 & 6)
        if (field5Percent !== 0 || field6Flat !== 0) {
          const parts: string[] = [];
          if (field5Percent !== 0) {
            parts.push(field5Percent >= 0 ? `+${field5Percent}%` : `${field5Percent}%`);
          }
          if (field6Flat !== 0) {
            parts.push(field6Flat >= 0 ? `+ $${field6Flat.toFixed(2)}` : `- $${Math.abs(field6Flat).toFixed(2)}`);
          }
          breakdownLines.push(`Subtotal: ${parts.join(' ')}`);
        }

        // Pair 3: Estimate (fields 8 & 9)
        if (field8Percent !== 0 || field9Flat !== 0) {
          const parts: string[] = [];
          if (field8Percent !== 0) {
            parts.push(field8Percent >= 0 ? `+${field8Percent}%` : `${field8Percent}%`);
          }
          if (field9Flat !== 0) {
            parts.push(field9Flat >= 0 ? `+ $${field9Flat.toFixed(2)}` : `- $${Math.abs(field9Flat).toFixed(2)}`);
          }
          breakdownLines.push(parts.join(' '));
        }

        // Combine notes and breakdown
        if (breakdownLines.length > 0) {
          if (calculationDisplay) {
            calculationDisplay += '\n' + breakdownLines.join('\n');
          } else {
            calculationDisplay = breakdownLines.join('\n');
          }
        }

        const lineItem: EstimateLineItem = {
          rowId: discountFeeRow.rowId,
          inputGridDisplayNumber: discountFeeRow.metadata.displayNumber,
          productTypeId: DISCOUNT_FEE_PRODUCT_TYPE_ID,
          productTypeName: 'Discount/Fee',
          itemName: itemName,
          description: '',
          calculationDisplay: calculationDisplay, // Notes + breakdown in Details column
          unitPrice: Math.round(totalDiscountFee * 100) / 100,
          quantity: 1,
          extendedPrice: Math.round(totalDiscountFee * 100) / 100
        };

        lineItemsToInsert.push({
          afterRowId: discountFeeRow.rowId,
          lineItem
        });

        console.log(`[DiscountFeeProcessor] Created ${itemName} line item:`, {
          amount: totalDiscountFee,
          afterRowId: discountFeeRow.rowId
        });
      }
    }

    // Insert line items at appropriate positions
    // We insert after the discount/fee row position
    const modifiedItems = [...items];

    // Sort by row position (descending) so we can insert from bottom to top
    // This prevents index shifting issues
    lineItemsToInsert.sort((a, b) => {
      const indexA = rowPositions.findIndex(pos => pos.rowId === a.afterRowId);
      const indexB = rowPositions.findIndex(pos => pos.rowId === b.afterRowId);
      return indexB - indexA;
    });

    for (const { afterRowId, lineItem } of lineItemsToInsert) {
      // Find the last item with this rowId (or before it)
      // We want to insert after all items from rows before the discount/fee row
      const insertIndex = findInsertPosition(modifiedItems, afterRowId, rowPositions);
      modifiedItems.splice(insertIndex, 0, lineItem);
    }

    return modifiedItems;

  } catch (error) {
    console.error('[DiscountFeeProcessor] Error processing discount/fees:', error);
    // Return items unchanged on error (safe fallback)
    return items;
  }
};

/**
 * Get indices of rows affected by Pair 1 (stops at Divider)
 * Scans UPWARD from Discount/Fee until hitting Divider or start of grid
 */
const getAffectedIndicesStopAtDivider = (
  discountFeeIndex: number,
  rowPositions: RowPosition[]
): number[] => {
  const affectedIndices: number[] = [];

  // Scan upward from the row ABOVE the Discount/Fee
  for (let i = discountFeeIndex - 1; i >= 0; i--) {
    const productTypeId = rowPositions[i].metadata.productTypeId;

    // Stop at Divider (don't include it)
    if (productTypeId === DIVIDER_PRODUCT_TYPE_ID) {
      break;
    }

    affectedIndices.push(i);
  }

  return affectedIndices;
};

/**
 * Get indices of rows affected by Pair 2 (stops at Subtotal)
 * Scans UPWARD from Discount/Fee until hitting Subtotal or start of grid
 */
const getAffectedIndicesStopAtSubtotal = (
  discountFeeIndex: number,
  rowPositions: RowPosition[]
): number[] => {
  const affectedIndices: number[] = [];

  // Scan upward from the row ABOVE the Discount/Fee
  for (let i = discountFeeIndex - 1; i >= 0; i--) {
    const productTypeId = rowPositions[i].metadata.productTypeId;

    // Stop at Subtotal (don't include it)
    if (productTypeId === SUBTOTAL_PRODUCT_TYPE_ID) {
      break;
    }

    affectedIndices.push(i);
  }

  return affectedIndices;
};

/**
 * Get indices of rows affected by Pair 3 (whole estimate)
 * Includes ALL rows from start of grid up to (but not including) the Discount/Fee
 */
const getAffectedIndicesWholeEstimate = (discountFeeIndex: number): number[] => {
  const affectedIndices: number[] = [];

  // All rows above the Discount/Fee
  for (let i = 0; i < discountFeeIndex; i++) {
    affectedIndices.push(i);
  }

  return affectedIndices;
};

/**
 * Calculate subtotal of items at specific row indices
 */
const calculateSubtotal = (
  indices: number[],
  rowPositions: RowPosition[],
  items: EstimateLineItem[]
): number => {
  let subtotal = 0;

  for (const index of indices) {
    const rowId = rowPositions[index].rowId;
    // Find all items with this rowId and sum their extended prices
    const rowItems = items.filter(item => item.rowId === rowId);
    const rowTotal = rowItems.reduce((sum, item) => sum + item.extendedPrice, 0);
    subtotal += rowTotal;
  }

  return subtotal;
};

/**
 * Find the position to insert a discount/fee line item
 * We insert after all items from rows before the discount/fee row
 */
const findInsertPosition = (
  items: EstimateLineItem[],
  discountFeeRowId: string,
  rowPositions: RowPosition[]
): number => {
  // Find the index of the discount/fee row in rowPositions
  const discountFeeIndex = rowPositions.findIndex(pos => pos.rowId === discountFeeRowId);

  if (discountFeeIndex === -1) {
    // Shouldn't happen, but fallback to end
    return items.length;
  }

  // Find the last item from rows before the discount/fee row
  let lastItemIndex = -1;

  for (let i = items.length - 1; i >= 0; i--) {
    const itemRowId = items[i].rowId;
    const itemRowIndex = rowPositions.findIndex(pos => pos.rowId === itemRowId);

    if (itemRowIndex !== -1 && itemRowIndex < discountFeeIndex) {
      lastItemIndex = i;
      break;
    }
  }

  // Insert after the last item (or at the beginning if no items found)
  return lastItemIndex + 1;
};
