// Subtotal Processor
// Post-processes estimate items to calculate and display section subtotals
// Part of the Special Items Post-Processor chain

import { EstimateLineItem } from '../../layers/CalculationLayer';
import { PricingCalculationContext } from '../../types/GridTypes';
import { RowMetadata } from '../../validation/ValidationResultsManager';
import { formatPriceWithCommas } from './priceFormatter';

// Product Type IDs
const SUBTOTAL_PRODUCT_TYPE_ID = 21;
const DIVIDER_PRODUCT_TYPE_ID = 25;

interface RowPosition {
  rowId: string;
  index: number;
  metadata: RowMetadata;
}

/**
 * Process Subtotal - calculate section subtotals and create line items
 *
 * Algorithm:
 * 1. Build ordered array of all rows (from metadata)
 * 2. Find all Subtotal rows
 * 3. For each Subtotal row:
 *    a. Scan upward until hitting previous Subtotal or start of grid
 *    b. IGNORE Dividers (include items across Dividers in section)
 *    c. Calculate section subtotal (sum of extendedPrice)
 *    d. Calculate tax (subtotal × taxRate)
 *    e. Calculate section total (subtotal + tax)
 *    f. Get memo text from field1 (optional)
 *    g. Create line item with multi-line calculationDisplay
 * 4. Insert line items at appropriate positions
 *
 * Display Format:
 * - If memo exists:
 *   First Section
 *   Subtotal: $460.00
 *   tax (13%): $59.80
 *   Section Total: $519.80
 *
 * - If no memo:
 *   Subtotal: $460.00
 *   tax (13%): $59.80
 *   Section Total: $519.80
 *
 * Important:
 * - Subtotal line items do NOT contribute to final estimate total
 * - They are informational display only
 * - itemName is empty, all data in calculationDisplay (Details column)
 * - QTY, UNIT PRICE, EXT. PRICE columns remain empty
 *
 * @param items - Array of estimate line items
 * @param context - Pricing calculation context
 * @returns Modified array with subtotal line items added
 */
export const processSubtotals = (
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

    // Find all Subtotal rows
    const subtotalRows = rowPositions.filter(
      pos => pos.metadata.productTypeId === SUBTOTAL_PRODUCT_TYPE_ID
    );

    if (subtotalRows.length === 0) {
      // No subtotals - return items unchanged
      return items;
    }

    // Process each Subtotal row and collect line items to insert
    const lineItemsToInsert: Array<{ afterRowId: string; lineItem: EstimateLineItem }> = [];

    for (const subtotalRow of subtotalRows) {
      const parsedValues = context.validationResultsManager.getAllParsedValues(subtotalRow.rowId);

      // Get optional memo text from field1
      const memoText = (parsedValues.field1 as string) || '';

      // Calculate section subtotal
      const affectedIndices = getAffectedIndicesStopAtSubtotal(subtotalRow.index, rowPositions);
      const sectionSubtotal = calculateSubtotal(affectedIndices, rowPositions, items);

      // Calculate tax
      const taxRate = context.taxRate || 0;
      const sectionTax = sectionSubtotal * taxRate;

      // Calculate section total
      const sectionTotal = sectionSubtotal + sectionTax;

      // Format the calculationDisplay with aligned dollar amounts
      const taxPercentage = (taxRate * 100).toFixed(1);
      let calculationDisplay = '';

      if (memoText.trim()) {
        calculationDisplay = `${memoText}\n`;
      }

      // Pad labels to align dollar signs (using 20 character width for label portion)
      const subtotalLabel = 'Subtotal:'.padEnd(20, ' ');
      const taxLabel = `Tax(${taxPercentage}%):`.padEnd(19, ' ');
      const totalLabel = 'Section Total:'.padEnd(18, ' ');

      calculationDisplay += `${subtotalLabel}$${formatPriceWithCommas(sectionSubtotal)}\n`;
      calculationDisplay += `${taxLabel}$${formatPriceWithCommas(sectionTax)}\n`;
      calculationDisplay += `${totalLabel}$${formatPriceWithCommas(sectionTotal)}`;

      // Create line item
      const lineItem: EstimateLineItem = {
        rowId: subtotalRow.rowId,
        inputGridDisplayNumber: subtotalRow.metadata.displayNumber,
        productTypeId: SUBTOTAL_PRODUCT_TYPE_ID,
        productTypeName: 'Subtotal',
        itemName: '', // Empty - all data in calculationDisplay
        description: '',
        calculationDisplay: calculationDisplay,
        unitPrice: 0, // Not displayed
        quantity: 0, // Not displayed
        extendedPrice: 0 // Not displayed, not included in final total
      };

      lineItemsToInsert.push({
        afterRowId: subtotalRow.rowId,
        lineItem
      });
    }

    // Insert line items at appropriate positions
    // We insert after the subtotal row position
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
      const insertIndex = findInsertPosition(modifiedItems, afterRowId, rowPositions);
      modifiedItems.splice(insertIndex, 0, lineItem);
    }

    return modifiedItems;

  } catch (error) {
    console.error('[SubtotalProcessor] Error processing subtotals:', error);
    // Return items unchanged on error (safe fallback)
    return items;
  }
};

/**
 * Get indices of rows affected by Subtotal
 * Scans UPWARD from Subtotal until hitting previous Subtotal or start of grid
 * IGNORES Dividers (includes items across Dividers in section)
 */
const getAffectedIndicesStopAtSubtotal = (
  subtotalIndex: number,
  rowPositions: RowPosition[]
): number[] => {
  const affectedIndices: number[] = [];

  // Scan upward from the row ABOVE the Subtotal
  for (let i = subtotalIndex - 1; i >= 0; i--) {
    const productTypeId = rowPositions[i].metadata.productTypeId;

    // Stop at previous Subtotal (don't include it)
    if (productTypeId === SUBTOTAL_PRODUCT_TYPE_ID) {
      break;
    }

    // IGNORE Dividers - continue scanning (include items across Dividers)
    // All other rows are included in the section
    affectedIndices.push(i);
  }

  return affectedIndices;
};

/**
 * Calculate subtotal of items at specific row indices
 * Sums the extendedPrice of all items from the affected rows
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
 * Find the position to insert a subtotal line item
 * We insert after all items from rows before the subtotal row
 */
const findInsertPosition = (
  items: EstimateLineItem[],
  subtotalRowId: string,
  rowPositions: RowPosition[]
): number => {
  // Find the index of the subtotal row in rowPositions
  const subtotalIndex = rowPositions.findIndex(pos => pos.rowId === subtotalRowId);

  if (subtotalIndex === -1) {
    // Shouldn't happen, but fallback to end
    return items.length;
  }

  // Find the last item from rows before the subtotal row
  let lastItemIndex = -1;

  for (let i = items.length - 1; i >= 0; i--) {
    const itemRowId = items[i].rowId;
    const itemRowIndex = rowPositions.findIndex(pos => pos.rowId === itemRowId);

    if (itemRowIndex !== -1 && itemRowIndex < subtotalIndex) {
      lastItemIndex = i;
      break;
    }
  }

  // Insert after the last item (or at the beginning if no items found)
  return lastItemIndex + 1;
};
