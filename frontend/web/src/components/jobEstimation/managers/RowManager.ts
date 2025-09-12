import { EstimateRow, RowOperations } from '../types';
import { recalculateAssemblyReferences } from '../systems/UnifiedAssemblySystem';
import { createEmptyProductRow } from '../utils/rowUtils';
import { findProductGroupEnd, findProductGroupStart } from '../utils/groupUtils';
import { createBatchStateManager } from '../utils/batchStateManager';

export class RowManager implements RowOperations {
  constructor(
    private rows: EstimateRow[],
    private productTypes: any[],
    private onRowsChange: (rows: EstimateRow[]) => void,
    private onEstimateChange: () => void,
    private showNotification: (message: string, type?: 'success' | 'error') => void,
    private markFieldAsBlurred?: (rowId: string, fieldName: string) => void, // ✅ BLUR-ONLY
    private batchManager?: ReturnType<typeof createBatchStateManager> // ✅ PHASE 2B: Batch optimization
  ) {}

  handleProductTypeSelect = async (rowIndex: number, productTypeId: number): Promise<void> => {
    const productType = this.productTypes.find(pt => pt.id === productTypeId);
    if (!productType) return;

    const newRows = [...this.rows];
    const parentProductId = newRows[rowIndex].id;
    
    // Preserve any existing assembly group assignment
    const preservedAssemblyGroup = newRows[rowIndex].data?.assemblyGroup;
    
    // ✅ TEMPLATE-FIRST: Update product row without fieldConfig - backend will resolve fields
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      productTypeId,
      productTypeName: productType.name,
      isMainRow: true,
      data: preservedAssemblyGroup !== undefined ? { assemblyGroup: preservedAssemblyGroup } : {}
    };

    // ✅ SIMPLIFIED: Create single main product row
    // Backend template system will handle field resolution dynamically
    // No more continuation rows - template-first system handles multi-row layouts in GridRow component
    // No more automatic sub-item generation - sub-items are now regular products that users select manually

    // ✅ NEW: Recalculate assembly references after inserting new rows/sub-items
    const updatedRowsWithAssemblyRefs = recalculateAssemblyReferences(newRows);
    this.onRowsChange(updatedRowsWithAssemblyRefs);
    this.onEstimateChange();
  };

  handleFieldCommit = async (rowIndex: number, fieldName: string, value: any): Promise<void> => {
    const newRows = [...this.rows];
    const rowId = newRows[rowIndex].id;
    
    // Special handling for qty field - now stored in data.quantity
    if (fieldName === 'qty') {
      newRows[rowIndex].data.quantity = value;
    }
    // Special handling for text_content field
    else if (fieldName === 'text_content') {
      newRows[rowIndex].text_content = value;
    }
    // Regular field changes go into data
    else {
      newRows[rowIndex].data[fieldName] = value;
    }
    
    // ✅ PHASE 2B: Use batch manager for optimized updates (6-10 calls → 1-2 calls)
    if (this.batchManager) {
      await this.batchManager.batchFieldCommit(rowId, fieldName, newRows);
    } else {
      // Fallback to current sequential implementation
      if (this.markFieldAsBlurred) {
        this.markFieldAsBlurred(rowId, fieldName);
      }
      this.onRowsChange(newRows);
      this.onEstimateChange();
    }
  };

  handleInsertRow = (afterIndex: number): void => {
    const newRows = [...this.rows];
    
    // In uniform product system, always create a new empty product row
    const insertionIndex = findProductGroupEnd(afterIndex, this.rows);
    const newRow = createEmptyProductRow(0, newRows);
    
    newRows.splice(insertionIndex + 1, 0, newRow);
    this.onRowsChange(newRows);
    this.onEstimateChange();
  };

  handleDeleteRow = (rowIndex: number): void => {
    const rowToDelete = this.rows[rowIndex];
    
    // If it's a main row, delete the entire group
    if (rowToDelete.isMainRow) {
      const groupEnd = findProductGroupEnd(rowIndex, this.rows);
      const groupStart = rowToDelete.isMainRow ? rowIndex : rowIndex; // Already at start for assemblies
      
      if (!window.confirm(`Delete "${rowToDelete.data.name || rowToDelete.productTypeName || 'this item'}" and all related rows?`)) {
        return;
      }
      
      const newRows = [...this.rows];
      
      // Assembly logic temporarily disabled
      // TODO: Re-implement assembly groups later
      
      newRows.splice(groupStart, groupEnd - groupStart + 1);
      
      // ✅ NEW: Recalculate assembly references after deleting rows
      const updatedRowsWithAssemblyRefs = recalculateAssemblyReferences(newRows);
      this.onRowsChange(updatedRowsWithAssemblyRefs);
      this.onEstimateChange();
      this.showNotification('Item deleted');
    } 
    // Sub-items are now regular products - no special deletion logic needed
  };

  handleProductTypeReselect = (rowIndex: number): void => {
    if (!window.confirm('Change product type? This will remove all associated input rows and sub-items.')) {
      return;
    }

    const newRows = [...this.rows];
    const productRow = newRows[rowIndex];
    
    // Find the end of this product group
    const groupEnd = findProductGroupEnd(rowIndex, this.rows);
    
    // Remove all continuation rows and sub-items
    const rowsToRemove = groupEnd - rowIndex;
    if (rowsToRemove > 0) {
      newRows.splice(rowIndex + 1, rowsToRemove);
    }
    
    // Reset the main row back to empty product selection state, but preserve assembly group data
    const preservedAssemblyGroup = productRow.data?.assemblyGroup;
    const resetRow = {
      ...createEmptyProductRow(0, this.rows),
      id: productRow.id, // Keep the same ID
      data: preservedAssemblyGroup !== undefined ? { assemblyGroup: preservedAssemblyGroup } : {}
    };
    
    newRows[rowIndex] = resetRow;
    
    this.onRowsChange(newRows);
    this.onEstimateChange();
    this.showNotification('Product type reset - select a new type');
  };

  // handleSubItemCommit removed - sub-items are now regular products selected from dropdown


}