# 🏗️ Future Grid Base Architecture - Detailed Layer Specifications

## 🔗 Complete Chain Overview

This document covers the **Base Layer** of the comprehensive Grid architecture refactor. The complete chain includes:

### Current Document: Base Layer Foundation
- ✅ Core data structures (GridRowCore with string-only data storage)
- ✅ Parent-child relationship calculations  
- ✅ Display number generation (1, 1.a, 1.b)
- ✅ Essential drag validation (continuation rows stay with parent)
- ✅ Basic drop zone calculations and visual feedback
- ✅ Basic row operations (create, clone, merge)
- ✅ Static product configurations from database
- ✅ GridEngine orchestrator with minimal state

### Upcoming Chain Links
1. **Business Validation Layer** - Field type validation, business rules, error handling
   - Valid row orderings (products → sub-items). Sub-items must be under regular products and not under nothing nor under special items
   - Input type validation (numeric, required fields, etc.)
   - Product type compatibility checks
   - Error messages and tooltips
2. **Assembly Layer** - Dynamic assembly management, color assignments, grouping logic
   - Assembly assignment rules (depends on validation)
3. **Visual Styling Layer** - Conditional formatting, themes, visual feedback
4. **Calculations Layer** - Pricing, totals, material calculations
5. **Estimate Preview Layer** - Integration with EstimateTable and preview generation

Each layer builds upon this base architecture, maintaining the same principles of immutable transformations, pure functions, and layered separation of concerns.

---

## 📋 Implementation Status

**Active Replacement**: This architecture is being implemented to replace the existing broken grid system. See [REMOVED_COMPONENTS_LOG.md](./REMOVED_COMPONENTS_LOG.md) for details on what components are being replaced and why.

**Implementation Date**: 2025-09-12  
**Strategy**: Direct replacement with backward compatibility adapters

---
Philosophy for this base layer:
  Base Layer = "Essential Structure + Static Data"

  Keep:
  - Core data structures (what fields exist, their values)
  - Static database-driven options (materials, colors from DB)
  - Basic field states that are inherent to the data (value, placeholder/prompt, disabled state)
  - Essential calculations needed for structure (display numbers, relationships)
  - Product configurations (what fields each product type has)
  - Semantic row types (main, continuation, subItem)
  - Direct parent relationships (parentProductId)
  - Essential drag validation (continuation rows stay with parent)
  - Basic drop zone calculations and visual feedback

  Remove:
  - Input type validation (numeric, email, etc.) - strings only in base
  - Business rule validation and error messages
  - Assembly-specific logic and colors
  - Visual styling and formatting beyond basic drag feedback
  - Complex state management
  - ValidationManager class (business validation moved to validation layer)
  - Error tooltips and complex visual feedback

  The philosophy: "The base layer describes WHAT exists and its basic properties, but not
   HOW it behaves or HOW it looks. Relationships are explicit and semantic, not inferred from positioning."

---

🏗️ Detailed Layer Architecture Specifications

Phase 1: Core Layer Files

/core/types/CoreTypes.ts

// Base data structures - foundation of the layered system

export type GridRowType = 'main' | 'continuation' | 'subItem';

export interface GridRowCore {
  // Essential identity
  id: string;
  dbId?: number;

  // Product configuration
  productTypeId?: number;
  productTypeName?: string;

  // Raw field data
  data: Record<string, string>;

  rowType: GridRowType;          // 'main' | 'continuation' | 'subItem'
  parentProductId?: string;      // Links continuation/sub-items to main row
}

export interface GridRowMetadata {
  // Persistence tracking
  tempId?: string;               // Original temp ID before database save
  lastModified?: Date;           // When this row was last changed
  isDirty?: boolean;             // Has unsaved changes

  // User interaction state
  isEditing?: boolean;           // Currently being edited
  editingField?: string;         // Which field is active

  // Remove validation metadata - handled at grid level
}

/core/types/LayerTypes.ts

// Extended interfaces for each calculation layer

import { GridRowCore, GridRowMetadata } from './CoreTypes';

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
}

// Layer 2: Display calculations
export interface GridRowDisplay extends GridRowWithRelationships {
  // Essential display properties
  displayNumber: string;         // "1", "1.a", "1.b", etc.
}

// Layer 3: Interaction calculations
export interface GridRowInteractive extends GridRowDisplay {
  // Drag & drop properties (includes parent-child behavior)
  isDraggable: boolean;          // Can this row be physically dragged?
  isDropTarget: boolean;         // Can accept dropped rows?
  dropZone: 'above' | 'below' | 'both' | 'none'; // Drop positions
  
  // Parent-child drag behavior
  draggedRowIds: string[];       // All rows that move when this row is dragged
                                // Main row: [mainId, ...continuationIds]
                                // Sub-item: [subItemId]
                                // Continuation: [] (not draggable)

  // Edit interaction state
  editableFields: string[];      // Which fields can be edited
  requiredFields: string[];      // Which fields are required

