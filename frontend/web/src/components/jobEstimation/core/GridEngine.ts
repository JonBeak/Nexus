// Main orchestrator - single source of truth for grid state

import { GridRowCore, ProductTypeConfig } from './types/CoreTypes';
import { GridRow } from './types/LayerTypes';
import { GridState, CalculationContext, UpdateOptions, DisplayContext, InteractionContext } from './types/GridTypes';

// Layer operations
import { createCoreDataOperations, CoreDataOperations } from './layers/CoreDataLayer';
import { createRelationshipOperations, RelationshipOperations } from './layers/RelationshipLayer';
import { createDisplayOperations, DisplayOperations } from './layers/DisplayLayer';
import { createInteractionOperations, InteractionOperations } from './layers/InteractionLayer';

export interface GridEngineConfig {
  productTypes: ProductTypeConfig[];
  staticDataCache?: Record<string, any[]>;  // Database options (materials, colors, etc.)
  autoSave?: {
    enabled: boolean;
    debounceMs: number;
    onSave: (rows: GridRowCore[]) => Promise<void>;
  };
  callbacks?: {
    onRowsChange?: (rows: GridRow[]) => void;
    onStateChange?: (state: GridState) => void;
  };
  permissions?: {
    canEdit: boolean;
    canDelete: boolean;
    userRole: string;
  };
}

export class GridEngine {
  // Private state
  private coreData: GridRowCore[] = [];
  private calculatedRows: GridRow[] = [];
  private state: GridState;
  private config: GridEngineConfig;

  // Layer operations
  private coreOps: CoreDataOperations;
  private relationshipOps: RelationshipOperations;
  private displayOps: DisplayOperations;
  private interactionOps: InteractionOperations;

  constructor(config: GridEngineConfig) {
    this.config = config;
    this.state = this.createInitialState();

    // Initialize operation modules
    this.coreOps = createCoreDataOperations();
    this.relationshipOps = createRelationshipOperations();
    this.displayOps = createDisplayOperations();
    this.interactionOps = createInteractionOperations();
  }

  /**
   * Single entry point for all data mutations
   * @param newCoreData - New core data to apply
   * @param options - Calculation options
   */
  updateCoreData(newCoreData: GridRowCore[], options?: UpdateOptions): void {
    // Store new core data
    this.coreData = [...newCoreData];

    // Recalculate all layers
    this.recalculateAllLayers(options);

    // Update state
    this.state.hasUnsavedChanges = options?.markAsDirty !== false;

    // Notify subscribers
    this.notifyStateChange();
  }

  /**
   * Optimized partial update for single row changes
   * @param rowId - ID of changed row
   * @param fieldUpdates - Field changes
   */
  updateSingleRow(rowId: string, fieldUpdates: Record<string, string>): void {
    // Find and update core data
    const coreIndex = this.coreData.findIndex(row => row.id === rowId);
    if (coreIndex === -1) throw new Error(`Row not found: ${rowId}`);

    // Apply updates immutably
    const updatedRow = this.coreOps.mergeFieldUpdates(
      this.coreData[coreIndex],
      fieldUpdates
    );

    const newCoreData = [...this.coreData];
    newCoreData[coreIndex] = updatedRow;

    // Use full recalculation for now - optimization can come later
    this.updateCoreData(newCoreData);
  }

