// Row CRUD operations and field updates
// Extracted from GridEngine.ts for better maintainability

import { GridRowCore, ProductTypeConfig } from '../types/CoreTypes';
import { GridRow } from '../types/LayerTypes';
import { CoreDataOperations } from '../layers/CoreDataLayer';

export interface RowOperationsConfig {
  productTypes: ProductTypeConfig[];
  coreOps: CoreDataOperations;
}

export class RowOperations {
  constructor(private config: RowOperationsConfig) {}

  /**
   * Optimized update for single row field changes (no recalculation needed)
   * @param rowId - ID of changed row
   * @param fieldUpdates - Field changes
   * @param coreData - Current core data array
   * @param calculatedRows - Current calculated rows array
   * @returns Updated core data and calculated rows
   */
  updateSingleRowField(
    rowId: string,
    fieldUpdates: Record<string, string>,
    coreData: GridRowCore[],
    calculatedRows: GridRow[]
  ): { coreData: GridRowCore[]; calculatedRows: GridRow[] } {
    // Find and update core data
    const coreIndex = coreData.findIndex(row => row.id === rowId);
    if (coreIndex === -1) throw new Error(`Row not found: ${rowId}`);

    // Apply updates immutably
    const updatedRow = this.config.coreOps.mergeFieldUpdates(
      coreData[coreIndex],
      fieldUpdates
    );

    const newCoreData = [...coreData];
    newCoreData[coreIndex] = updatedRow;

    // OPTIMIZATION: Field value changes don't affect relationships, display, or interactions
    // Just update the core data and mark as dirty - no expensive recalculations
    const newCalculatedRows = [...calculatedRows];

    // Update the field data in the existing calculated row
    const calculatedIndex = newCalculatedRows.findIndex(row => row.id === rowId);
    if (calculatedIndex !== -1) {
      newCalculatedRows[calculatedIndex] = {
        ...newCalculatedRows[calculatedIndex],
        data: updatedRow.data,
        metadata: {
          ...newCalculatedRows[calculatedIndex].metadata,
          lastModified: new Date(),
          isDirty: true
        }
      };
    }

    return { coreData: newCoreData, calculatedRows: newCalculatedRows };
  }

  /**
   * Updates product type for a specific row
   * @param rowId - ID of row to update
   * @param productTypeId - New product type ID
   * @param productTypeName - New product type name
   * @param coreData - Current core data array
   * @returns Updated core data (requires full recalculation)
   */
  updateRowProductType(
    rowId: string,
    productTypeId: number,
    productTypeName: string,
    coreData: GridRowCore[]
  ): GridRowCore[] {
    // Find and update core data
    const coreIndex = coreData.findIndex(row => row.id === rowId);
    if (coreIndex === -1) throw new Error(`Row not found: ${rowId}`);

    // Determine the appropriate rowType based on product category
    const productType = this.config.productTypes.find(pt => pt.id === productTypeId);
    let newRowType = coreData[coreIndex].rowType; // Default: keep existing rowType
    let parentProductId = coreData[coreIndex].parentProductId; // Default: keep existing parent

    if (productType) {
      if (productType.category === 'sub_item') {
        newRowType = 'subItem';

        // For sub-items, find the nearest main row as parent if not already set
        if (!parentProductId) {
          for (let i = coreIndex - 1; i >= 0; i--) {
            if (coreData[i].rowType === 'main') {
              parentProductId = coreData[i].id;
              break;
            }
          }
        }
      } else if (productType.category === 'continuation') {
        newRowType = 'continuation';
        // For continuations, find the nearest main row as parent if not already set
        if (!parentProductId) {
          for (let i = coreIndex - 1; i >= 0; i--) {
            if (coreData[i].rowType === 'main') {
              parentProductId = coreData[i].id;
              break;
            }
          }
        }
      } else {
        // For main products or other categories
        newRowType = 'main';
        parentProductId = undefined; // Main rows have no parent
      }
    }

    // Apply updates immutably
    const updatedRow = {
      ...coreData[coreIndex],
      productTypeId,
      productTypeName,
      rowType: newRowType,
      parentProductId,
      // Preserve existing field data when product type changes, only set default quantity if missing
      data: {
        ...coreData[coreIndex].data,  // Keep all existing field data
        quantity: coreData[coreIndex].data?.quantity || '1'  // Only set default if empty
      }
    };

    const newCoreData = [...coreData];
    newCoreData[coreIndex] = updatedRow;

    return newCoreData;
  }