  // Action availability  
  canDelete: boolean;            // Delete action available?
  canDuplicate: boolean;         // Duplicate action available?
}

// Final combined type
export interface GridRow extends GridRowInteractive {
  metadata: GridRowMetadata;
}

/core/types/GridTypes.ts

// Grid-level types and configurations

export interface GridState {
  // Core data
  rows: GridRow[];
  selectedRowIds: Set<string>;

  // Edit state
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  isAutoSaving: boolean;

  // Interaction state
  dragState: DragState;
  editMode: 'normal' | 'bulk_edit' | 'readonly';
}

export interface DragState {
  activeId: string | null;       // Currently dragging row ID
  overId: string | null;         // Row being hovered over
  dropPosition: 'above' | 'below' | null; // Based on top50%/bottom50% of target row
  isDragDisabled: boolean;       // Global drag disable state
  
  // Simple visual feedback (no animations)
  // - Highlight grabbed row(s) 
  // - Show line indicator at proposed drop location
  showDropLine: boolean;         // Show drop line indicator
  dropLinePosition?: {           // Where to show the drop line
    toRowId: string;             // The target row we're hovering over
    location: 'above' | 'below'; // Above or below that row (top50%/bottom50%)
  };
}

export interface CalculationContext {
  // External dependencies
  productTypes: ProductTypeConfig[]; // Product field configurations

  // Current state
  currentRows: GridRowCore[];        // Input data for calculations
  previousRows?: GridRow[];          // Previous state for diff calculations

  // Calculation flags
  forceRecalculation?: boolean;      // Ignore memoization
}

Phase 1: Layer Calculation Functions

/core/layers/CoreDataLayer.ts

// Layer 0: Core data transformations

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
  return {
    createEmptyRow: (rowType, existingRows, parentProductId) => {
      const tempId = generateTempId();
      return {
        id: tempId,
        rowType,
        productTypeId: 27, // "Empty Row" product type
        productTypeName: 'Empty Row',
        data: {},
        parentProductId
      };
    },

    // ... other implementations
  };
};

// Helper functions
const generateTempId = (): string => {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/core/layers/RelationshipLayer.ts

// Layer 1: Parent/child relationships and hierarchy calculations

export interface RelationshipOperations {
  /**
   * Calculates parent-child relationships for all rows
   * @param coreRows - Input rows with core data
   * @returns Rows with relationship data added
   */
  calculateRelationships: (coreRows: GridRowCore[]) => GridRowWithRelationships[];

  /**
   * Determines parent row for a specific row based on position and rowType
   * @param targetRow - Row to find parent for
   * @param allRows - Complete row array
   * @param targetIndex - Index of target row in array
   * @returns Parent row ID or undefined
   */
  findParentRow: (
    targetRow: GridRowCore,
    allRows: GridRowCore[],
    targetIndex: number
  ) => string | undefined;

  /**
   * Finds all child rows for a given parent
   * @param parentId - Parent row ID
   * @param allRows - Complete row array
   * @returns Array of child row IDs
   */
  findChildRows: (parentId: string, allRows: GridRowCore[]) => string[];

  /**
   * Calculates logical row numbering (1, 2, 3...)
   * @param rows - Rows with relationships
   * @returns Rows with logical numbers assigned
   */
  calculateLogicalNumbers: (
    rows: GridRowWithRelationships[]
  ) => GridRowWithRelationships[];

  /**
   * Builds hierarchy path for each row [1, 2, 3] = "1.2.3"
   * @param rows - Rows with relationships and logical numbers
   * @returns Rows with hierarchy paths calculated
   */
  calculateHierarchyPaths: (
    rows: GridRowWithRelationships[]
  ) => GridRowWithRelationships[];

}

// Implementation with pure functions
export const createRelationshipOperations = (): RelationshipOperations => {
  return {
    calculateRelationships: (coreRows) => {
      // Step 1: Calculate parent/child relationships
      const withParents = coreRows.map((row, index) => ({
        ...row,
        parentId: findParentRow(row, coreRows, index),
        childIds: [], // Will be populated in next step
        logicalNumber: undefined,
        hierarchyPath: [],
        nestingLevel: 0
      }));

      // Step 2: Calculate child relationships
      const withChildren = withParents.map(row => ({
        ...row,
        childIds: findChildRows(row.id, withParents)
      }));

      // Step 3: Calculate logical numbers
      const withNumbers = calculateLogicalNumbers(withChildren);

      // Step 4: Calculate hierarchy paths
      const withPaths = calculateHierarchyPaths(withNumbers);

      return withPaths;
    },

    findParentRow: (targetRow, allRows, targetIndex) => {
      // Main rows have no parent
      if (targetRow.rowType === 'main') return undefined;

      // For sub-items and continuations, look backwards for nearest main product
      for (let i = targetIndex - 1; i >= 0; i--) {
        const candidateRow = allRows[i];
        if (candidateRow.rowType === 'main') {
          return candidateRow.id;
        }
      }
      return undefined;
    },

    // ... other implementations
  };
};

/core/layers/DisplayLayer.ts

// Layer 2: Visual properties and formatting

export interface DisplayOperations {
  /**
   * Calculates all display properties for rows
   * @param relationshipRows - Rows with relationship data
   * @param context - Display calculation context
   * @returns Rows with display properties added
   */
  calculateDisplay: (
    relationshipRows: GridRowWithRelationships[],
    context: DisplayContext
  ) => GridRowDisplay[];

  /**
   * Generates display numbers (1, 1.1, 1.1.1, etc.)
   * @param rows - Rows with hierarchy paths
   * @returns Rows with display numbers assigned
   */
  calculateDisplayNumbers: (rows: GridRowWithRelationships[]) => GridRowDisplay[];


  /**
   * Gets static field options from product configuration
   * @param productType - Product type identifier
   * @param productConfig - Product field configurations
   * @returns Static field options from database
   */
  getStaticFieldOptions: (
    productType: string,
    productConfig: ProductTypeConfig[]
  ) => Record<string, string[]>;

}

export interface DisplayContext {
  productTypes: ProductTypeConfig[];  // For field configurations
}


export interface FieldDisplayState {
  value: string;
  placeholder: string;
  isDisabled: boolean;
}


// Implementation
export const createDisplayOperations = (): DisplayOperations => {
  return {
    calculateDisplay: (relationshipRows, context) => {
      // Step 1: Calculate display numbers
      const withNumbers = calculateDisplayNumbers(relationshipRows);

      // Step 2: Calculate basic display properties only
      return withNumbers.map(row => ({
        ...row,
        // No styling in base layer - just display numbers
      }));
    },

    calculateDisplayNumbers: (rows) => {
      return rows.map(row => ({
        ...row,
        displayNumber: row.hierarchyPath.join('.'),
        showRowNumber: row.rowType !== 'continuation'
      }));
    },

    // ... other implementations
  };
};

/core/layers/InteractionLayer.ts

// Layer 3: User interaction capabilities and constraints

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
   * @param context - Drag context
   * @returns Drag capabilities object
   */
  calculateDragCapabilities: (
    row: GridRowDisplay,
    allRows: GridRowDisplay[],
    context: DragContext
  ) => DragCapabilities;

  /**
   * Calculates valid drop zones preventing drops between main rows and continuations
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
   * @param context - Edit context
   * @returns Array of editable field names
   */
  calculateEditableFields: (
    row: GridRowDisplay,
    context: EditContext
  ) => string[];

  /**
   * Calculates available actions for row
   * @param row - Row to analyze
   * @param context - Action context
   * @returns Action availability flags
   */
  calculateRowActions: (
    row: GridRowDisplay,
    context: ActionContext
  ) => RowActionFlags;

}

