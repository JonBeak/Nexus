// Layer 3: User interaction capabilities and constraints

import { GridRowDisplay, GridRowInteractive } from '../types/LayerTypes';
import { InteractionContext } from '../types/GridTypes';

export interface InteractionOperations {
  /**
   * Calculates interaction capabilities for all rows
   * @param displayRows - Rows with display properties
   * @param context - Interaction context
   * @returns Rows with interaction properties added
   */
  calculateInteraction: (
    displayRows: GridRowDisplay[],
    context: InteractionContext
  ) => GridRowInteractive[];

  /**
   * Determines drag and drop capabilities including parent-child behavior
   * @param row - Row to analyze
   * @param allRows - Complete grid state
   * @param context - Interaction context
   * @returns Drag capabilities
   */
  calculateDragCapabilities: (
    row: GridRowDisplay,
    allRows: GridRowDisplay[],
    context: InteractionContext
  ) => DragCapabilities;

  /**
   * Calculates valid drop zones
   * @param row - Row to calculate drop zone for
   * @param previousRow - Row above this one
   * @param nextRow - Row below this one
   * @returns Drop zone configuration
   */
  calculateDropZones: (
    row: GridRowDisplay,
    previousRow?: GridRowDisplay,
    nextRow?: GridRowDisplay
  ) => 'above' | 'below' | 'both' | 'none';

  /**
   * Determines which fields can be edited
   * @param row - Row to analyze
   * @param context - Interaction context
   * @returns Array of editable field names
   */
  calculateEditableFields: (
    row: GridRowDisplay,
    context: InteractionContext
  ) => string[];

  /**
   * Calculates available actions for row
   * @param row - Row to analyze
   * @param context - Interaction context
   * @returns Action availability flags
   */
  calculateRowActions: (
    row: GridRowDisplay,
    context: InteractionContext
  ) => RowActionFlags;
}

export interface DragCapabilities {
  isDraggable: boolean;
  isDropTarget: boolean;
  dropZone: 'above' | 'below' | 'both' | 'none';
  draggedRowIds: string[];
}

export interface RowActionFlags {
  canDelete: boolean;
  canDuplicate: boolean;
  canAddRow: boolean;  // Add row button availability
}

// Implementation
export const createInteractionOperations = (): InteractionOperations => {
  return {
    calculateInteraction: (displayRows, context) => {
      return displayRows.map(row => {
        const dragCapabilities = calculateDragCapabilities(row, displayRows, context);
        const editableFields = calculateEditableFields(row, context);
        const rowActions = calculateRowActions(row, context);
        
        // Get required fields from product configuration
        const requiredFields = getRequiredFields(row, context);
        
        // Calculate drop zones based on neighboring rows
        const rowIndex = displayRows.findIndex(r => r.id === row.id);
        const previousRow = rowIndex > 0 ? displayRows[rowIndex - 1] : undefined;
        const nextRow = rowIndex < displayRows.length - 1 ? displayRows[rowIndex + 1] : undefined;
        const dropZone = calculateDropZones(row, previousRow, nextRow);

        return {
          ...row,
          isDraggable: dragCapabilities.isDraggable,
          isDropTarget: dragCapabilities.isDropTarget,
          dropZone,
          draggedRowIds: dragCapabilities.draggedRowIds,
          editableFields,
          requiredFields,
          canDelete: rowActions.canDelete,
          canDuplicate: rowActions.canDuplicate
        };
      });
    },

    calculateDragCapabilities: (row, allRows, context) => {
      return calculateDragCapabilities(row, allRows, context);
    },

    calculateDropZones: (row, previousRow, nextRow) => {
      return calculateDropZones(row, previousRow, nextRow);
    },

    calculateEditableFields: (row, context) => {
      return calculateEditableFields(row, context);
    },

    calculateRowActions: (row, context) => {
      return calculateRowActions(row, context);
    }
  };

  // Helper function implementations
  function calculateDragCapabilities(
    row: GridRowDisplay,
    allRows: GridRowDisplay[],
    context: InteractionContext
  ): DragCapabilities {
    // Can't drag in readonly mode
    if (context.isReadOnly || context.editMode === 'readonly') {
      return {
        isDraggable: false,
        isDropTarget: false,
        dropZone: 'none',
        draggedRowIds: []
      };
    }

    // Continuation rows are never draggable - they move with their parent
    if (row.rowType === 'continuation') {
      return {
        isDraggable: false,
        isDropTarget: true, // Can be drop target for rearranging
        dropZone: 'both',
        draggedRowIds: []
      };
    }

    // Calculate which rows move together when this row is dragged
    const draggedRowIds: string[] = [];
    
    if (row.rowType === 'main') {
      // Main row drags itself + all children (continuations + sub-items)
      draggedRowIds.push(row.id);
      draggedRowIds.push(...row.childIds);
    } else if (row.rowType === 'subItem') {
      // Sub-item only drags itself
      draggedRowIds.push(row.id);
    }

    return {
      isDraggable: true,
      isDropTarget: true,
      dropZone: 'both',
      draggedRowIds
    };
  }

  function calculateDropZones(
    row: GridRowDisplay,
    previousRow?: GridRowDisplay,
    nextRow?: GridRowDisplay
  ): 'above' | 'below' | 'both' | 'none' {
    // Most rows can accept drops above and below
    return 'both';
    
    // Future: Add logic to prevent drops between main and continuation rows
    // For now, keep it simple in base layer
  }

  function calculateEditableFields(
    row: GridRowDisplay,
    context: InteractionContext
  ): string[] {
    // In readonly mode, no fields are editable
    if (context.isReadOnly || context.editMode === 'readonly') {
      return [];
    }

    // Get field names from static field options
    // All fields with options or data are potentially editable
    const allFieldNames = Object.keys(row.staticFieldOptions);
    
    // Also include fields that have data but no options (text fields, etc.)
    const dataFieldNames = Object.keys(row.data);
    
    // Combine and deduplicate
    const editableFields = [...new Set([...allFieldNames, ...dataFieldNames])];
    
    return editableFields;
  }

  function calculateRowActions(
    row: GridRowDisplay,
    context: InteractionContext
  ): RowActionFlags {
    // In readonly mode, no actions available
    if (context.isReadOnly || context.editMode === 'readonly') {
      return {
        canDelete: false,
        canDuplicate: false,
        canAddRow: false
      };
    }

    // Continuation rows cannot be individually deleted or duplicated
    // They are managed through their parent main row
    if (row.rowType === 'continuation') {
      return {
        canDelete: false,      // Deleted with parent
        canDuplicate: false,   // Duplicated with parent
        canAddRow: false       // No add row button on continuation rows
      };
    }

    // Main rows and sub-items can be deleted, duplicated, and have add row buttons
    return {
      canDelete: true,
      canDuplicate: true,
      canAddRow: true  // Add row button available on main and sub-item rows
    };
  }

  function getRequiredFields(
    row: GridRowDisplay,
    context: InteractionContext
  ): string[] {
    // For now, no required fields in base layer
    // Future: Extract from product configuration
    return [];
  }
};