// Multiplier Processor
// Post-processes estimate items to apply quantity multipliers
// Part of the Special Items Post-Processor chain

import { EstimateLineItem } from '../../layers/CalculationLayer';
import { PricingCalculationContext } from '../../types/GridTypes';
import { RowMetadata } from '../../validation/ValidationResultsManager';

// Product Type IDs
const MULTIPLIER_PRODUCT_TYPE_ID = 23;
const DIVIDER_PRODUCT_TYPE_ID = 25;
const SUBTOTAL_PRODUCT_TYPE_ID = 21; // Future implementation

interface RowPosition {
  rowId: string;
  index: number;
  metadata: RowMetadata;
}

/**
 * Process Multipliers - modify quantities of affected items
 *
 * Algorithm:
 * 1. Build ordered array of all rows (from metadata)
 * 2. Find all Multiplier rows
 * 3. For each Multiplier row:
 *    a. Determine scope for Field 1 (stops at Divider)
 *    b. Determine scope for Field 2 (stops at Subtotal)
 *    c. Determine scope for Field 3 (all rows above)
 *    d. Apply multipliers to affected items
 * 4. Multiple multipliers are cumulative (multiply together)
 *
 * @param items - Array of estimate line items
 * @param context - Pricing calculation context
 * @returns Modified array with updated quantities and extended prices
 */
export const processMultipliers = (
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

    // Find all Multiplier rows
    const multiplierRows = rowPositions.filter(
      pos => pos.metadata.productTypeId === MULTIPLIER_PRODUCT_TYPE_ID
    );

    if (multiplierRows.length === 0) {
      // No multipliers - return items unchanged
      return items;
    }

    console.log('[MultiplierProcessor] Found multiplier rows:', multiplierRows.length);

    // Build a map of cumulative multipliers for each row
    // rowId -> cumulative multiplier value
    const multiplierMap = new Map<string, number>();

    // Initialize all rows with 1.0 (no multiplier)
    for (const pos of rowPositions) {
      multiplierMap.set(pos.rowId, 1.0);
    }

    // Process each Multiplier row
    for (const multiplierRow of multiplierRows) {
      const parsedValues = context.validationResultsManager.getAllParsedValues(multiplierRow.rowId);
      const field1Value = parsedValues.field1 as number | undefined;
      const field2Value = parsedValues.field2 as number | undefined;
      const field3Value = parsedValues.field3 as number | undefined;

      console.log(`[MultiplierProcessor] Processing Multiplier at index ${multiplierRow.index}:`, {
        field1Value,
        field2Value,
        field3Value
      });

      // Field 1: Affects rows above, stopping at first Divider
      if (field1Value && field1Value > 0) {
        const affectedIndices = getField1AffectedIndices(multiplierRow.index, rowPositions);
        applyMultiplierToIndices(affectedIndices, field1Value, rowPositions, multiplierMap);
      }

      // Field 2: Affects rows above, stopping at first Subtotal
      if (field2Value && field2Value > 0) {
        const affectedIndices = getField2AffectedIndices(multiplierRow.index, rowPositions);
        applyMultiplierToIndices(affectedIndices, field2Value, rowPositions, multiplierMap);
      }

      // Field 3: Affects ALL rows above (entire estimate)
      if (field3Value && field3Value > 0) {
        const affectedIndices = getField3AffectedIndices(multiplierRow.index);
        applyMultiplierToIndices(affectedIndices, field3Value, rowPositions, multiplierMap);
      }
    }

    // Apply multipliers to items
    const modifiedItems = items.map(item => {
      const multiplier = multiplierMap.get(item.rowId) || 1.0;

      if (multiplier === 1.0) {
        // No multiplier - return unchanged
        return item;
      }

      // Apply multiplier to quantity and recalculate extended price
      const newQuantity = item.quantity * multiplier;
      const newExtendedPrice = Math.round((item.unitPrice * newQuantity) * 100) / 100;

      console.log(`[MultiplierProcessor] Applying multiplier to row ${item.rowId}:`, {
        originalQuantity: item.quantity,
        multiplier,
        newQuantity,
        newExtendedPrice
      });

      return {
        ...item,
        quantity: newQuantity,
        extendedPrice: newExtendedPrice
      };
    });

    return modifiedItems;

  } catch (error) {
    console.error('[MultiplierProcessor] Error processing multipliers:', error);
    // Return items unchanged on error (safe fallback)
    return items;
  }
};

/**
 * Get indices of rows affected by Field 1 (stops at Divider)
 * Scans UPWARD from Multiplier until hitting Divider or start of grid
 */
const getField1AffectedIndices = (
  multiplierIndex: number,
  rowPositions: RowPosition[]
): number[] => {
  const affectedIndices: number[] = [];

  // Scan upward from the row ABOVE the Multiplier
  for (let i = multiplierIndex - 1; i >= 0; i--) {
    const productTypeId = rowPositions[i].metadata.productTypeId;

    // Stop at Divider only (don't include it)
    if (productTypeId === DIVIDER_PRODUCT_TYPE_ID) {
      break;
    }

    affectedIndices.push(i);
  }

  return affectedIndices;
};

/**
 * Get indices of rows affected by Field 2 (stops at Subtotal)
 * Scans UPWARD from Multiplier until hitting Subtotal or start of grid
 */
const getField2AffectedIndices = (
  multiplierIndex: number,
  rowPositions: RowPosition[]
): number[] => {
  const affectedIndices: number[] = [];

  // Scan upward from the row ABOVE the Multiplier
  for (let i = multiplierIndex - 1; i >= 0; i--) {
    const productTypeId = rowPositions[i].metadata.productTypeId;

    // Stop at Subtotal only (don't include it)
    if (productTypeId === SUBTOTAL_PRODUCT_TYPE_ID) {
      break;
    }

    affectedIndices.push(i);
  }

  return affectedIndices;
};

/**
 * Get indices of rows affected by Field 3 (all rows above)
 * Includes ALL rows from start of grid up to (but not including) the Multiplier
 */
const getField3AffectedIndices = (multiplierIndex: number): number[] => {
  const affectedIndices: number[] = [];

  // All rows above the Multiplier
  for (let i = 0; i < multiplierIndex; i++) {
    affectedIndices.push(i);
  }

  return affectedIndices;
};

/**
 * Apply multiplier to specific row indices
 * Updates the multiplierMap by multiplying existing value by new multiplier
 */
const applyMultiplierToIndices = (
  indices: number[],
  multiplierValue: number,
  rowPositions: RowPosition[],
  multiplierMap: Map<string, number>
): void => {
  for (const index of indices) {
    const rowId = rowPositions[index].rowId;
    const currentMultiplier = multiplierMap.get(rowId) || 1.0;
    const newMultiplier = currentMultiplier * multiplierValue;
    multiplierMap.set(rowId, newMultiplier);
  }
};
