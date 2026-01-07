/**
 * Types for Import QB Descriptions Modal
 *
 * This modal allows importing QB descriptions from other estimate versions
 * using a 3-column drag-drop interface with cell-level selection.
 */

// ============================================================================
// Source Estimate Types
// ============================================================================

export interface ImportSourceEstimate {
  id: number;
  job_id: number;
  job_name: string;
  customer_name: string;
  version_number: number;
  qb_doc_number: string | null;
  status: string;
}

export interface SourcePreparationItem {
  id: number;
  estimate_id: number;
  display_order: number;
  item_name: string;
  qb_description: string | null;
  calculation_display: string | null;
  quantity: number;
  unit_price: number;
  extended_price: number;
  is_description_only: boolean;
  qb_item_id: string | null;
  qb_item_name: string | null;
}

// ============================================================================
// Staged Row Types (Middle Column)
// ============================================================================

export type CopyableColumn = 'qb_item' | 'qb_description' | 'quantity' | 'unit_price';

export interface StagedRow {
  id: string;  // UUID for React key
  sourceEstimateId: number;
  sourceEstimateName: string;  // For display (e.g., "Job Name v2")
  sourceLineIndex: number;
  data: SourcePreparationItem;
  selectedCells: Set<CopyableColumn>;
  targetSlotIndex: number;  // Which slot/position this staged row is assigned to
}

// ============================================================================
// Target Preview Types (Right Column)
// ============================================================================

export interface TargetPreparationItem {
  id: number;
  display_order: number;
  item_name: string;
  qb_description: string | null;
  calculation_display: string | null;
  quantity: number;
  unit_price: number;
  extended_price: number;
  is_description_only: boolean;
  qb_item_id: string | null;
  qb_item_name: string | null;
}

// ============================================================================
// Modal State Types
// ============================================================================

export interface ImportModalState {
  // Source selection
  selectedEstimateId: number | null;
  selectedEstimateName: string;
  sourceItems: SourcePreparationItem[];
  sourceLoading: boolean;

  // Staged rows (persists across source changes)
  stagedRows: StagedRow[];

  // Drag state
  draggedIndices: Set<number>;
  dropPreviewIndex: number | null;

  // Column selection defaults
  defaultSelectedColumns: Set<CopyableColumn>;
}

// ============================================================================
// Import Instruction Types (for API call)
// ============================================================================

export interface ImportInstruction {
  targetItemId?: number;      // If provided, update this existing item
  // Copyable fields (can update existing items)
  qb_item_id?: string | null;
  qb_item_name?: string | null;
  qb_description?: string | null;
  quantity?: number;
  unit_price?: number;
  // For new items only:
  item_name?: string;
  calculation_display?: string | null;
  is_description_only?: boolean;
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface ImportQBDescriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  estimateId: number;
  jobId: number;
  targetItems: TargetPreparationItem[];
  onImportComplete: (updatedItems: any[]) => void;
}

export interface SourceEstimatePanelProps {
  selectedSourceId: number | null;
  selectedSourceName: string;
  sourceItems: SourcePreparationItem[];
  sourceLoading: boolean;
  onStagedRowsAdd: (rows: StagedRow[]) => void;
  defaultSelectedColumns: Set<CopyableColumn>;
}

export interface CombinedStagingTargetPanelProps {
  stagedRows: StagedRow[];
  targetItems: TargetPreparationItem[];
  onCellSelectionChange: (rowId: string, column: CopyableColumn, selected: boolean) => void;
  onColumnHeaderClick: (column: CopyableColumn) => void;
  onRowRemove: (rowId: string) => void;
  onSlotDrop: (rowIds: string[], newSlotIndex: number) => void;
  onSourceDrop: (sourceIndices: number[], targetSlotIndex: number) => void;
  onClearAll: () => void;
}

// ============================================================================
// Display Helpers
// ============================================================================

export const COLUMN_CONFIG = {
  lineNumber: { header: '#', copyable: false, width: 'w-10' },
  qb_item: { header: 'QB Item', copyable: true, width: 'w-32' },
  qb_description: { header: 'QB Description', copyable: true, width: 'flex-1' },
  calculation_display: { header: 'Calculation', copyable: false, width: 'w-32' },
  quantity: { header: 'Qty', copyable: true, width: 'w-16' },
  unit_price: { header: 'Unit Price', copyable: true, width: 'w-20' },
} as const;

export const COPYABLE_COLUMNS: CopyableColumn[] = ['qb_item', 'qb_description', 'quantity', 'unit_price'];
