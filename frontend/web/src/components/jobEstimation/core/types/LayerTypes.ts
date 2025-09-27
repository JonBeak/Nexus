// Extended interfaces for each calculation layer

import { GridRowCore, GridRowMetadata } from './CoreTypes';

export type CalculationStatus = 'pending' | 'not_configured' | 'error';

export interface RowCalculationResult {
  key?: string | null;
  status: CalculationStatus;
  display: string;
  data?: Record<string, unknown> | null;
  error?: string;
}

// Layer 1: Relationship calculations
export interface GridRowWithRelationships extends GridRowCore {
  // Parent/child structure
  parentId?: string;             // Calculated parent row ID
  childIds: string[];            // Calculated child row IDs

  // Hierarchy calculations
  logicalNumber?: number;        // Main: 1,2,3... | Sub: 1,2,3... within parent
  displayNumber: string;         // Main: "1" | Sub: "1.a" | Continuation: ""
  showRowNumber: boolean;        // true for main/sub-items, false for continuation
  nestingLevel: 'main' | 'sub';  // Only 2 levels!
  hierarchyPath: number[];       // [1] for main, [1,2] for sub-items
}

// Layer 2: Display calculations
export interface GridRowDisplay extends GridRowWithRelationships {
  // Essential display properties - no styling in base layer
  displayNumber: string;         // "1", "1.a", "1.b", etc.
  
  // Static field options from database
  staticFieldOptions: Record<string, string[]>;
}

// Layer 3: Calculation results
export interface GridRowWithCalculations extends GridRowDisplay {
  calculation?: RowCalculationResult;
}

// Layer 4: Interaction calculations
export interface GridRowInteractive extends GridRowWithCalculations {
  // Drag & drop properties (includes parent-child behavior)
  isDraggable: boolean;          // Can this row be physically dragged?
  isDropTarget: boolean;         // Can accept dropped rows?
  dropZone: 'above' | 'below' | 'both' | 'none'; // Drop positions
  
  // Parent-child drag behavior
  draggedRowIds: string[];       // All rows that move when this row is dragged
                                // Main row: [mainId, ...continuationIds, ...subItemIds]
                                // Sub-item: [subItemId]
                                // Continuation: [] (not draggable)

  // Edit interaction state
  editableFields: string[];      // Which fields can be edited
  requiredFields: string[];      // Which fields are required

  // Action availability  
  canDelete: boolean;            // Delete action available?
  canDuplicate: boolean;         // Duplicate action available?
  canAddRow: boolean;            // Add row button available?
}

// Final combined type
export interface GridRow extends GridRowInteractive {
  metadata: GridRowMetadata;
}
