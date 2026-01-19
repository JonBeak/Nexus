/**
 * ImportFromEstimateModal
 *
 * Modal for importing QB descriptions from estimate preparation items into order parts.
 * Features a 2-column drag-drop interface with cell-level selection.
 *
 * Layout:
 * - Left (20%): Source estimate rows (with button to select source)
 * - Right (80%): Combined staging + current order parts preview
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2 } from 'lucide-react';
import { api } from '@/services/apiClient';
import { orderPartsApi } from '@/services/api/orders/orderPartsApi';
import { SelectSourceEstimateModal } from './SelectSourceEstimateModal';
import { SourceEstimatePanel } from './SourceEstimatePanel';
import { CombinedStagingTargetPanel } from './CombinedStagingTargetPanel';
import {
  ImportFromEstimateModalProps,
  ImportSourceEstimate,
  SourcePreparationItem,
  StagedRow,
  CopyableColumn,
  TargetOrderPart,
  COPYABLE_COLUMNS
} from './types';

export const ImportFromEstimateModal: React.FC<ImportFromEstimateModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  estimateId,
  targetParts,
  onImportComplete
}) => {
  // Source selector modal state
  const [isSourceSelectorOpen, setIsSourceSelectorOpen] = useState(false);

  // Source selection state
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [selectedSourceName, setSelectedSourceName] = useState<string>('');
  const [sourceItems, setSourceItems] = useState<SourcePreparationItem[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);

  // Staged rows (persists across source changes)
  const [stagedRows, setStagedRows] = useState<StagedRow[]>([]);

  // Default column selection (QB Description only)
  const [defaultSelectedColumns] = useState<Set<CopyableColumn>>(
    new Set(['qb_description'])
  );

  // Import state
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Filter out header rows from target parts and convert to TargetOrderPart format
  const filteredTargetParts: TargetOrderPart[] = useMemo(() => {
    return targetParts
      .filter(p => !p.is_header_row)
      .map(p => ({
        part_id: p.part_id,
        display_number: p.display_number ?? null,
        product_type: p.product_type ?? null,
        qb_description: p.qb_description ?? null,
        qb_item_name: p.qb_item_name ?? null,
        quantity: p.quantity ?? 1,
        unit_price: p.unit_price ?? 0,
        extended_price: p.extended_price ?? 0
      }));
  }, [targetParts]);

  // Disable body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Reset state when modal closes, auto-open selector when modal opens
  useEffect(() => {
    if (isOpen) {
      // Auto-open source selector when modal opens (if no source selected)
      if (!selectedSourceId) {
        setIsSourceSelectorOpen(true);
      }
    } else {
      setSelectedSourceId(null);
      setSelectedSourceName('');
      setSourceItems([]);
      setStagedRows([]);
      setImportError(null);
      setIsSourceSelectorOpen(false);
    }
  }, [isOpen]);

  // Handle source estimate selection
  const handleSourceSelect = useCallback(async (estimate: ImportSourceEstimate) => {
    setSelectedSourceId(estimate.id);
    setSelectedSourceName(`${estimate.job_name} v${estimate.version_number}`);
    setSourceLoading(true);
    setImportError(null);

    try {
      const response = await api.get(`/job-estimation/estimates/${estimate.id}/preparation-items`);
      const items = response.data || [];
      // Filter out description-only items
      const productItems = items.filter((item: SourcePreparationItem) => !item.is_description_only);
      setSourceItems(productItems);

      if (productItems.length === 0) {
        setImportError('This estimate has no preparation items to import');
      }
    } catch (error) {
      console.error('Error loading source items:', error);
      setImportError('Failed to load source estimate items');
      setSourceItems([]);
    } finally {
      setSourceLoading(false);
    }
  }, []);

  // Get occupied slot indices
  const occupiedSlots = useMemo(() => {
    return new Set(stagedRows.map(r => r.targetSlotIndex));
  }, [stagedRows]);

  // Handle adding staged rows from source (assigns consecutively after last staged row)
  const handleStagedRowsAdd = useCallback((rows: StagedRow[]) => {
    setStagedRows(prev => {
      // Find the highest slot index among existing staged rows
      const maxSlot = prev.length > 0
        ? Math.max(...prev.map(r => r.targetSlotIndex))
        : -1;

      // Place new rows consecutively starting after the last staged row
      // If slot is a "new slot" (beyond existing items), auto-select all cells
      const rowsWithSlots = rows.map((row, index) => {
        const slotIndex = maxSlot + 1 + index;
        const isNewSlot = slotIndex >= filteredTargetParts.length;
        return {
          ...row,
          targetSlotIndex: slotIndex,
          // Auto-select all cells for new slots
          selectedCells: isNewSlot ? new Set(COPYABLE_COLUMNS) : row.selectedCells
        };
      });

      return [...prev, ...rowsWithSlots];
    });
  }, [filteredTargetParts.length]);

  // Handle slot drop (reposition staged rows to new slots)
  const handleSlotDrop = useCallback((rowIds: string[], newSlotIndex: number) => {
    setStagedRows(prev => {
      // Get the rows being moved, sorted by their current slot index
      const rowsToMove = rowIds
        .map(id => prev.find(r => r.id === id))
        .filter((r): r is StagedRow => r !== undefined)
        .sort((a, b) => a.targetSlotIndex - b.targetSlotIndex);

      if (rowsToMove.length === 0) return prev;

      // Helper to update cells based on whether slot is new
      const updateCellsForSlot = (row: StagedRow, slotIndex: number): StagedRow => {
        const isNewSlot = slotIndex >= filteredTargetParts.length;
        const wasNewSlot = row.targetSlotIndex >= filteredTargetParts.length;
        // Only update cells if moving into a new slot from an existing slot
        if (isNewSlot && !wasNewSlot) {
          return { ...row, targetSlotIndex: slotIndex, selectedCells: new Set(COPYABLE_COLUMNS) };
        }
        return { ...row, targetSlotIndex: slotIndex };
      };

      // If single row and target is occupied by a different row, swap
      if (rowsToMove.length === 1) {
        const rowToMove = rowsToMove[0];
        const existingRow = prev.find(r => r.targetSlotIndex === newSlotIndex && r.id !== rowToMove.id);

        if (existingRow) {
          // Swap slots
          return prev.map(row => {
            if (row.id === rowToMove.id) {
              return updateCellsForSlot(row, newSlotIndex);
            }
            if (row.id === existingRow.id) {
              return updateCellsForSlot(row, rowToMove.targetSlotIndex);
            }
            return row;
          });
        } else {
          // Just move to new slot
          return prev.map(row => {
            if (row.id === rowToMove.id) {
              return updateCellsForSlot(row, newSlotIndex);
            }
            return row;
          });
        }
      }

      // For multiple rows, assign to consecutive slots starting from newSlotIndex
      const movedIds = new Set(rowIds);
      const occupiedByMoved = new Set(rowsToMove.map(r => r.targetSlotIndex));

      // Get slots that will be occupied by moved rows
      const targetSlots = new Set<number>();
      for (let i = 0; i < rowsToMove.length; i++) {
        targetSlots.add(newSlotIndex + i);
      }

      // Find rows that need to be displaced
      const displacedRows = prev.filter(r => targetSlots.has(r.targetSlotIndex) && !movedIds.has(r.id));

      // Find available slots for displaced rows
      const availableSlots = Array.from(occupiedByMoved).filter(slot => !targetSlots.has(slot)).sort((a, b) => a - b);

      // Create mapping of displaced row id to new slot
      const displacementMap = new Map<string, number>();
      displacedRows.forEach((row, index) => {
        if (index < availableSlots.length) {
          displacementMap.set(row.id, availableSlots[index]);
        } else {
          let nextSlot = Math.max(...prev.map(r => r.targetSlotIndex)) + 1 + (index - availableSlots.length);
          displacementMap.set(row.id, nextSlot);
        }
      });

      return prev.map(row => {
        if (movedIds.has(row.id)) {
          const moveIndex = rowsToMove.findIndex(r => r.id === row.id);
          return updateCellsForSlot(row, newSlotIndex + moveIndex);
        }
        if (displacementMap.has(row.id)) {
          return updateCellsForSlot(row, displacementMap.get(row.id)!);
        }
        return row;
      });
    });
  }, [filteredTargetParts.length]);

  // Simple unique ID generator
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Handle drop from source panel directly to a slot
  const handleSourceDrop = useCallback((sourceIndices: number[], targetSlotIndex: number) => {
    if (!selectedSourceId || !selectedSourceName || sourceIndices.length === 0) {
      return;
    }

    setStagedRows(prev => {
      const currentOccupied = new Set(prev.map(r => r.targetSlotIndex));
      let nextSlot = targetSlotIndex;

      const newRows: StagedRow[] = sourceIndices.map(index => {
        const item = sourceItems[index];
        if (!item) {
          return null;
        }
        // Find next available slot starting from targetSlotIndex
        while (currentOccupied.has(nextSlot)) {
          nextSlot++;
        }
        currentOccupied.add(nextSlot);
        const slotForThisRow = nextSlot;
        nextSlot++;

        // Auto-select all cells for new slots (beyond existing items)
        const isNewSlot = slotForThisRow >= filteredTargetParts.length;
        const selectedCells = isNewSlot
          ? new Set(COPYABLE_COLUMNS)
          : new Set(defaultSelectedColumns);

        return {
          id: generateId(),
          sourceEstimateId: selectedSourceId,
          sourceEstimateName: selectedSourceName,
          sourceLineIndex: index,
          data: item,
          selectedCells,
          targetSlotIndex: slotForThisRow
        };
      }).filter((row): row is StagedRow => row !== null);

      return [...prev, ...newRows];
    });
  }, [selectedSourceId, selectedSourceName, sourceItems, defaultSelectedColumns, filteredTargetParts.length]);

  // Handle cell selection change
  const handleCellSelectionChange = useCallback((
    rowId: string,
    column: CopyableColumn,
    selected: boolean
  ) => {
    setStagedRows(prev => prev.map(row => {
      if (row.id === rowId) {
        const newSelected = new Set(row.selectedCells);
        if (selected) {
          newSelected.add(column);
        } else {
          newSelected.delete(column);
        }
        return { ...row, selectedCells: newSelected };
      }
      return row;
    }));
  }, []);

  // Handle column header click (toggle all cells in column)
  const handleColumnHeaderClick = useCallback((column: CopyableColumn) => {
    setStagedRows(prev => {
      // Check if all rows have this column selected
      const allSelected = prev.every(row => row.selectedCells.has(column));

      return prev.map(row => {
        const newSelected = new Set(row.selectedCells);
        if (allSelected) {
          newSelected.delete(column);
        } else {
          newSelected.add(column);
        }
        return { ...row, selectedCells: newSelected };
      });
    });
  }, []);

  // Handle row removal
  const handleRowRemove = useCallback((rowId: string) => {
    setStagedRows(prev => prev.filter(row => row.id !== rowId));
  }, []);

  // Handle clear all staged rows
  const handleClearAll = useCallback(() => {
    setStagedRows([]);
  }, []);

  // Handle import/apply
  const handleApply = useCallback(async () => {
    if (stagedRows.length === 0) return;

    setImporting(true);
    setImportError(null);

    try {
      // Build import instructions from staged rows
      const imports = stagedRows
        .filter(row => row.selectedCells.size > 0)
        .map(row => {
          // Get target part for this slot
          const targetPart = filteredTargetParts[row.targetSlotIndex];
          if (!targetPart) {
            // Skip new rows for now (import to existing parts only)
            return null;
          }

          const instruction: {
            targetPartId: number;
            qb_item_name?: string | null;
            qb_description?: string | null;
            quantity?: number;
            unit_price?: number;
          } = {
            targetPartId: targetPart.part_id
          };

          if (row.selectedCells.has('qb_item')) {
            instruction.qb_item_name = row.data.qb_item_name;
          }
          if (row.selectedCells.has('qb_description')) {
            instruction.qb_description = row.data.qb_description;
          }
          if (row.selectedCells.has('quantity')) {
            instruction.quantity = row.data.quantity;
          }
          if (row.selectedCells.has('unit_price')) {
            instruction.unit_price = row.data.unit_price;
          }

          return instruction;
        })
        .filter((i): i is NonNullable<typeof i> => i !== null);

      if (imports.length === 0) {
        setImportError('No valid imports to apply');
        setImporting(false);
        return;
      }

      await orderPartsApi.importFromEstimate(orderNumber, imports);
      onImportComplete();
      onClose();
    } catch (error) {
      console.error('Error importing items:', error);
      setImportError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [stagedRows, filteredTargetParts, orderNumber, onImportComplete, onClose]);

  if (!isOpen) return null;

  // Count how many staged rows will update existing parts
  const updateCount = stagedRows.filter(r => r.targetSlotIndex < filteredTargetParts.length && r.selectedCells.size > 0).length;
  const newRowCount = stagedRows.filter(r => r.targetSlotIndex >= filteredTargetParts.length).length;

  return createPortal(
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9998,
          backgroundColor: 'rgba(0, 0, 0, 0.5)'
        }}
      >
        <div className="bg-white rounded-lg w-full max-h-[90vh] flex flex-col mx-4" style={{ maxWidth: '95vw' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <Download className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Import QB Descriptions from Estimate
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
              disabled={importing}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Error Message */}
          {importError && (
            <div className="px-6 py-3 bg-red-50 border-b border-red-200">
              <p className="text-sm text-red-700">{importError}</p>
            </div>
          )}

          {/* 2-Column Layout: Source | Combined Staging+Target */}
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* Left Column: Source Estimate Panel */}
            <div style={{ width: '20%' }} className="border-r border-gray-200 flex flex-col">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2 shrink-0">
                <h3 className="text-sm font-medium text-gray-700 shrink-0">Source Rows</h3>
                <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                  {selectedSourceName && (
                    <span className="text-xs text-gray-500 truncate">{selectedSourceName}</span>
                  )}
                  <button
                    onClick={() => setIsSourceSelectorOpen(true)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0"
                  >
                    {selectedSourceId ? 'Change' : 'Select...'}
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <SourceEstimatePanel
                  selectedSourceId={selectedSourceId}
                  selectedSourceName={selectedSourceName}
                  sourceItems={sourceItems}
                  sourceLoading={sourceLoading}
                  onStagedRowsAdd={handleStagedRowsAdd}
                  defaultSelectedColumns={defaultSelectedColumns}
                />
              </div>
            </div>

            {/* Right Column: Combined Staging + Target Panel */}
            <div style={{ width: '80%' }} className="flex flex-col">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-700">
                  Import Preview
                </h3>
              </div>
              <CombinedStagingTargetPanel
                stagedRows={stagedRows}
                targetParts={filteredTargetParts}
                onCellSelectionChange={handleCellSelectionChange}
                onColumnHeaderClick={handleColumnHeaderClick}
                onRowRemove={handleRowRemove}
                onSlotDrop={handleSlotDrop}
                onSourceDrop={handleSourceDrop}
                onClearAll={handleClearAll}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {stagedRows.length > 0 ? (
                <>
                  <span className="font-medium">{stagedRows.length}</span> row{stagedRows.length !== 1 ? 's' : ''} to import
                  {updateCount > 0 && (
                    <span className="ml-2 text-amber-600">
                      ({updateCount} update{updateCount !== 1 ? 's' : ''})
                    </span>
                  )}
                  {newRowCount > 0 && (
                    <span className="ml-2 text-gray-400">
                      ({newRowCount} beyond target - skipped)
                    </span>
                  )}
                </>
              ) : (
                <span className="text-gray-400">Select rows from source to import</span>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                disabled={importing}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={stagedRows.length === 0 || importing || updateCount === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Apply to Order Parts</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Source Estimate Selector Modal */}
      <SelectSourceEstimateModal
        isOpen={isSourceSelectorOpen}
        onClose={() => setIsSourceSelectorOpen(false)}
        onSelect={handleSourceSelect}
        linkedEstimateId={estimateId}
      />
    </>,
    document.body
  );
};

export default ImportFromEstimateModal;