export interface InteractionContext {
  isReadOnly: boolean;
  editMode: 'normal' | 'bulk_edit' | 'readonly';
  currentUserId: number;
  userPermissions: string[];
  dragState: DragState;
}

export interface DragContext {
  isDragInProgress: boolean;
  activeId: string | null;
  dragConstraints: DragConstraints;
}

export interface EditContext {
  isReadOnly: boolean;
  hasEditLock: boolean;
  productConfig: DynamicField[] | null;
}

export interface ActionContext {
  canEdit: boolean;
  canDelete: boolean;
  hasChildren: boolean;
}

export interface DragCapabilities {
  isDraggable: boolean;
  isDropTarget: boolean;
  dropZone: 'above' | 'below' | 'child' | 'none';
  dragConstraints: {
    canMoveUp: boolean;
    canMoveDown: boolean;
    canChangeParent: boolean;
  };
}

export interface RowActionFlags {
  canDelete: boolean;
  canDuplicate: boolean;
}


// Implementation
export const createInteractionOperations = (): InteractionOperations => {
  return {
    calculateInteraction: (displayRows, context) => {
      return displayRows.map(row => {
        const dragCapabilities = calculateDragCapabilities(row, displayRows, {
          isDragInProgress: context.dragState.activeId !== null,
          activeId: context.dragState.activeId,
          dragConstraints: {} // Extract from context
        });

        const editableFields = calculateEditableFields(row, {
          isReadOnly: context.isReadOnly,
          hasEditLock: true, // Extract from context
          productConfig: null // Extract from row
        });

        const rowActions = calculateRowActions(row, {
          canEdit: !context.isReadOnly,
          canDelete: !context.isReadOnly,
          hasChildren: row.childIds.length > 0
        });

        return {
          ...row,
          isDraggable: dragCapabilities.isDraggable,
          isDropTarget: dragCapabilities.isDropTarget,
          dropZone: dragCapabilities.dropZone,
          dragConstraints: dragCapabilities.dragConstraints,
          editableFields,
          requiredFields: [], // Calculate from product config
          canDelete: rowActions.canDelete,
          canDuplicate: rowActions.canDuplicate
        };
      });
    },

    // ... other implementations
  };
};

Phase 1: Grid Engine Orchestrator

/core/GridEngine.ts

