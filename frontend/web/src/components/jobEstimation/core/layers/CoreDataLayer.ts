// Layer 0: Core data transformations

import { GridRowCore, GridRowType, ProductTypeConfig, DynamicField, IdGenerator } from '../types/CoreTypes';

export interface CoreDataOperations {
  /**
   * Creates a new empty row with proper defaults
   * @param rowType - Semantic row type (main, continuation, subItem)
   * @param existingRows - Current grid rows for ID generation
   * @param parentProductId - Optional parent product ID for sub-items/continuations
   */
  createEmptyRow: (
    rowType: GridRowType,
    existingRows: GridRowCore[],
    parentProductId?: string
  ) => GridRowCore;

  /**
   * Normalizes field data to consistent string format
   * @param data - Raw field data object
   * @returns Normalized field data with string values
   */
  normalizeFieldData: (data: Record<string, any>) => Record<string, string>;

  /**
   * Clones a row with new ID for duplication
   * @param sourceRow - Row to clone
   * @param existingRows - Current rows for ID generation
   */
  cloneRow: (sourceRow: GridRowCore, existingRows: GridRowCore[]) => GridRowCore;

  /**
   * Merges field data updates into existing row
   * @param row - Target row
   * @param fieldUpdates - Field changes to apply
   * @returns New row with merged data (immutable)
   */
  mergeFieldUpdates: (
    row: GridRowCore,
    fieldUpdates: Record<string, string>
  ) => GridRowCore;

  /**
   * Extracts product type configuration for row
   * @param row - Target row
   * @param productTypes - Available product configurations
   * @returns Field configuration array or null
   */
  extractProductConfig: (
    row: GridRowCore,
    productTypes: ProductTypeConfig[]
  ) => DynamicField[][] | null;

  /**
   * Generates stable sort key for row ordering
   * @param row - Row to generate key for
   * @param index - Current array index
   * @returns Stable sort key string
   */
  generateSortKey: (row: GridRowCore, index: number) => string;
}

// Implementation
export const createCoreDataOperations = (): CoreDataOperations => {
  const idGenerator: IdGenerator = {
    generateTempId: () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    generateStableId: (existingIds: string[]) => {
      let counter = 1;
      while (existingIds.includes(`row-${counter}`)) {
        counter++;
      }
      return `row-${counter}`;
    }
  };

  return {
    createEmptyRow: (rowType, existingRows, parentProductId) => {
      const tempId = idGenerator.generateTempId();
      return {
        id: tempId,
        rowType,
        productTypeId: 27, // "Empty Row" product type
        productTypeName: 'Empty Row',
        data: {},
        parentProductId
      };
    },

    normalizeFieldData: (data) => {
      const normalized: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) {
          normalized[key] = '';
        } else {
          normalized[key] = String(value);
        }
      }
      
      return normalized;
    },

    cloneRow: (sourceRow) => {
      const newId = idGenerator.generateTempId();
      
      return {
        ...sourceRow,
        id: newId,
        dbId: undefined, // Clear database ID - this is a new row
        data: { ...sourceRow.data }, // Deep copy data
        // Keep same rowType and parentProductId for proper relationships
      };
    },

    mergeFieldUpdates: (row, fieldUpdates) => {
      return {
        ...row,
        data: {
          ...row.data,
          ...fieldUpdates
        }
      };
    },

    extractProductConfig: (row, productTypes) => {
      if (!row.productTypeId) return null;
      
      const productType = productTypes.find(pt => pt.id === row.productTypeId);
      return productType?.fields || null;
    },

    generateSortKey: (row, index) => {
      // Generate stable key for sorting that doesn't change with minor updates
      const typeOrder = { main: 0, continuation: 1, subItem: 2 };
      const typeValue = typeOrder[row.rowType] || 999;
      
      return `${String(index).padStart(6, '0')}-${typeValue}-${row.id}`;
    }
  };
};

// Helper functions for common data operations
export const dataHelpers = {
  /**
   * Checks if a row has any meaningful data
   */
  hasData: (row: GridRowCore): boolean => {
    return row.productTypeId !== undefined && row.productTypeId !== 27 || // Not empty row
           Object.values(row.data).some(value => value && String(value).trim() !== '');
  },

  /**
   * Creates a deep copy of row data
   */
  deepCopyData: (data: Record<string, string>): Record<string, string> => {
    return JSON.parse(JSON.stringify(data));
  },

  /**
   * Compares two rows for data equality
   */
  isDataEqual: (row1: GridRowCore, row2: GridRowCore): boolean => {
    if (row1.productTypeId !== row2.productTypeId) return false;
    if (row1.rowType !== row2.rowType) return false;
    if (row1.parentProductId !== row2.parentProductId) return false;
    
    const keys1 = Object.keys(row1.data).sort();
    const keys2 = Object.keys(row2.data).sort();
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (row1.data[key] !== row2.data[key]) return false;
    }
    
    return true;
  }
};
