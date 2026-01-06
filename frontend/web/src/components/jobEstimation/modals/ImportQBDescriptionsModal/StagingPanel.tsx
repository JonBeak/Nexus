/**
 * StagingPanel
 *
 * Middle column of the Import QB Descriptions modal.
 * Displays staged rows with cell-level selection.
 */

import React, { useState, useCallback } from 'react';
import { Trash2, GripVertical } from 'lucide-react';
import {
  StagingPanelProps,
  StagedRow,
  CopyableColumn,
  COPYABLE_COLUMNS
} from './types';

export const StagingPanel: React.FC<StagingPanelProps> = ({
  stagedRows,
  onStagedRowsChange,
  onCellSelectionChange,
  onColumnHeaderClick,
  onRowRemove,
  onClearAll
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // Handle drop (from source panel)
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // The actual drop handling is done in the source panel via drag events
    // This just provides visual feedback
  }, []);

  // Check if all rows have a column selected
  const isColumnFullySelected = useCallback((column: CopyableColumn) => {
    if (stagedRows.length === 0) return false;
    return stagedRows.every(row => row.selectedCells.has(column));
  }, [stagedRows]);

  // Check if any rows have a column selected
  const isColumnPartiallySelected = useCallback((column: CopyableColumn) => {
    if (stagedRows.length === 0) return false;
    const selected = stagedRows.filter(row => row.selectedCells.has(column)).length;
    return selected > 0 && selected < stagedRows.length;
  }, [stagedRows]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Get cell class based on selection state
  const getCellClass = (row: StagedRow, column: CopyableColumn) => {
    const isSelected = row.selectedCells.has(column);
    return `px-2 py-1 cursor-pointer border ${
      isSelected
        ? 'bg-blue-100 border-blue-300'
        : 'bg-white border-gray-200 hover:bg-gray-50'
    }`;
  };

  // Get non-copyable cell class
  const getNonCopyableCellClass = () => {
    return 'px-2 py-1 bg-gray-100 border border-gray-200 text-gray-500';
  };

  // Get column header class
  const getColumnHeaderClass = (column: CopyableColumn) => {
    const isFullySelected = isColumnFullySelected(column);
    const isPartiallySelected = isColumnPartiallySelected(column);
    return `px-2 py-1.5 text-xs font-medium cursor-pointer border-b ${
      isFullySelected
        ? 'bg-blue-200 text-blue-800'
        : isPartiallySelected
        ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
    }`;
  };

  return (
    <div
      className={`flex flex-col h-full ${isDragOver ? 'bg-green-50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {stagedRows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-4">
          <div className="text-center">
            <p className="text-sm mb-2">Drop rows here</p>
            <p className="text-xs">
              or double-click rows in the source panel
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Column Headers */}
          <div className="flex border-b border-gray-200 bg-gray-50 text-xs font-medium">
            <div className="w-8 px-2 py-1.5 text-gray-400">#</div>
            <div
              className={getColumnHeaderClass('qb_description')}
              onClick={() => onColumnHeaderClick('qb_description')}
              title="Click to toggle all QB descriptions"
              style={{ flex: 3 }}
            >
              QB Description
            </div>
            <div
              className={getColumnHeaderClass('quantity')}
              onClick={() => onColumnHeaderClick('quantity')}
              title="Click to toggle all quantities"
              style={{ width: '60px' }}
            >
              Qty
            </div>
            <div
              className={getColumnHeaderClass('unit_price')}
              onClick={() => onColumnHeaderClick('unit_price')}
              title="Click to toggle all unit prices"
              style={{ width: '80px' }}
            >
              Unit$
            </div>
            <div className="w-8"></div>
          </div>

          {/* Staged Rows */}
          <div className="flex-1 overflow-y-auto">
            {stagedRows.map((row, index) => (
              <div
                key={row.id}
                className="flex border-b border-gray-100 text-sm hover:bg-gray-50"
              >
                {/* Row Number */}
                <div className="w-8 px-2 py-1.5 text-xs text-gray-400 flex items-center">
                  {index + 1}
                </div>

                {/* QB Description Cell */}
                <div
                  className={getCellClass(row, 'qb_description')}
                  style={{ flex: 3 }}
                  onClick={() => onCellSelectionChange(
                    row.id,
                    'qb_description',
                    !row.selectedCells.has('qb_description')
                  )}
                  title={row.selectedCells.has('qb_description') ? 'Click to deselect' : 'Click to select'}
                >
                  <div className="line-clamp-2 text-xs">
                    {row.data.qb_description || (
                      <span className="text-gray-400 italic">No description</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {row.sourceEstimateName}
                  </div>
                </div>

                {/* Quantity Cell */}
                <div
                  className={getCellClass(row, 'quantity')}
                  style={{ width: '60px' }}
                  onClick={() => onCellSelectionChange(
                    row.id,
                    'quantity',
                    !row.selectedCells.has('quantity')
                  )}
                  title={row.selectedCells.has('quantity') ? 'Click to deselect' : 'Click to select'}
                >
                  <div className="text-xs text-center">
                    {row.data.quantity}
                  </div>
                </div>

                {/* Unit Price Cell */}
                <div
                  className={getCellClass(row, 'unit_price')}
                  style={{ width: '80px' }}
                  onClick={() => onCellSelectionChange(
                    row.id,
                    'unit_price',
                    !row.selectedCells.has('unit_price')
                  )}
                  title={row.selectedCells.has('unit_price') ? 'Click to deselect' : 'Click to select'}
                >
                  <div className="text-xs text-right">
                    {formatCurrency(row.data.unit_price)}
                  </div>
                </div>

                {/* Remove Button */}
                <div className="w-8 flex items-center justify-center">
                  <button
                    onClick={() => onRowRemove(row.id)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                    title="Remove row"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Legend */}
          <div className="p-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-white border border-gray-200 rounded"></div>
                <span>Not copied</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