  /**
   * Updates product type for a specific row
   * @param rowId - ID of row to update
   * @param productTypeId - New product type ID
   * @param productTypeName - New product type name
   */
  updateRowProductType(rowId: string, productTypeId: number, productTypeName: string): void {
    // Find and update core data
    const coreIndex = this.coreData.findIndex(row => row.id === rowId);
    if (coreIndex === -1) throw new Error(`Row not found: ${rowId}`);

    // Determine the appropriate rowType based on product category
    const productType = this.config.productTypes.find(pt => pt.id === productTypeId);
    let newRowType = this.coreData[coreIndex].rowType; // Default: keep existing rowType
    let parentProductId = this.coreData[coreIndex].parentProductId; // Default: keep existing parent

    if (productType) {
      if (productType.category === 'sub_item') {
        newRowType = 'subItem';
        // For sub-items, find the nearest main row as parent if not already set
        if (!parentProductId) {
          for (let i = coreIndex - 1; i >= 0; i--) {
            if (this.coreData[i].rowType === 'main') {
              parentProductId = this.coreData[i].id;
              break;
            }
          }
        }
      } else if (productType.category === 'continuation') {
        newRowType = 'continuation';
        // For continuations, find the nearest main row as parent if not already set
        if (!parentProductId) {
          for (let i = coreIndex - 1; i >= 0; i--) {
            if (this.coreData[i].rowType === 'main') {
              parentProductId = this.coreData[i].id;
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
      ...this.coreData[coreIndex],
      productTypeId,
      productTypeName,
      rowType: newRowType,
      parentProductId,
      // Clear data when product type changes as fields may be different
      data: {}
    };

    const newCoreData = [...this.coreData];
    newCoreData[coreIndex] = updatedRow;

    // Use full recalculation for now - optimization can come later
    this.updateCoreData(newCoreData);
  }

  /**
   * Adds a new row at specified position
   * @param afterIndex - Insert after this index (-1 for beginning)
   * @param rowType - Type of row to create
   * @param parentProductId - Parent for sub-items/continuations
   */
  insertRow(afterIndex: number, rowType: 'main' | 'continuation' | 'subItem' = 'main', parentProductId?: string): void {
    // Determine parent for continuation/subItem rows if not explicitly provided
    let effectiveParentId = parentProductId;
    
    if (!effectiveParentId && (rowType === 'continuation' || rowType === 'subItem') && afterIndex >= 0) {
      // Find the main row that this child should belong to
      const targetRow = this.coreData[afterIndex];
      if (targetRow) {
        if (targetRow.rowType === 'main') {
          // Inserting after a main row - this main row is the parent
          effectiveParentId = targetRow.id;
        } else {
          // Inserting after a child row - find its parent main row
          for (let i = afterIndex; i >= 0; i--) {
            if (this.coreData[i].rowType === 'main') {
              effectiveParentId = this.coreData[i].id;
              break;
            }
          }
        }
      }
    }
    
    const newRow = this.coreOps.createEmptyRow(rowType, this.coreData, effectiveParentId);
    const newCoreData = [...this.coreData];
    
    // Calculate correct insertion position based on row type
    let insertIndex = afterIndex + 1;
    
    if (rowType === 'main' && afterIndex >= 0) {
      const targetRow = this.coreData[afterIndex];
      
      // If inserting after a main row, check if it has children
      if (targetRow && targetRow.rowType === 'main') {
        const calculatedRow = this.calculatedRows.find(r => r.id === targetRow.id);
        if (calculatedRow && calculatedRow.childIds.length > 0) {
          // Find the last child in the core data array
          const lastChildId = calculatedRow.childIds[calculatedRow.childIds.length - 1];
          const lastChildIndex = this.coreData.findIndex(row => row.id === lastChildId);
          if (lastChildIndex !== -1) {
            insertIndex = lastChildIndex + 1; // Insert after the last child
          }
        }
      }
    } else if (rowType === 'continuation' || rowType === 'subItem') {
      // For child rows, maintain family grouping by inserting at the end of the family
      if (afterIndex >= 0 && effectiveParentId) {
        // Find the last child of the same parent family
        const parentMainRow = this.calculatedRows.find(r => r.id === effectiveParentId);
        if (parentMainRow && parentMainRow.childIds.length > 0) {
          // Insert at the end of the existing family
          const lastChildId = parentMainRow.childIds[parentMainRow.childIds.length - 1];
          const lastChildIndex = this.coreData.findIndex(row => row.id === lastChildId);
          if (lastChildIndex !== -1) {
            insertIndex = lastChildIndex + 1;
          }
        } else {
          // First child of this main row - insert immediately after the main row
          const mainRowIndex = this.coreData.findIndex(row => row.id === effectiveParentId);
          if (mainRowIndex !== -1) {
            insertIndex = mainRowIndex + 1;
          }
        }
      }
    }
    
    newCoreData.splice(insertIndex, 0, newRow);
    this.updateCoreData(newCoreData);
  }

  /**
   * Removes a row and its children
   * @param rowId - ID of row to remove
   */
  deleteRow(rowId: string): void {
    const rowIndex = this.coreData.findIndex(row => row.id === rowId);
    if (rowIndex === -1) return;

    const targetRow = this.coreData[rowIndex];
    const idsToRemove = new Set([rowId]);

    // If deleting a main row, also delete its children
    if (targetRow.rowType === 'main') {
      const calculatedRow = this.calculatedRows.find(r => r.id === rowId);
      if (calculatedRow) {
        calculatedRow.childIds.forEach(childId => idsToRemove.add(childId));
      }
    }

    // Remove all specified rows
    const newCoreData = this.coreData.filter(row => !idsToRemove.has(row.id));
    this.updateCoreData(newCoreData);
  }

  /**
   * Duplicates a row and its children
   * @param rowId - ID of row to duplicate
   */
  duplicateRow(rowId: string): void {
    const rowIndex = this.coreData.findIndex(row => row.id === rowId);
    if (rowIndex === -1) return;

    const sourceRow = this.coreData[rowIndex];
    const newRow = this.coreOps.cloneRow(sourceRow, this.coreData);

    // For main rows, also duplicate children
    const rowsToDuplicate = [newRow];
    
    if (sourceRow.rowType === 'main') {
      const calculatedRow = this.calculatedRows.find(r => r.id === rowId);
      if (calculatedRow) {
        for (const childId of calculatedRow.childIds) {
          const childRow = this.coreData.find(r => r.id === childId);
          if (childRow) {
            const duplicatedChild = this.coreOps.cloneRow(childRow, this.coreData);
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
      const calculatedRow = this.calculatedRows.find(r => r.id === rowId);
      if (calculatedRow && calculatedRow.childIds.length > 0) {
        // Find the last child in the core data array
        const lastChildId = calculatedRow.childIds[calculatedRow.childIds.length - 1];
        const lastChildIndex = this.coreData.findIndex(row => row.id === lastChildId);
        if (lastChildIndex !== -1) {
          insertIndex = lastChildIndex + 1; // After the last child
        }
      }
    }

    // Insert all duplicated rows after the original family
    const newCoreData = [...this.coreData];
    newCoreData.splice(insertIndex, 0, ...rowsToDuplicate);

    this.updateCoreData(newCoreData);
  }

  /**
   * Moves rows (drag and drop)
   * @param draggedRowIds - IDs of rows being moved
   * @param targetRowId - ID of target row
   * @param position - Where to drop relative to target
   */
  moveRows(draggedRowIds: string[], targetRowId: string, position: 'above' | 'below'): void {
    // Extract dragged rows
    const draggedRows: GridRowCore[] = [];
    const remainingRows: GridRowCore[] = [];

    for (const row of this.coreData) {
      if (draggedRowIds.includes(row.id)) {
        draggedRows.push(row);
      } else {
        remainingRows.push(row);
      }
    }

    // Find target position
    const targetIndex = remainingRows.findIndex(row => row.id === targetRowId);
    if (targetIndex === -1) return; // Target not found

    // Calculate intended insertion point
    let insertIndex = position === 'above' ? targetIndex : targetIndex + 1;
    
    // Auto-correct invalid drop positions to nearest valid location
    insertIndex = this.findValidDropPosition(insertIndex, remainingRows);

    // Insert dragged rows at corrected position
    const newCoreData = [...remainingRows];
    newCoreData.splice(insertIndex, 0, ...draggedRows);

    this.updateCoreData(newCoreData);
  }

  /**
   * Finds the nearest valid drop position that won't break family relationships
   * @param intendedIndex - The originally intended insertion point
   * @param targetRows - The rows without the dragged items
   * @returns Corrected insertion index that respects family boundaries
   */
  private findValidDropPosition(intendedIndex: number, targetRows: GridRowCore[]): number {
    // If intended position is at start or end, it's always valid
    if (intendedIndex <= 0 || intendedIndex >= targetRows.length) {
      return intendedIndex;
    }

    const beforeRow = targetRows[intendedIndex - 1];
    const afterRow = targetRows[intendedIndex];

    // Check if we're trying to drop between a main row and its continuation rows
    if (this.wouldBreakFamily(beforeRow, afterRow)) {
      // Auto-correct: Find the end of the family and insert there
      return this.findFamilyEnd(beforeRow, targetRows) + 1;
    }

    return intendedIndex; // Position is valid as-is
  }

  /**
   * Checks if inserting between two rows would break a main-continuation family
   * @param beforeRow - Row before the insertion point
   * @param afterRow - Row after the insertion point
   * @returns true if this would break a family, false if it's safe
   */
  private wouldBreakFamily(beforeRow: GridRowCore, afterRow: GridRowCore): boolean {
    // Case 1: Main row followed by its continuation row
    if (beforeRow.rowType === 'main' && afterRow.rowType === 'continuation') {
      // Check if the continuation row belongs to the main row
      const afterParent = this.findParentMainRowByPosition(afterRow);
      if (afterParent && afterParent.id === beforeRow.id) {
        return true; // Would split main from its continuation
      }
    }

    // Case 2: Continuation row followed by another continuation of the same family
    if (beforeRow.rowType === 'continuation' && afterRow.rowType === 'continuation') {
      const beforeParent = this.findParentMainRowByPosition(beforeRow);
      const afterParent = this.findParentMainRowByPosition(afterRow);
      if (beforeParent && afterParent && beforeParent.id === afterParent.id) {
        return true; // Would split continuation rows of same family
      }
    }

    return false; // Safe to insert here
  }

  /**
   * Finds the end index of a family (main row + all its continuation rows)
   * @param mainRow - The main row to find the family end for
   * @param rows - Array of rows to search in
   * @returns Index of the last row in the family
   */
  private findFamilyEnd(mainRow: GridRowCore, rows: GridRowCore[]): number {
    const mainIndex = rows.indexOf(mainRow);
    if (mainIndex === -1) return -1;

    // Look forward to find the last continuation row of this family
    let lastFamilyIndex = mainIndex;
    for (let i = mainIndex + 1; i < rows.length; i++) {
      const currentRow = rows[i];
      
      // Stop if we hit another main row
      if (currentRow.rowType === 'main') break;
      
      // If it's a continuation, check if it belongs to our main row
      if (currentRow.rowType === 'continuation') {
        const parent = this.findParentMainRowByPosition(currentRow);
        if (parent && parent.id === mainRow.id) {
          lastFamilyIndex = i; // This continuation belongs to our main row
        } else {
          break; // This continuation belongs to a different main row
        }
      } else {
        // Sub-items don't block family boundaries, continue searching
        // but don't update lastFamilyIndex unless it's a continuation
      }
    }

    return lastFamilyIndex;
  }

  /**
   * Helper method to find the parent main row for a child row using position-based logic
   * @param childRow - Child row to find parent for
   * @returns Parent main row or undefined
   */
  private findParentMainRowByPosition(childRow: GridRowCore): GridRowCore | undefined {
    const childIndex = this.coreData.indexOf(childRow);
    if (childIndex === -1) return undefined;

    // Look backwards to find the main row
    for (let i = childIndex - 1; i >= 0; i--) {
      if (this.coreData[i].rowType === 'main') {
        return this.coreData[i];
      }
    }
    return undefined;
  }

  /**
   * Gets current calculated rows
   */
  getRows(): GridRow[] {
    return [...this.calculatedRows];
  }

  /**
   * Gets current grid state
   */
  getState(): GridState {
    return { ...this.state };
  }

  /**
   * Gets core data for persistence
   */
  getCoreData(): GridRowCore[] {
    return [...this.coreData];
  }

  /**
   * Gets core operations for components to use
   */
  getCoreOperations(): CoreDataOperations {
    return this.coreOps;
  }

  /**
   * Gets configuration for components to use
   */
  getConfig(): GridEngineConfig {
    return this.config;
  }

  /**
   * Updates configuration after initialization
   */
  updateConfig(updates: Partial<GridEngineConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };

    // If product types changed, recalculate all layers
    if (updates.productTypes) {
      this.recalculateAllLayers({ forceRecalculation: true });
      this.notifyStateChange();
    }
  }

  /**
   * Updates drag state
   */
  updateDragState(dragState: Partial<GridState['dragState']>): void {
    this.state.dragState = {
      ...this.state.dragState,
      ...dragState
    };

    this.notifyStateChange();
  }

  /**
   * Updates edit mode
   */
  setEditMode(editMode: 'normal' | 'bulk_edit' | 'readonly'): void {
    this.state.editMode = editMode;
    
    // Recalculate interaction layer when edit mode changes
    this.recalculateAllLayers({ forceRecalculation: true });
    
    this.notifyStateChange();
  }

  /**
   * Marks data as saved
   */
  markAsSaved(): void {
    this.state.hasUnsavedChanges = false;
    this.state.lastSaved = new Date();
    this.state.isAutoSaving = false;
    
    this.notifyStateChange();
  }

  // Private helper methods
  private createInitialState(): GridState {
    return {
      rows: [],
      selectedRowIds: new Set(),
      hasUnsavedChanges: false,
      lastSaved: null,
      isAutoSaving: false,
      dragState: {
        activeId: null,
        overId: null,
        dropPosition: null,
        isDragDisabled: false,
        showDropLine: false
      },
      editMode: 'normal'
    };
  }

  /**
   * Recalculates all derived data layers
   * @param options - Calculation options
   */
  private recalculateAllLayers(options: UpdateOptions = {}): void {
    const context: CalculationContext = {
      productTypes: this.config.productTypes,
      currentRows: this.coreData,
      previousRows: this.calculatedRows,
      forceRecalculation: options.forceRecalculation
    };

    // Layer 1: Calculate relationships
    const withRelationships = this.relationshipOps.calculateRelationships(this.coreData);

    // Layer 2: Calculate display properties
    const displayContext: DisplayContext = {
      productTypes: this.config.productTypes,
      staticDataCache: this.config.staticDataCache
    };
    const withDisplay = this.displayOps.calculateDisplay(withRelationships, displayContext);

    // Layer 3: Calculate interaction properties
    const interactionContext: InteractionContext = {
      isReadOnly: this.state.editMode === 'readonly',
      editMode: this.state.editMode,
      currentUserId: 0, // Will be provided by parent component when needed
      userPermissions: [], // Will be provided by parent component when needed
      dragState: this.state.dragState
    };
    const withInteraction = this.interactionOps.calculateInteraction(withDisplay, interactionContext);

    // Add metadata to each row
    this.calculatedRows = withInteraction.map(row => ({
      ...row,
      metadata: {
        lastModified: new Date(),
        isDirty: options.markAsDirty !== false
      }
    }));

    // Update state
    this.state.rows = this.calculatedRows;
  }

  private notifyStateChange(): void {
    this.config.callbacks?.onRowsChange?.(this.calculatedRows);
    this.config.callbacks?.onStateChange?.(this.state);
  }
}