// Main orchestrator - single source of truth for grid state

export interface GridEngineConfig {
  productTypes: ProductTypeConfig[];
  autoSave?: {
    enabled: boolean;
    debounceMs: number;
    onSave: (rows: GridRowCore[]) => Promise<void>;
  };
  callbacks?: {
    onRowsChange?: (rows: GridRow[]) => void;
    onStateChange?: (state: GridState) => void;
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

    // Notify subscribers
    this.notifyStateChange();
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
    const withDisplay = this.displayOps.calculateDisplay(withRelationships, {
      productTypes: this.config.productTypes
    });

    // Layer 3: Calculate interaction properties
    const withInteraction = this.interactionOps.calculateInteraction(withDisplay, {
      isReadOnly: this.state.editMode === 'readonly',
      editMode: this.state.editMode,
      currentUserId: 0, // Extract from context
      userPermissions: [], // Extract from context
      dragState: this.state.dragState
    });

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

    // Determine which rows need recalculation
    const affectedRowIds = this.findDependentRows(rowId);

    if (affectedRowIds.size <= 3) {
      // Small update - use partial recalculation
      this.recalculatePartialRows(newCoreData, affectedRowIds);
    } else {
      // Large update - full recalculation
      this.updateCoreData(newCoreData);
    }
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

  private findDependentRows(changedRowId: string): Set<string> {
    // Find rows that depend on the changed row
    // (children, assembly members, etc.)
    const dependents = new Set<string>([changedRowId]);

    // Add logic to find dependent rows based on relationships
    // This is where optimization happens - only recalculate what's affected

    return dependents;
  }

  private recalculatePartialRows(
    newCoreData: GridRowCore[],
    affectedRowIds: Set<string>
  ): void {
    // Optimized partial recalculation
    // Only recalculate affected rows, leave others unchanged

    this.coreData = newCoreData;

    // Implementation would selectively update only affected rows
    // This is a significant performance optimization

    this.notifyStateChange();
  }

  private notifyStateChange(): void {
    this.config.callbacks?.onRowsChange?.(this.calculatedRows);
    this.config.callbacks?.onStateChange?.(this.state);
  }
}

export interface UpdateOptions {
  forceRecalculation?: boolean;
  markAsDirty?: boolean;
}

● Phase 2: Component Integration Specifications

/components/GridJobBuilder.tsx (Refactored)

// Clean orchestrator component using GridEngine

export interface GridJobBuilderRefactoredProps {
  // Essential props only
  estimateId?: number;
  initialRows?: GridRowCore[];
  isReadOnly?: boolean;
  onRowsChange?: (rows: GridRow[]) => void;
  // Validation removed from base layer
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

export const GridJobBuilder: React.FC<GridJobBuilderRefactoredProps> = ({
  estimateId,
  initialRows = [],
  isReadOnly = false,
  onRowsChange,
  onValidationChange,
  showNotification
}) => {
  // Initialize GridEngine with configuration
  const gridEngine = useMemo(() => {
    return new GridEngine({
      productTypes: [], // Load from API
      validationRules: [], // Load from API
      assemblyRules: [], // Load from API
      autoSave: {
        enabled: !isReadOnly,
        debounceMs: 500,
        onSave: async (rows) => {
          // Save to backend
          await saveGridData(estimateId, rows);
        }
      },
      callbacks: {
        onValidationChange: (hasErrors) => {
          onValidationChange?.(hasErrors);
        },
        onRowsChange: (rows) => {
          onRowsChange?.(rows);
        }
      }
    });
  }, [estimateId, isReadOnly]);

  // Initialize with data
  useEffect(() => {
    if (initialRows.length > 0) {
      gridEngine.updateCoreData(initialRows);
    }
  }, [initialRows, gridEngine]);

  // Current grid state
  const gridState = gridEngine.getState();
  const displayRows = gridEngine.getRows();

  // Event handlers
  const handleFieldCommit = useCallback((
    rowIndex: number,
    fieldName: string,
    value: string
  ) => {
    const rowId = displayRows[rowIndex]?.id;
    if (!rowId) return;

    gridEngine.updateSingleRow(rowId, { [fieldName]: value });
  }, [displayRows, gridEngine]);

  const handleProductTypeSelect = useCallback(async (
    rowIndex: number,
    productTypeId: number
  ) => {
    const rowId = displayRows[rowIndex]?.id;
    if (!rowId) return;

    gridEngine.updateSingleRow(rowId, {
      productTypeId: productTypeId.toString(),
      productTypeName: await getProductTypeName(productTypeId)
    });
  }, [displayRows, gridEngine]);

  const handleInsertRow = useCallback((afterIndex: number) => {
    const coreData = gridEngine.getCoreData();
    const coreOps = gridEngine.getCoreOperations();
    const newRow = coreOps.createEmptyRow('main', coreData);

    const newCoreData = [...coreData];
    newCoreData.splice(afterIndex + 1, 0, newRow);

    gridEngine.updateCoreData(newCoreData);
  }, [gridEngine]);

  const handleDeleteRow = useCallback((rowIndex: number) => {
    const coreData = gridEngine.getCoreData();
    const newCoreData = coreData.filter((_, index) => index !== rowIndex);

    gridEngine.updateCoreData(newCoreData);
  }, [gridEngine]);

  // Drag and drop handling
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const coreData = gridEngine.getCoreData();
    const oldIndex = coreData.findIndex(row => row.id === active.id);
    const newIndex = coreData.findIndex(row => row.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newCoreData = arrayMove(coreData, oldIndex, newIndex);
      gridEngine.updateCoreData(newCoreData);
    }
  }, [gridEngine]);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="grid-job-builder">
        <GridHeader />

