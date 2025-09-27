/**
 * Data conversion functions between EstimateRow and GridRowCore formats
 * For migrating existing data to the new Base Layer system
 */

import { EstimateRow } from '../../types';
import { GridRowCore, GridRowType } from '../types/CoreTypes';
import { GridRow } from '../types/LayerTypes';

/**
 * Converts EstimateRow to GridRowCore format
 * @param estimateRow - EstimateRow object from database/API
 * @returns GridRowCore object for new system
 */
export const estimateRowToGridRowCore = (estimateRow: EstimateRow): GridRowCore => {
  // Determine row type from EstimateRow properties
  const rowType: GridRowType = determineRowType(estimateRow);
  
  // Convert all data values to strings (base layer requirement)
  const data: Record<string, string> = {};
  if (estimateRow.data) {
    for (const [key, value] of Object.entries(estimateRow.data)) {
      data[key] = value == null ? '' : String(value);
    }
  }

  return {
    id: estimateRow.id,
    dbId: estimateRow.dbId,
    productTypeId: estimateRow.productTypeId,
    productTypeName: estimateRow.productTypeName,
    data,
    rowType,
    parentProductId: estimateRow.parentProductId
  };
};

/**
 * Converts GridRowCore back to EstimateRow format for database persistence
 * @param gridRowCore - GridRowCore object from new system
 * @returns EstimateRow object for database/API
 */
export const gridRowCoreToEstimateRow = (gridRowCore: GridRowCore): EstimateRow => {
  return {
    id: gridRowCore.id,
    dbId: gridRowCore.dbId,
    productTypeId: gridRowCore.productTypeId,
    productTypeName: gridRowCore.productTypeName,
    assemblyId: undefined,
    indent: calculateIndent(gridRowCore.rowType),
    data: { ...gridRowCore.data },
    isMainRow: gridRowCore.rowType === 'main',
    parentProductId: gridRowCore.parentProductId
  };
};

/**
 * Converts array of EstimateRows to GridRowCores
 * @param estimateRows - Array of EstimateRow objects
 * @returns Array of GridRowCore objects
 */
export const estimateRowsToGridRowCores = (estimateRows: EstimateRow[]): GridRowCore[] => {
  return estimateRows.map(estimateRowToGridRowCore);
};

/**
 * Converts array of GridRowCores back to EstimateRows
 * @param gridRowCores - Array of GridRowCore objects
 * @returns Array of EstimateRow objects
 */
export const gridRowCoresToEstimateRows = (gridRowCores: GridRowCore[]): EstimateRow[] => {
  return gridRowCores.map(gridRowCoreToEstimateRow);
};

/**
 * Converts full GridRows (with calculated properties) to EstimateRows for external use
 * @param gridRows - Array of full GridRow objects
 * @returns Array of EstimateRow objects
 */
export const gridRowsToEstimateRows = (gridRows: GridRow[]): EstimateRow[] => {
  return gridRows.map(gridRow => {
    const estimateRow = gridRowCoreToEstimateRow(gridRow);

    if (gridRow.calculation) {
      estimateRow.calculation = gridRow.calculation;
    }

    return estimateRow;
  });
};

// Helper functions

/**
 * Determines GridRowType from EstimateRow properties
 * @param estimateRow - EstimateRow to analyze
 * @returns GridRowType
 */
function determineRowType(estimateRow: EstimateRow): GridRowType {
  // Check if this is a main row
  if (estimateRow.isMainRow === true || !estimateRow.parentProductId) {
    return 'main';
  }
  
  // Has a parent - for now, assume all are sub-items
  // Future: Could distinguish continuation vs sub-item based on product type
  return 'subItem';
}

/**
 * Calculates indent level from row type for EstimateRow format
 * @param rowType - GridRowType
 * @returns Indent level
 */
function calculateIndent(rowType: GridRowType): number {
  switch (rowType) {
    case 'main':
      return 0;
    case 'subItem':
    case 'continuation':
      return 1;
    default:
      return 0;
  }
}
