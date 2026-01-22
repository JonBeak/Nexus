/**
 * Types for Import From Estimate Modal (Orders)
 *
 * This modal allows importing QB descriptions from estimate preparation items
 * into order parts. Matches the layout of the estimate import modal.
 */

import { OrderPart } from '@/types/orders';

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
// Staged Row Types
// ============================================================================

export type CopyableColumn = 'qb_item' | 'qb_description' | 'quantity' | 'unit_price';

export const COPYABLE_COLUMNS: CopyableColumn[] = ['qb_item', 'qb_description', 'quantity', 'unit_price'];

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
// Target Order Part Types
// ============================================================================

export interface TargetOrderPart {
  part_id: number;
  display_number: number | null;
  product_type: string | null;
  invoice_description: string | null;  // Price calculation display (e.g., "124" @ $8.50/inch - [9 pcs]")
  qb_description: string | null;
  qb_item_name: string | null;
  quantity: number;
  unit_price: number;
  extended_price: number;
  is_header_row?: boolean;
}

// ============================================================================
// Modal Props Types
// ============================================================================

export interface ImportFromEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  estimateId?: number;  // Linked estimate for auto-navigation
  targetParts: OrderPart[];
  onImportComplete: () => void;
}

export interface SelectSourceEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (estimate: ImportSourceEstimate) => void;
  linkedEstimateId?: number;  // Auto-navigate to this estimate
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
  targetParts: TargetOrderPart[];
  onCellSelectionChange: (rowId: string, column: CopyableColumn, selected: boolean) => void;
  onColumnHeaderClick: (column: CopyableColumn) => void;
  onRowRemove: (rowId: string) => void;
  onSlotDrop: (rowIds: string[], newSlotIndex: number) => void;
  onSourceDrop: (sourceIndices: number[], targetSlotIndex: number) => void;
  onClearAll: () => void;
}

// ============================================================================
// Import Instruction Types (for API call)
// ============================================================================

export interface OrderPartImportInstruction {
  targetPartId: number;
  qb_item_name?: string | null;
  qb_description?: string | null;
  quantity?: number;
  unit_price?: number;
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