        <GridBody
          rows={displayRows}
          onFieldCommit={handleFieldCommit}
          onProductTypeSelect={handleProductTypeSelect}
          onInsertRow={handleInsertRow}
          onDeleteRow={handleDeleteRow}
          isReadOnly={isReadOnly}
        />

        <GridFooter
          totalRows={displayRows.length}
          hasUnsavedChanges={gridState.hasUnsavedChanges}
          validationState={gridState.globalValidationState}
        />
      </div>
    </DndContext>
  );
};


const normalizeFieldData = (data: Record<string, any>): Record<string, string> => {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      normalized[key] = '';
    } else {
      normalized[key] = String(value);
    }
  }

  return normalized;
};

Phase 2: Manager Refactoring

/managers/DragManager.ts

// Clean drag and drop management

export interface DragManagerConfig {
  onDragEnd: (result: DragResult) => void;
  onDragStart?: (dragInfo: DragInfo) => void;
  onDragOver?: (overInfo: DragOverInfo) => void;
  sensors?: SensorDescriptor<any>[];
}

export interface DragResult {
  sourceId: string;
  targetId: string;
  position: 'above' | 'below' | 'child';
  isValid: boolean;
}

export interface DragInfo {
  id: string;
  rowData: GridRow;
}

export interface DragOverInfo {
  overId: string;
  position: 'above' | 'below' | 'child';
  isValidDrop: boolean;
}

export const createDragManager = (config: DragManagerConfig) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    ...(config.sensors || [])
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;

    config.onDragStart?.({
      id: active.id as string,
      rowData: active.data.current as GridRow
    });
  }, [config.onDragStart]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const sourceRow = active.data.current as GridRow;
    const targetRow = over.data.current as GridRow;

    // Determine drop validity
    const isValidDrop = sourceRow.dragConstraints.canMoveUp ||
                       sourceRow.dragConstraints.canMoveDown;
    const dropPosition = calculateDropPosition(event, targetRow);

    config.onDragOver?.({
      overId: over.id as string,
      position: dropPosition,
      isValidDrop
    });
  }, [config.onDragOver]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const result: DragResult = {
      sourceId: active.id as string,
      targetId: over.id as string,
      position: calculateDropPosition(event, over.data.current as GridRow),
      isValid: validateDrop(
        active.data.current as GridRow,
        over.data.current as GridRow
      )
    };

    config.onDragEnd(result);
  }, [config.onDragEnd]);

  return {
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd
  };
};

// Helper functions
const calculateDropPosition = (
  event: DragOverEvent | DragEndEvent,
  targetRow: GridRow
): 'above' | 'below' | 'child' => {
  return targetRow.dropZone === 'none' ? 'below' : targetRow.dropZone;
};

const validateDrop = (sourceRow: GridRow, targetRow: GridRow): boolean => {
  return sourceRow.isDraggable && targetRow.isDropTarget;
};

// ValidationManager removed from base layer - business validation moved to validation layer

● Phase 3: Utility and Helper Specifications

/utils/calculations/parentAssignment.ts

/**
 * Pure functions for parent-child relationship calculations
 */

export interface ParentAssignmentResult {
  parentId?: string;
  childIds: string[];
  nestingLevel: number;
  hierarchyPath: number[];
}

/**
 * Calculates parent for a single row based on rowType and position
 * @param targetRow - Row to find parent for
 * @param allRows - Complete row array for context
 * @param targetIndex - Index of target row in array
 * @returns Parent row ID or undefined if no parent
 */
export const calculateParentForRow = (
  targetRow: GridRowCore,
  allRows: GridRowCore[],
  targetIndex: number
): string | undefined => {
  // Main rows have no parent
  if (targetRow.rowType === 'main') return undefined;

  // For sub-items and continuations, look backwards for nearest main product
  for (let i = targetIndex - 1; i >= 0; i--) {
    const candidateRow = allRows[i];
    if (candidateRow.rowType === 'main') {
      return candidateRow.id;
    }
  }

  return undefined;
};

/**
 * Calculates all child rows for a given parent
 * @param parentId - Parent row ID to find children for
 * @param allRows - Complete row array
 * @returns Array of child row IDs
 */
