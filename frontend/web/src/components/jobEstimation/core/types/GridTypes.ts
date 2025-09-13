// Grid-level types and configurations

import { GridRow, GridRowCore, ProductTypeConfig } from './CoreTypes';

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

export interface UpdateOptions {
  forceRecalculation?: boolean;
  markAsDirty?: boolean;
}

// Display context for layer calculations
export interface DisplayContext {
  productTypes: ProductTypeConfig[];  // For field configurations
  staticDataCache?: Record<string, any[]>; // Cache of database options (materials, colors, etc.)
}

// Interaction context for layer calculations
export interface InteractionContext {
  isReadOnly: boolean;
  editMode: 'normal' | 'bulk_edit' | 'readonly';
  currentUserId: number;
  userPermissions: string[];
  dragState: DragState;
}