  /**
   * Adds a new row at specified position
   * @param afterIndex - Insert after this index (-1 for beginning)
   * @param rowType - Type of row to create
   * @param parentProductId - Parent for sub-items/continuations
   * @param coreData - Current core data array
   * @param calculatedRows - Current calculated rows for family positioning
   * @returns Updated core data
   */
  insertRow(
    afterIndex: number,
    rowType: 'main' | 'continuation' | 'subItem' = 'main',
    parentProductId: string | undefined,
    coreData: GridRowCore[],
    calculatedRows: GridRow[]
  ): GridRowCore[] {
    // Determine parent for continuation/subItem rows if not explicitly provided
    let effectiveParentId = parentProductId;

    if (!effectiveParentId && (rowType === 'continuation' || rowType === 'subItem') && afterIndex >= 0) {
      // Find the main row that this child should belong to
      const targetRow = coreData[afterIndex];
      if (targetRow) {
        if (targetRow.rowType === 'main') {
          // Inserting after a main row - this main row is the parent
          effectiveParentId = targetRow.id;
        } else {
          // Inserting after a child row - find its parent main row
          for (let i = afterIndex; i >= 0; i--) {
            if (coreData[i].rowType === 'main') {
              effectiveParentId = coreData[i].id;
              break;
            }
          }
        }
      }
    }

    const newRow = this.config.coreOps.createEmptyRow(rowType, coreData, effectiveParentId);
    const newCoreData = [...coreData];

    // Calculate correct insertion position based on row type
    let insertIndex = afterIndex + 1;

    if (rowType === 'main' && afterIndex >= 0) {
      const targetRow = coreData[afterIndex];

      // If inserting after a main row, check if it has children
      if (targetRow && targetRow.rowType === 'main') {
        const calculatedRow = calculatedRows.find(r => r.id === targetRow.id);
        if (calculatedRow && calculatedRow.childIds.length > 0) {
          // Find the last child in the core data array
          const lastChildId = calculatedRow.childIds[calculatedRow.childIds.length - 1];
          const lastChildIndex = coreData.findIndex(row => row.id === lastChildId);
          if (lastChildIndex !== -1) {
            insertIndex = lastChildIndex + 1; // Insert after the last child
          }
        }
      }
    } else if (rowType === 'continuation' || rowType === 'subItem') {
      // For child rows, maintain family grouping by inserting at the end of the family
      if (afterIndex >= 0 && effectiveParentId) {
        // Find the last child of the same parent family
        const parentMainRow = calculatedRows.find(r => r.id === effectiveParentId);
        if (parentMainRow && parentMainRow.childIds.length > 0) {
          // Insert at the end of the existing family
          const lastChildId = parentMainRow.childIds[parentMainRow.childIds.length - 1];
          const lastChildIndex = coreData.findIndex(row => row.id === lastChildId);
          if (lastChildIndex !== -1) {
            insertIndex = lastChildIndex + 1;
          }
        } else {
          // First child of this main row - insert immediately after the main row
          const mainRowIndex = coreData.findIndex(row => row.id === effectiveParentId);
          if (mainRowIndex !== -1) {
            insertIndex = mainRowIndex + 1;
          }
        }
      }
    }

    newCoreData.splice(insertIndex, 0, newRow);
    return newCoreData;
  }

  /**
   * Removes a row and its children
   * @param rowId - ID of row to remove
   * @param coreData - Current core data array
   * @param calculatedRows - Current calculated rows for finding children
   * @returns Updated core data
   */
  deleteRow(
    rowId: string,
    coreData: GridRowCore[],
    calculatedRows: GridRow[]
  ): GridRowCore[] {
    const rowIndex = coreData.findIndex(row => row.id === rowId);
    if (rowIndex === -1) return coreData;

    const targetRow = coreData[rowIndex];
    const idsToRemove = new Set([rowId]);

    // If deleting a main row, also delete its children
    if (targetRow.rowType === 'main') {
      const calculatedRow = calculatedRows.find(r => r.id === rowId);
      if (calculatedRow) {
        calculatedRow.childIds.forEach(childId => idsToRemove.add(childId));
      }
    }

    // Remove all specified rows
    return coreData.filter(row => !idsToRemove.has(row.id));
  }

  /**
   * Duplicates a row and its children
   * @param rowId - ID of row to duplicate
   * @param coreData - Current core data array
   * @param calculatedRows - Current calculated rows for finding children
   * @returns Updated core data
   */
  duplicateRow(
    rowId: string,
    coreData: GridRowCore[],
    calculatedRows: GridRow[]
  ): GridRowCore[] {
    const rowIndex = coreData.findIndex(row => row.id === rowId);
    if (rowIndex === -1) return coreData;

    const sourceRow = coreData[rowIndex];
    const newRow = this.config.coreOps.cloneRow(sourceRow);

    // For main rows, also duplicate children
    const rowsToDuplicate = [newRow];

    if (sourceRow.rowType === 'main') {
      const calculatedRow = calculatedRows.find(r => r.id === rowId);
      if (calculatedRow) {
        for (const childId of calculatedRow.childIds) {
          const childRow = coreData.find(r => r.id === childId);
          if (childRow) {
            const duplicatedChild = this.config.coreOps.cloneRow(childRow);
            // Update parent reference to new main row
            duplicatedChild.parentProductId = newRow.id;
            rowsToDuplicate.push(duplicatedChild);
          }
        }
      }
    }

    // Find the insertion point - after the last child of the original family
    let insertIndex = rowIndex + 1; // Default: after the main row

    if (sourceRow.rowType === 'main') {
      const calculatedRow = calculatedRows.find(r => r.id === rowId);
      if (calculatedRow && calculatedRow.childIds.length > 0) {
        // Find the last child in the core data array
        const lastChildId = calculatedRow.childIds[calculatedRow.childIds.length - 1];
        const lastChildIndex = coreData.findIndex(row => row.id === lastChildId);
        if (lastChildIndex !== -1) {
          insertIndex = lastChildIndex + 1; // After the last child
        }
      }
    }

    // Insert all duplicated rows after the original family
    const newCoreData = [...coreData];
    newCoreData.splice(insertIndex, 0, ...rowsToDuplicate);

    return newCoreData;
  }
}