export const calculateChildrenForRow = (
  parentId: string,
  allRows: GridRowCore[]
): string[] => {
  const parentIndex = allRows.findIndex(row => row.id === parentId);
  if (parentIndex === -1) return [];

  const parent = allRows[parentIndex];
  const children: string[] = [];

  // Only main products can have children
  if (parent.rowType !== 'main') return [];

  // Look forward for sub-items and continuations that belong to this main product
  for (let i = parentIndex + 1; i < allRows.length; i++) {
    const candidateRow = allRows[i];

    // Stop if we encounter another main product
    if (candidateRow.rowType === 'main') break;

    // This sub-item or continuation belongs to our main product
    if (candidateRow.rowType === 'subItem' || candidateRow.rowType === 'continuation') {
      children.push(candidateRow.id);
    }
  }

  return children;
};

/**
 * Calculates nesting level and hierarchy path for all rows
 * @param rows - Rows with parent relationships already calculated
 * @returns Rows with hierarchy information added
 */
export const calculateHierarchyForAllRows = (
  rows: GridRowWithRelationships[]
): GridRowWithRelationships[] => {
  const logicalNumbersByParent = new Map<string | null, number>();

  return rows.map(row => {
    const parentKey = row.parentId || null;

    // Increment logical number for this parent
    const currentNumber = (logicalNumbersByParent.get(parentKey) || 0) + 1;
    logicalNumbersByParent.set(parentKey, currentNumber);

    // Calculate hierarchy path
    const hierarchyPath = buildHierarchyPath(row, rows, currentNumber);

    return {
      ...row,
      logicalNumber: currentNumber,
      nestingLevel: row.parentId ? 'sub' : 'main',
      hierarchyPath
    };
  });
};

/**
 * Builds full hierarchy path for a row (e.g., [1, 2, 3] for "1.2.3")
 * @param row - Row to build path for
 * @param allRows - Complete row array
 * @param currentNumber - Current logical number at this level
 * @returns Hierarchy path array
 */
const buildHierarchyPath = (
  row: GridRowWithRelationships,
  allRows: GridRowWithRelationships[],
  currentNumber: number
): number[] => {
  if (!row.parentId) {
    // Root level
    return [currentNumber];
  }

  // Find parent and get its hierarchy path
  const parent = allRows.find(r => r.id === row.parentId);
  if (!parent || !parent.hierarchyPath) {
    // Fallback - shouldn't happen with proper calculation order
    return [currentNumber];
  }

  // Append current number to parent's path
  return [...parent.hierarchyPath, currentNumber];
};

/**
 * Validates parent-child relationships for consistency
 * @param rows - Rows to validate
 * @returns Array of validation error messages
 */
export const validateParentChildRelationships = (
  rows: GridRowWithRelationships[]
): string[] => {
  const errors: string[] = [];
  const rowMap = new Map(rows.map(row => [row.id, row]));

  for (const row of rows) {
    // Check if parent exists
    if (row.parentId && !rowMap.has(row.parentId)) {
      errors.push(`Row ${row.id} references non-existent parent ${row.parentId}`);
    }

    // Check rowType consistency - these should NEVER happen with correct algorithm
    if (row.parentId) {
      const parent = rowMap.get(row.parentId);
      if (parent) {
        // Parent must be a main product
        if (parent.rowType !== 'main') {
          throw new Error(`CRITICAL: Row ${row.id} has parent ${row.parentId} that is not a main product. This indicates a bug in the parent-finding algorithm.`);
        }
        // Child must be subItem or continuation
        if (row.rowType === 'main') {
          throw new Error(`CRITICAL: Main product ${row.id} cannot have a parent. This indicates a bug in the parent-finding algorithm.`);
        }
      }
    }

    // Check child relationships are bidirectional
    for (const childId of row.childIds) {
      const child = rowMap.get(childId);
      if (!child) {
        errors.push(`Row ${row.id} references non-existent child ${childId}`);
      } else if (child.parentId !== row.id) {
        errors.push(`Row ${childId} is not properly linked to parent ${row.id}`);
      }
    }
  }

  return errors;
};

/**
 * Optimized function to find rows that depend on a changed row
 * Used for partial recalculation optimization
 * @param changedRowId - ID of the row that changed
 * @param allRows - Complete row array
 * @returns Set of row IDs that need recalculation
 */
export const findDependentRows = (
  changedRowId: string,
  allRows: GridRowWithRelationships[]
): Set<string> => {
  const dependents = new Set<string>([changedRowId]);
  const rowMap = new Map(allRows.map(row => [row.id, row]));
  const changedRow = rowMap.get(changedRowId);

  if (!changedRow) return dependents;

  // Add all descendants (children, grandchildren, etc.)
  const addDescendants = (rowId: string) => {
    const row = rowMap.get(rowId);
    if (!row) return;

    for (const childId of row.childIds) {
      if (!dependents.has(childId)) {
        dependents.add(childId);
        addDescendants(childId); // Recursively add grandchildren
      }
    }
  };

  addDescendants(changedRowId);

  // Add parent (hierarchy path might change)
  if (changedRow.parentId) {
    dependents.add(changedRow.parentId);
  }

  // Add siblings (logical numbers might shift)
  if (changedRow.parentId) {
    const parent = rowMap.get(changedRow.parentId);
    if (parent) {
      for (const siblingId of parent.childIds) {
        dependents.add(siblingId);
      }
    }
  } else {
    // Root level siblings
    for (const row of allRows) {
      if (!row.parentId && row.id !== changedRowId) {
        dependents.add(row.id);
      }
    }
  }

  return dependents;
};

