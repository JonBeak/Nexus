/**
 * ImportQBDescriptionsModal
 *
 * Modal for importing QB descriptions from other estimate versions.
 * Features a 3-column drag-drop interface with cell-level selection.
 *
 * Layout:
 * - Left: Source estimate selector + draggable rows
 * - Middle: Staging area (persists across source changes)
 * - Right: Current estimate rows (read-only preview)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { jobVersioningApi } from '../../../../services/jobVersioningApi';
import { SourceEstimatePanel } from './SourceEstimatePanel';
import { StagingPanel } from './StagingPanel';
import { TargetPreviewPanel } from './TargetPreviewPanel';
import {
  ImportQBDescriptionsModalProps,
  ImportSourceEstimate,
  SourcePreparationItem,
  StagedRow,
  CopyableColumn,
  ImportInstruction,
  COPYABLE_COLUMNS
} from './types';

export const ImportQBDescriptionsModal: React.FC<ImportQBDescriptionsModalProps> = ({
  isOpen,
  onClose,
  estimateId,
  jobId,
  targetItems,
  onImportComplete
}) => {
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

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedSourceId(null);
      setSelectedSourceName('');
      setSourceItems([]);
      setStagedRows([]);
      setImportError(null);
    }
  }, [isOpen]);

  // Handle source estimate selection
  const handleSourceSelect = useCallback(async (estimate: ImportSourceEstimate) => {
    setSelectedSourceId(estimate.id);
    setSelectedSourceName(`${estimate.job_name} v${estimate.version_number}`);
    setSourceLoading(true);
    setImportError(null);

    try {
      const response = await jobVersioningApi.getPreparationItems(estimate.id);
      console.log('[ImportModal] Preparation items response:', response);
      if (response.success) {
        const items = response.data || [];
        console.log('[ImportModal] Loaded', items.length, 'items from estimate', estimate.id);
        setSourceItems(items);
      } else {
        console.error('[ImportModal] API returned success=false:', response);
        setImportError('Failed to load source estimate items');
        setSourceItems([]);
      }
    } catch (error) {
      console.error('Error loading source items:', error);
      setImportError('Failed to load source estimate items');
      setSourceItems([]);
    } finally {
      setSourceLoading(false);
    }
  }, []);

  // Handle adding staged rows from source
  const handleStagedRowsAdd = useCallback((rows: StagedRow[]) => {
    setStagedRows(prev => [...prev, ...rows]);
  }, []);

  // Handle staged rows change (for reordering)
  const handleStagedRowsChange = useCallback((rows: StagedRow[]) => {
    setStagedRows(rows);
  }, []);

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
      // Build import instructions
      const imports: ImportInstruction[] = stagedRows.map((row, index) => {
        const instruction: ImportInstruction = {};

        // Check if we're updating an existing target row or creating new
        const targetItem = targetItems[index];
        if (targetItem) {
          instruction.targetItemId = targetItem.id;
        }

        // Add selected fields
        if (row.selectedCells.has('qb_description')) {
          instruction.qb_description = row.data.qb_description;
        }
        if (row.selectedCells.has('quantity')) {
          instruction.quantity = row.data.quantity;
        }
        if (row.selectedCells.has('unit_price')) {
          instruction.unit_price = row.data.unit_price;
        }

        // For new items (overflow rows), include all data
        if (!targetItem) {
          instruction.item_name = row.data.item_name;
          instruction.calculation_display = row.data.calculation_display;
          instruction.is_description_only = row.data.is_description_only;
          instruction.qb_item_id = row.data.qb_item_id;
          instruction.qb_item_name = row.data.qb_item_name;

          // For overflow rows, default to all columns selected
          if (!row.selectedCells.has('qb_description')) {
            instruction.qb_description = row.data.qb_description;
          }
          if (!row.selectedCells.has('quantity')) {
            instruction.quantity = row.data.quantity;
          }
          if (!row.selectedCells.has('unit_price')) {
            instruction.unit_price = row.data.unit_price;
          }
        }

        return instruction;
      });

      const response = await jobVersioningApi.importPreparationItems(estimateId, imports);

      if (response.success) {
        onImportComplete(response.data.items);
        onClose();
      } else {
        setImportError('Import failed');
      }
    } catch (error) {
      console.error('Error importing items:', error);
      setImportError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [stagedRows, targetItems, estimateId, onImportComplete, onClose]);

  if (!isOpen) return null;

  const overflowCount = Math.max(0, stagedRows.length - targetItems.length);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Download className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Import QB Descriptions
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

        {/* 3-Column Layout */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Column: Source Estimate Panel */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700">Copy From Estimate</h3>
            </div>
            <SourceEstimatePanel
              estimateId={estimateId}
              jobId={jobId}
              selectedSourceId={selectedSourceId}
              onSourceSelect={handleSourceSelect}
              sourceItems={sourceItems}
              sourceLoading={sourceLoading}
              onStagedRowsAdd={handleStagedRowsAdd}
              defaultSelectedColumns={defaultSelectedColumns}
            />
          </div>

          {/* Middle Column: Staging Panel */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">
                To Be Copied ({stagedRows.length})
              </h3>
              {stagedRows.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Clear All
                </button>
              )}
            </div>
            <StagingPanel
              stagedRows={stagedRows}
              onStagedRowsChange={handleStagedRowsChange}
              onCellSelectionChange={handleCellSelectionChange}
              onColumnHeaderClick={handleColumnHeaderClick}
              onRowRemove={handleRowRemove}
              onClearAll={handleClearAll}
            />
          </div>

          {/* Right Column: Target Preview Panel */}
          <div className="w-1/3 flex flex-col">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700">
                Current Estimate ({targetItems.length} rows)
              </h3>
            </div>
            <TargetPreviewPanel
              targetItems={targetItems}
              stagedRows={stagedRows}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {stagedRows.length > 0 ? (
              <>
                <span className="font-medium">{stagedRows.length}</span> row{stagedRows.length !== 1 ? 's' : ''} to import
                {overflowCount > 0 && (
                  <span className="ml-2 text-amber-600">
                    ({overflowCount} new row{overflowCount !== 1 ? 's' : ''} will be created)
                  </span>
                )}
              </>
            ) : (
              <span className="text-gray-400">Drag rows from source to staging area</span>
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
              disabled={stagedRows.length === 0 || importing}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Apply to Lines</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
