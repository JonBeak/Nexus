/**
 * SourceEstimatePanel
 *
 * Left column of the Import QB Descriptions modal.
 * Shows draggable source rows from the selected estimate.
 */

import React, { useState, useCallback } from 'react';
import { Loader2, GripVertical, FileText } from 'lucide-react';
import {
  SourceEstimatePanelProps,
  StagedRow
} from './types';

// Simple unique ID generator
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper to render text with preserved newlines
const renderWithNewlines = (text: string | null | undefined) => {
  if (!text) return null;
  // Handle \r, \n, \r\n, and escaped sequences
  return text.split(/\r\n|\r|\n/).map((line, i, arr) => (
    <span key={i}>
      {line}
      {i < arr.length - 1 && <br />}
    </span>
  ));
};

export const SourceEstimatePanel: React.FC<SourceEstimatePanelProps> = ({
  selectedSourceId,
  selectedSourceName,
  sourceItems,
  sourceLoading,
  onStagedRowsAdd,
  defaultSelectedColumns
}) => {
  // Row selection state for dragging
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Handle row click (with shift/ctrl support)
  const handleRowClick = useCallback((index: number, event: React.MouseEvent) => {
    if (event.shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const newSelection = new Set(selectedIndices);
      for (let i = start; i <= end; i++) {
        newSelection.add(i);
      }
      setSelectedIndices(newSelection);
    } else if (event.ctrlKey || event.metaKey) {
      const newSelection = new Set(selectedIndices);
      if (newSelection.has(index)) {
        newSelection.delete(index);
      } else {
        newSelection.add(index);
      }
      setSelectedIndices(newSelection);
    } else {
      // If clicking on the only selected row, deselect it
      if (selectedIndices.size === 1 && selectedIndices.has(index)) {
        setSelectedIndices(new Set());
      } else {
        setSelectedIndices(new Set([index]));
      }
    }
    setLastClickedIndex(index);
  }, [lastClickedIndex, selectedIndices]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (!selectedIndices.has(index)) {
      setSelectedIndices(new Set([index]));
    }
    setIsDragging(true);

    const indicesToDrag = selectedIndices.has(index)
      ? Array.from(selectedIndices).sort((a, b) => a - b)
      : [index];

    e.dataTransfer.setData('text/plain', JSON.stringify(indicesToDrag));
    e.dataTransfer.effectAllowed = 'copyMove';
  }, [selectedIndices]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle adding selected rows to staging
  const handleAddToStaging = useCallback(() => {
    if (selectedIndices.size === 0 || !selectedSourceId || !selectedSourceName) return;

    const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
    const newStagedRows: StagedRow[] = sortedIndices.map(index => {
      const item = sourceItems[index];
      return {
        id: generateId(),
        sourceEstimateId: selectedSourceId,
        sourceEstimateName: selectedSourceName,
        sourceLineIndex: index,
        data: item,
        selectedCells: new Set(defaultSelectedColumns),
        targetSlotIndex: 0  // Will be assigned by parent in handleStagedRowsAdd
      };
    });

    onStagedRowsAdd(newStagedRows);
    setSelectedIndices(new Set());
  }, [selectedIndices, sourceItems, selectedSourceId, selectedSourceName, defaultSelectedColumns, onStagedRowsAdd]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Source Rows List */}
      <div className="flex-1 overflow-y-auto">
        {sourceLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !selectedSourceId ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <FileText className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">
              Select a source estimate to view its rows
            </p>
          </div>
        ) : sourceItems.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            No prepared items in this estimate
          </div>
        ) : (
          <div>
            {sourceItems.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onClick={(e) => handleRowClick(index, e)}
                onDoubleClick={handleAddToStaging}
                className={`px-3 py-2 cursor-pointer select-none border-b border-gray-300 relative ${
                  selectedIndices.has(index)
                    ? 'before:absolute before:inset-0 before:ring-2 before:ring-inset before:ring-blue-600 before:z-50 before:pointer-events-none'
                    : 'hover:bg-gray-50'
                } ${isDragging && selectedIndices.has(index) ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className="font-medium">#{index + 1}</span>
                      <span className="truncate font-bold text-gray-700">{item.item_name}</span>
                    </div>
                    {item.qb_description && (
                      <div className="text-xs text-gray-700" style={{ wordBreak: 'break-word' }}>
                        {renderWithNewlines(item.qb_description)}
                      </div>
                    )}
                    {item.calculation_display && (
                      <div className="text-xs text-gray-400 mt-1" style={{ wordBreak: 'break-word' }}>
                        {renderWithNewlines(item.calculation_display)}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>Qty: {item.quantity}</span>
                      <span>{formatCurrency(item.unit_price)}</span>
                      <span className="font-medium">{formatCurrency(item.extended_price)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Button Footer */}
      {selectedSourceId && sourceItems.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleAddToStaging}
            disabled={selectedIndices.size === 0}
            className="w-full py-2 px-3 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Add {selectedIndices.size > 0 ? `${selectedIndices.size} Row${selectedIndices.size !== 1 ? 's' : ''}` : 'Selected Rows'} to Staging
          </button>
          <p className="text-xs text-gray-500 mt-1.5 text-center">
            Shift+click to select range, Ctrl+click to toggle
          </p>
        </div>
      )}
    </div>
  );
};
