// Main orchestrator - single source of truth for grid state

import { GridRowCore, ProductTypeConfig } from './types/CoreTypes';
import { GridRow } from './types/LayerTypes';
import { GridState, CalculationContext, UpdateOptions, DisplayContext, InteractionContext } from './types/GridTypes';

// Layer operations
import { createCoreDataOperations, CoreDataOperations } from './layers/CoreDataLayer';
import { createRelationshipOperations, RelationshipOperations } from './layers/RelationshipLayer';
import { createDisplayOperations, DisplayOperations } from './layers/DisplayLayer';
import { createInteractionOperations, InteractionOperations } from './layers/InteractionLayer';

// Extracted operation modules
import { RowOperations } from './operations/RowOperations';
import { DragOperations } from './operations/DragOperations';
import { DataPersistence } from './persistence/DataPersistence';

// Validation system
import { ValidationEngine } from './validation/ValidationEngine';

export interface GridEngineConfig {
  productTypes: ProductTypeConfig[];
  staticDataCache?: Record<string, any[]>;  // Database options (materials, colors, etc.)
  autoSave?: {
    enabled: boolean;
    debounceMs: number;
    onSave: (rows: GridRowCore[]) => Promise<void>;
  };
  validation?: {
    enabled: boolean;
    productValidations: Map<number, Record<string, any>>; // Field validation configs by product type
  };
  callbacks?: {
    onRowsChange?: (rows: GridRow[]) => void;
    onStateChange?: (state: GridState) => void;
    onValidationChange?: (hasErrors: boolean, errorCount: number) => void;
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

  // Extracted operation modules
  private rowOps: RowOperations;
  private dragOps: DragOperations;
  private persistence: DataPersistence;

  // Validation system
  private validationEngine?: ValidationEngine;

  constructor(config: GridEngineConfig) {
    this.config = config;
    this.state = this.createInitialState();

    // Initialize operation modules
    this.coreOps = createCoreDataOperations();
    this.relationshipOps = createRelationshipOperations();
    this.displayOps = createDisplayOperations();
    this.interactionOps = createInteractionOperations();

    // Initialize extracted operation modules
    this.rowOps = new RowOperations({
      productTypes: this.config.productTypes,
      coreOps: this.coreOps
    });
    this.dragOps = new DragOperations();
    this.persistence = new DataPersistence({
      autoSave: this.config.autoSave,
      coreOps: this.coreOps
    });

    // Initialize validation engine if enabled
    if (this.config.validation?.enabled && this.config.validation.productValidations) {
      this.validationEngine = new ValidationEngine({
        productValidations: this.config.validation.productValidations
      });
    }
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

    // Trigger auto-save on data changes
    if (this.state.hasUnsavedChanges) {
      this.triggerAutoSave();
    }

    // Notify subscribers
    this.notifyStateChange();
  }

  /**
   * Optimized update for single row field changes (no recalculation needed)
   * @param rowId - ID of changed row
   * @param fieldUpdates - Field changes
   */
  updateSingleRow(rowId: string, fieldUpdates: Record<string, string>): void {
    // Delegate to RowOperations module
    const result = this.rowOps.updateSingleRowField(
      rowId,
      fieldUpdates,
      this.coreData,
      this.calculatedRows
    );

    // Update internal state
    this.coreData = result.coreData;
    this.calculatedRows = result.calculatedRows;
    this.state.rows = this.calculatedRows;

    // Mark as having unsaved changes and trigger auto-save
    this.state.hasUnsavedChanges = true;
    this.triggerAutoSave();

    // Notify subscribers
    this.notifyStateChange();
  }

  /**
   * Updates product type for a specific row
   * @param rowId - ID of row to update
   * @param productTypeId - New product type ID
   * @param productTypeName - New product type name
   * @param options - Update options
   */
  updateRowProductType(rowId: string, productTypeId: number, productTypeName: string, options?: UpdateOptions): void {
    // Delegate to RowOperations module
    const newCoreData = this.rowOps.updateRowProductType(
      rowId,
      productTypeId,
      productTypeName,
      this.coreData
    );

    // STRUCTURAL CHANGE: Product type changes affect rowType, relationships, and display
    // Full recalculation is necessary and correct here
    this.updateCoreData(newCoreData, options);
  }

  /**
   * Adds a new row at specified position
   * @param afterIndex - Insert after this index (-1 for beginning)
   * @param rowType - Type of row to create
   * @param parentProductId - Parent for sub-items/continuations
   */
  insertRow(afterIndex: number, rowType: 'main' | 'continuation' | 'subItem' = 'main', parentProductId?: string): void {
    // Delegate to RowOperations module
    const newCoreData = this.rowOps.insertRow(
      afterIndex,
      rowType,
      parentProductId,
      this.coreData,
      this.calculatedRows
    );

    this.updateCoreData(newCoreData);
  }

  /**
   * Removes a row and its children
   * @param rowId - ID of row to remove
   */
  deleteRow(rowId: string): void {
    // Delegate to RowOperations module
    const newCoreData = this.rowOps.deleteRow(
      rowId,
      this.coreData,
      this.calculatedRows
    );

    this.updateCoreData(newCoreData);
  }

  /**
   * Duplicates a row and its children
   * @param rowId - ID of row to duplicate
   */
  duplicateRow(rowId: string): void {
    // Delegate to RowOperations module
    const newCoreData = this.rowOps.duplicateRow(
      rowId,
      this.coreData,
      this.calculatedRows
    );

    this.updateCoreData(newCoreData);
  }

  /**
   * Moves rows (drag and drop)
   * @param draggedRowIds - IDs of rows being moved
   * @param targetRowId - ID of target row
   * @param position - Where to drop relative to target
   */
  moveRows(draggedRowIds: string[], targetRowId: string, position: 'above' | 'below'): void {
    // Delegate to DragOperations module
    const newCoreData = this.dragOps.moveRows(
      draggedRowIds,
      targetRowId,
      position,
      this.coreData
    );

    this.updateCoreData(newCoreData);
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

    // Update RowOperations config if product types changed
    if (updates.productTypes) {
      this.rowOps = new RowOperations({
        productTypes: this.config.productTypes,
        coreOps: this.coreOps
      });
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

  /**
   * Get validation results for UI integration
   */
  getValidationResults() {
    return this.validationEngine?.getResultsManager();
  }

  /**
   * Check if there are blocking validation errors
   */
  hasValidationErrors(): boolean {
    return this.validationEngine?.hasBlockingErrors() || false;
  }

  /**
   * Update validation configuration with product validation rules
   */
  updateValidationConfig(productValidations: Map<number, Record<string, any>>): void {
    if (this.config.validation) {
      this.config.validation.productValidations = productValidations;

      // Re-initialize validation engine with new config
      if (this.config.validation.enabled) {
        this.validationEngine = new ValidationEngine({
          productValidations: productValidations
        });
      }
    }
  }

  /**
   * Reloads grid data from backend API and updates GridEngine state
   * @param estimateId - Estimate ID to load data for
   * @param jobVersioningApi - API client for loading data
   * @param fieldPromptsMap - Field prompts for existing compatibility
   */
  async reloadFromBackend(estimateId: number, jobVersioningApi: any, fieldPromptsMap: any): Promise<void> {
    try {
      // Delegate to DataPersistence module
      const coreRows = await this.persistence.reloadFromBackend(estimateId, jobVersioningApi, fieldPromptsMap);

      this.updateCoreData(coreRows, { markAsDirty: false });

      // Process product types for each row
      coreRows.forEach((row) => {
        if (row.productTypeId && row.productTypeName) {
          this.updateRowProductType(row.id, row.productTypeId, row.productTypeName, { markAsDirty: false });
        }
      });
    } catch (error) {
      console.error('Failed to reload data from backend:', error);
      throw error; // Let caller handle the error
    }
  }

  /**
   * Cleanup method for auto-save timer
   */
  destroy(): void {
    this.persistence.destroy();
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

    // Trigger validation after layer recalculation (for grid load/reload)
    // Debounced to prevent excessive validation calls during initialization
    if (this.validationEngine) {
      this.triggerValidationDebounced();
    }
  }

  /**
   * Triggers auto-save with debouncing
   */
  private triggerAutoSave(): void {
    this.persistence.triggerAutoSave(
      this.coreData,
      () => {
        this.state.isAutoSaving = true;
        this.notifyStateChange();
      },
      () => {
        this.markAsSaved();
        // Trigger validation after successful auto-save
        this.triggerValidation();
      },
      (error) => {
        this.state.isAutoSaving = false;
        this.notifyStateChange();
      }
    );
  }

  private validationTimeoutId: NodeJS.Timeout | null = null;

  /**
   * Debounced validation trigger to prevent excessive calls during initialization
   */
  private triggerValidationDebounced(): void {
    // Clear previous timeout
    if (this.validationTimeoutId) {
      clearTimeout(this.validationTimeoutId);
    }

    // Set new timeout
    this.validationTimeoutId = setTimeout(() => {
      this.triggerValidation();
      this.validationTimeoutId = null;
    }, 150); // 150ms debounce
  }

  /**
   * Immediate validation trigger (used after auto-save)
   */
  private async triggerValidation(): Promise<void> {
    if (!this.validationEngine) return;

    try {
      // Run validation on current core data
      await this.validationEngine.validateGrid(this.coreData);

      // Check validation results and notify callbacks
      const hasErrors = this.validationEngine.hasBlockingErrors();

      // Get actual error counts from ValidationResultsManager
      const summary = this.getValidationResults()?.getValidationSummary();
      const errorCount = summary ? summary.cellErrorCount + summary.structureErrorCount : 0;
      const warningCount = summary ? summary.cellWarningCount : 0;

      // Notify callbacks about validation state
      this.config.callbacks?.onValidationChange?.(hasErrors, errorCount);

    } catch (error) {
      console.error('Validation error:', error);
      // Don't block the UI if validation fails
    }
  }

  private notifyStateChange(): void {
    this.config.callbacks?.onRowsChange?.(this.calculatedRows);
    this.config.callbacks?.onStateChange?.(this.state);
  }
}