/utils/calculations/rowNumbering.ts

/**
 * Pure functions for row numbering and display formatting
 * Handles both logical numbering (1, 2, 3) and display numbering (1.1.1)
 */

export interface NumberingResult {
  logicalNumber: number;
  displayNumber: string;
  hierarchyPath: number[];
}

/**
 * Calculates display numbers for all rows (1, 1.1, 1.1.1, etc.)
 * @param rows - Rows with hierarchy paths calculated
 * @returns Rows with display numbers assigned
 */
export const calculateDisplayNumbers = (
  rows: GridRowWithRelationships[]
): string[] => {
  return rows.map(row => {
    if (!row.hierarchyPath || row.hierarchyPath.length === 0) {
      return '1'; // Fallback for malformed data
    }

    return row.hierarchyPath.join('.');
  });
};

/**
 * Generates logical numbering sequence for rows at the same level
 * @param rows - All rows in the grid
 * @param parentId - Parent ID to number children for (null for root level)
 * @returns Map of row ID to logical number
 */
export const calculateLogicalNumbersForLevel = (
  rows: GridRowCore[],
  parentId: string | null
): Map<string, number> => {
  const numbersMap = new Map<string, number>();
  let currentNumber = 1;

  for (const row of rows) {
    // Check if this row belongs to the specified parent level
    const rowParentId = getParentIdForRow(row, rows);

    if (rowParentId === parentId) {
      numbersMap.set(row.id, currentNumber++);
    }
  }

  return numbersMap;
};

/**
 * Formats hierarchy path into display string with custom separator
 * @param hierarchyPath - Numeric path array [1, 2, 3]
 * @param separator - Separator character (default: '.')
 * @param prefix - Optional prefix (default: '')
 * @param suffix - Optional suffix (default: '')
 * @returns Formatted display string
 */
export const formatHierarchyPath = (
  hierarchyPath: number[],
  separator: string = '.',
  prefix: string = '',
  suffix: string = ''
): string => {
  if (hierarchyPath.length === 0) return '';

  return prefix + hierarchyPath.join(separator) + suffix;
};

/**
 * Validates numbering consistency across all rows
 * @param rows - Rows with numbering calculated
 * @returns Array of validation errors
 */
export const validateNumberingConsistency = (
  rows: GridRowWithRelationships[]
): string[] => {
  const errors: string[] = [];
  const numbersAtLevel = new Map<string, Set<number>>();

  for (const row of rows) {
    const levelKey = row.parentId || 'root';

    if (!numbersAtLevel.has(levelKey)) {
      numbersAtLevel.set(levelKey, new Set());
    }

    const levelNumbers = numbersAtLevel.get(levelKey)!;

    // Check for duplicate numbers at same level
    if (row.logicalNumber && levelNumbers.has(row.logicalNumber)) {
      errors.push(`Duplicate logical number ${row.logicalNumber} at level ${levelKey}`);
    }

    if (row.logicalNumber) {
      levelNumbers.add(row.logicalNumber);
    }

    // Check hierarchy path consistency
    const expectedDepth = row.nestingLevel === 'main' ? 1 : 2;
    if (row.hierarchyPath.length !== expectedDepth) {
      errors.push(`Row ${row.id} has inconsistent hierarchy path length: expected ${expectedDepth}, got ${row.hierarchyPath.length}`);
    }
  }

  // Check for gaps in numbering
  for (const [levelKey, numbers] of numbersAtLevel) {
    const sortedNumbers = Array.from(numbers).sort((a, b) => a - b);

    for (let i = 0; i < sortedNumbers.length; i++) {
      if (sortedNumbers[i] !== i + 1) {
        errors.push(`Gap in numbering at level ${levelKey}: expected ${i + 1}, found ${sortedNumbers[i]}`);
        break;
      }
    }
  }

  return errors;
};

/**
 * Recalculates numbering after row insertion/deletion
 * @param rows - Current rows
 * @param changeType - Type of change that occurred
 * @param changeIndex - Index where change occurred
 * @returns Updated rows with corrected numbering
 */
export const recalculateNumberingAfterChange = (
  rows: GridRowWithRelationships[],
  changeType: 'insert' | 'delete' | 'move',
  changeIndex: number
): GridRowWithRelationships[] => {
  // For efficiency, only recalculate affected rows
  const affectedParents = new Set<string | null>();

  // Determine which parent levels are affected
  if (changeIndex < rows.length) {
    const changedRow = rows[changeIndex];
    affectedParents.add(changedRow.parentId || null);
  }

  // Recalculate only affected levels
  return rows.map(row => {
    if (affectedParents.has(row.parentId || null)) {
      // This row's numbering might have changed
      const newLogicalNumber = calculateLogicalNumberForRow(row, rows);
      const newHierarchyPath = buildHierarchyPathForRow(row, rows, newLogicalNumber);

      return {
        ...row,
        logicalNumber: newLogicalNumber,
        hierarchyPath: newHierarchyPath
      };
    }

    return row; // No change needed
  });
};

// Helper functions
const getParentIdForRow = (row: GridRowCore, allRows: GridRowCore[]): string | null => {
  const rowIndex = allRows.findIndex(r => r.id === row.id);
  if (rowIndex === -1) return null;

  return calculateParentForRow(row, allRows, rowIndex) || null;
};

const calculateLogicalNumberForRow = (
  row: GridRowWithRelationships,
  allRows: GridRowWithRelationships[]
): number => {
  const siblingsBeforeThis = allRows
    .slice(0, allRows.findIndex(r => r.id === row.id))
    .filter(r => (r.parentId || null) === (row.parentId || null));

  return siblingsBeforeThis.length + 1;
};

const buildHierarchyPathForRow = (
  row: GridRowWithRelationships,
  allRows: GridRowWithRelationships[],
  logicalNumber: number
): number[] => {
  if (!row.parentId) {
    return [logicalNumber];
  }

  const parent = allRows.find(r => r.id === row.parentId);
  if (!parent || !parent.hierarchyPath) {
    return [logicalNumber]; // Fallback
  }

  return [...parent.hierarchyPath, logicalNumber];
};

// Visual styling removed from base layer - moved to Visual Styling Layer

● 🎯 Complete Architecture Summary

Based on the modularization plan and my analysis of the existing GridJobBuilder system, here's the comprehensive
specification for the layered architecture refactor:

🏗️ Key Design Principles

1. Single Source of Truth: GridEngine class manages all state through immutable transformations
2. Pure Functions: All calculations are side-effect-free and easily testable
3. Layer Separation: Clear boundaries between core data, relationships, display, and interaction
4. Performance Optimization: Selective recalculation and memoization at every layer
5. Backward Compatibility: Existing components work unchanged during transition

📊 Data Flow Architecture

Raw Data Input → Core Data Layer → Relationship Layer → Display Layer → Interaction Layer → React Components
     ↓                ↓                  ↓                ↓                   ↓                ↓
GridRowCore → GridRowCore[] → GridRowWithRelationships → GridRowDisplay → GridRowInteractive → UI Render

🎯 File Organization Summary

/components/jobEstimation/
├── core/
│   ├── GridEngine.ts                    # 🎯 Main orchestrator class
│   ├── types/
│   │   ├── CoreTypes.ts                 # Base interfaces (GridRowCore, GridRowMetadata)
│   │   ├── LayerTypes.ts               # Extended interfaces for each layer
│   │   └── GridTypes.ts                # Grid-level state and context types
│   ├── layers/
│   │   ├── CoreDataLayer.ts            # Data validation, normalization, cloning
│   │   ├── RelationshipLayer.ts        # Parent/child, hierarchy, assembly logic
│   │   ├── DisplayLayer.ts             # Visual styling, colors, field formatting
│   │   └── InteractionLayer.ts         # Drag/drop, edit permissions, actions
│   └── calculations/
│       ├── parentAssignment.ts         # Pure parent/child calculation functions
│       ├── rowNumbering.ts            # Logical and display numbering functions
│       └── visualStyling.ts           # Color, styling, and formatting functions
├── components/
│   ├── GridJobBuilder.tsx             # 🔄 Refactored orchestrator (uses GridEngine)
│   ├── GridRow.tsx                    # Pure display component
│   └── GridBody.tsx                   # Layout component
├── managers/
│   ├── DragManager.ts                 # 🔄 Simplified drag logic using calculated properties
│   └── ValidationManager.ts           # 🔄 Centralized validation using display states
└── utils/
    ├── persistence/                    # Database sync utilities
    └── compatibility/                  # Legacy format conversion functions

🚀 Performance Optimizations

1. Selective Recalculation: findDependentRows() identifies minimal affected rows
2. Layer Memoization: Each layer caches results until dependencies change
3. Batch State Updates: Single state update per user action
4. Pure Function Testing: All calculation functions easily unit testable

🔄 Implementation Strategy

- Phase 1: Create base types (GridRowCore, GridRowType) and layer calculation functions (parent-child relationships, display numbers, interaction properties)
- Phase 2: Implement GridEngine orchestrator with layered calculations  
- Phase 3: Integrate with existing components via clean APIs
- Phase 4: Optimize performance with selective recalculation
- Phase 5: Add advanced features and enhancements

This architecture maintains all existing functionality while providing a clean, testable, and performant
foundation for future enhancements. The layered approach makes it easy to understand, debug, and extend each
aspect of the grid system independently.