/**
 * CombinedStagingTargetPanel
 *
 * Combined panel showing "To Be Copied" and "Current Estimate" side by side.
 * Features:
 * - Slot-based system where staged rows can be assigned to any position
 * - Synchronized row heights between both sections
 * - Single scroll context for both sections
 * - Drag-and-drop to reposition staged rows
 * - Accepts drops from Source panel
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import {
  StagedRow,
  CopyableColumn,
  CombinedStagingTargetPanelProps
} from './types';

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

export const CombinedStagingTargetPanel: React.FC<CombinedStagingTargetPanelProps> = ({
  stagedRows,
  targetItems,
  onCellSelectionChange,
  onColumnHeaderClick,
  onRowRemove,
  onSlotDrop,
  onSourceDrop,
  onClearAll
}) => {
  const [draggedRowIds, setDraggedRowIds] = useState<Set<string>>(new Set());
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  // Multi-select state for staged rows
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [lastClickedRowId, setLastClickedRowId] = useState<string | null>(null);

  // Calculate total slots needed
  const totalSlots = useMemo(() => {
    const maxStagedSlot = stagedRows.length > 0
      ? Math.max(...stagedRows.map(r => r.targetSlotIndex))
      : -1;
    return Math.max(targetItems.length, maxStagedSlot + 1);
  }, [stagedRows, targetItems]);

  // Create a map of slot index to staged row
  const slotToStagedRow = useMemo(() => {
    const map = new Map<number, StagedRow>();
    stagedRows.forEach(row => {
      map.set(row.targetSlotIndex, row);
    });
    return map;
  }, [stagedRows]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Check if all staged rows have a column selected
  const isColumnFullySelected = useCallback((column: CopyableColumn) => {
    if (stagedRows.length === 0) return false;
    return stagedRows.every(row => row.selectedCells.has(column));
  }, [stagedRows]);

  // Check if any staged rows have a column selected
  const isColumnPartiallySelected = useCallback((column: CopyableColumn) => {
    if (stagedRows.length === 0) return false;
    const selected = stagedRows.filter(row => row.selectedCells.has(column)).length;
    return selected > 0 && selected < stagedRows.length;
  }, [stagedRows]);

  // Get cell class based on selection state
  const getCellClass = (row: StagedRow, column: CopyableColumn) => {
    const isSelected = row.selectedCells.has(column);
    return `px-2 py-1.5 cursor-pointer border-r border-gray-200 ${
      isSelected
        ? 'bg-blue-100 ring-2 ring-inset ring-blue-400'
        : 'bg-white hover:bg-gray-50'
    }`;
  };

  // Get column header class for staging section
  const getStagingHeaderClass = (column: CopyableColumn) => {
    const isFullySelected = isColumnFullySelected(column);
    const isPartiallySelected = isColumnPartiallySelected(column);
    return `px-2 py-1.5 text-xs font-medium cursor-pointer border-r border-gray-200 ${
      isFullySelected
        ? 'bg-blue-200 text-blue-800'
        : isPartiallySelected
        ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
    }`;
  };

  // Get ordered list of staged row IDs by their slot index
  const orderedStagedRowIds = useMemo(() => {
    return [...stagedRows].sort((a, b) => a.targetSlotIndex - b.targetSlotIndex).map(r => r.id);
  }, [stagedRows]);

  // Handle row click (with shift/ctrl support for multi-select)
  const handleRowClick = useCallback((rowId: string, event: React.MouseEvent) => {
    // Don't trigger selection if clicking on a cell (for cell selection)
    const target = event.target as HTMLElement;
    if (target.closest('[data-cell-selectable]')) {
      return;
    }

    const rowIndex = orderedStagedRowIds.indexOf(rowId);
    const lastIndex = lastClickedRowId ? orderedStagedRowIds.indexOf(lastClickedRowId) : -1;

    if (event.shiftKey && lastIndex !== -1 && rowIndex !== -1) {
      // Shift+click: select range
      const start = Math.min(lastIndex, rowIndex);
      const end = Math.max(lastIndex, rowIndex);
      const newSelection = new Set(selectedRowIds);
      for (let i = start; i <= end; i++) {
        newSelection.add(orderedStagedRowIds[i]);
      }
      setSelectedRowIds(newSelection);
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl+click: toggle selection
      const newSelection = new Set(selectedRowIds);
      if (newSelection.has(rowId)) {
        newSelection.delete(rowId);
      } else {
        newSelection.add(rowId);
      }
      setSelectedRowIds(newSelection);
    } else {
      // Regular click: if clicking on the only selected row, deselect it
      if (selectedRowIds.size === 1 && selectedRowIds.has(rowId)) {
        setSelectedRowIds(new Set());
      } else {
        setSelectedRowIds(new Set([rowId]));
      }
    }
    setLastClickedRowId(rowId);
  }, [orderedStagedRowIds, lastClickedRowId, selectedRowIds]);

  // Drag handlers for internal repositioning
  const handleDragStart = useCallback((e: React.DragEvent, rowId: string) => {
    // If the dragged row isn't selected, select it (and only it)
    let rowsToDrag: Set<string>;
    if (!selectedRowIds.has(rowId)) {
      rowsToDrag = new Set([rowId]);
      setSelectedRowIds(rowsToDrag);
    } else {
      rowsToDrag = selectedRowIds;
    }

    setDraggedRowIds(rowsToDrag);
    e.dataTransfer.effectAllowed = 'move';
    // Store all selected row IDs as JSON array
    e.dataTransfer.setData('application/x-staged-rows', JSON.stringify(Array.from(rowsToDrag)));
  }, [selectedRowIds]);

  const handleDragEnd = useCallback(() => {
    setDraggedRowIds(new Set());
    setDragOverSlot(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    // Accept both 'copy' (from source panel) and 'move' (internal reorder)
    // Use 'copy' when source uses effectAllowed='copy', otherwise 'move'
    if (e.dataTransfer.effectAllowed === 'copy' || e.dataTransfer.effectAllowed === 'copyMove') {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'move';
    }
    setDragOverSlot(slotIndex);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverSlot(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if it's an internal reorder (staged rows - multiple)
    const stagedRowsData = e.dataTransfer.getData('application/x-staged-rows');
    if (stagedRowsData) {
      try {
        const rowIds = JSON.parse(stagedRowsData);
        console.log('[CombinedPanel] Internal reorder drop:', rowIds, 'to slot', slotIndex);
        if (Array.isArray(rowIds) && rowIds.length > 0) {
          onSlotDrop(rowIds, slotIndex);
        }
      } catch (err) {
        console.error('[CombinedPanel] Failed to parse staged rows data:', err);
      }
      setDragOverSlot(null);
      setDraggedRowIds(new Set());
      setSelectedRowIds(new Set());
      return;
    }

    // Check if it's from source panel (JSON array of indices)
    const sourceData = e.dataTransfer.getData('text/plain');
    console.log('[CombinedPanel] Source drop data:', sourceData, 'to slot', slotIndex);
    if (sourceData) {
      try {
        const indices = JSON.parse(sourceData);
        console.log('[CombinedPanel] Parsed indices:', indices);
        if (Array.isArray(indices)) {
          console.log('[CombinedPanel] Calling onSourceDrop with', indices.length, 'indices');
          onSourceDrop(indices, slotIndex);
        }
      } catch (err) {
        console.error('[CombinedPanel] Failed to parse source data:', err);
      }
    }

    setDragOverSlot(null);
    setDraggedRowIds(new Set());
  }, [onSlotDrop, onSourceDrop]);

  // Render a slot row
  const renderSlotRow = (slotIndex: number) => {
    const stagedRow = slotToStagedRow.get(slotIndex);
    const targetItem = targetItems[slotIndex];
    const isNewRow = slotIndex >= targetItems.length;
    const isDraggedOver = dragOverSlot === slotIndex;
    const isBeingDragged = stagedRow && draggedRowIds.has(stagedRow.id);
    const isSelected = stagedRow && selectedRowIds.has(stagedRow.id);

    // Check which target cells will be changed
    const qbItemWillChange = stagedRow?.selectedCells.has('qb_item');
    const qbDescWillChange = stagedRow?.selectedCells.has('qb_description');
    const qtyWillChange = stagedRow?.selectedCells.has('quantity');
    const priceWillChange = stagedRow?.selectedCells.has('unit_price');

    return (
      <div
        key={slotIndex}
        className="flex border-b text-xs select-none"
        onClick={(e) => stagedRow && handleRowClick(stagedRow.id, e)}
        onDragOver={(e) => handleDragOver(e, slotIndex)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, slotIndex)}
      >
        {/* Slot Number + To Be Copied wrapper for selection border */}
        <div className={`flex shrink-0 relative ${isDraggedOver ? 'bg-green-50' : ''} ${isBeingDragged ? 'opacity-50' : ''} ${isSelected ? 'before:absolute before:inset-0 before:ring-2 before:ring-inset before:ring-blue-600 before:z-50 before:pointer-events-none' : ''}`} style={{ width: 'calc(51% + 32px)' }}>
          {/* Slot Number */}
          <div className={`w-8 px-1 py-1.5 text-center shrink-0 border-r border-gray-200 ${
            isNewRow ? 'bg-green-50 text-green-600' : 'text-gray-400'
          }`}>
            {isNewRow ? <Plus className="w-3 h-3 inline" /> : null}
            {slotIndex + 1}
          </div>

          {/* === TO BE COPIED SECTION === */}
          <div className="flex flex-1">
          {stagedRow ? (
            <>
              {/* Drag Handle */}
              <div
                className="w-6 px-1 py-1.5 cursor-grab flex items-start justify-center shrink-0 bg-gray-300"
                draggable
                onDragStart={(e) => handleDragStart(e, stagedRow.id)}
                onDragEnd={handleDragEnd}
              >
                <GripVertical className="w-3 h-3 text-gray-500" />
              </div>

              {/* QB Item */}
              <div
                data-cell-selectable
                className={`w-32 shrink-0 ${getCellClass(stagedRow, 'qb_item')}`}
                onClick={() => onCellSelectionChange(stagedRow.id, 'qb_item', !stagedRow.selectedCells.has('qb_item'))}
              >
                {stagedRow.data.qb_item_name || <span className="text-gray-400 italic">-</span>}
              </div>

              {/* QB Description */}
              <div
                data-cell-selectable
                className={`flex-1 min-w-0 ${getCellClass(stagedRow, 'qb_description')}`}
                onClick={() => onCellSelectionChange(stagedRow.id, 'qb_description', !stagedRow.selectedCells.has('qb_description'))}
              >
                <div style={{ wordBreak: 'break-word' }}>
                  {renderWithNewlines(stagedRow.data.qb_description)}
                </div>
              </div>

              {/* Calculation (non-copyable) */}
              <div className="w-40 px-2 py-1.5 bg-gray-300 border-r border-gray-200 text-gray-600 shrink-0" style={{ wordBreak: 'break-word' }}>
                {renderWithNewlines(stagedRow.data.calculation_display)}
              </div>

              {/* Qty */}
              <div
                data-cell-selectable
                className={`w-10 shrink-0 ${getCellClass(stagedRow, 'quantity')}`}
                onClick={() => onCellSelectionChange(stagedRow.id, 'quantity', !stagedRow.selectedCells.has('quantity'))}
              >
                <div className="text-center">{stagedRow.data.quantity}</div>
              </div>

              {/* Unit Price */}
              <div
                data-cell-selectable
                className={`w-16 shrink-0 ${getCellClass(stagedRow, 'unit_price')}`}
                onClick={() => onCellSelectionChange(stagedRow.id, 'unit_price', !stagedRow.selectedCells.has('unit_price'))}
              >
                <div className="text-right">{formatCurrency(stagedRow.data.unit_price)}</div>
              </div>

              {/* Remove */}
              <div className="w-6 flex items-start justify-center py-1 shrink-0 bg-gray-300">
                <button
                  onClick={() => onRowRemove(stagedRow.id)}
                  className="p-0.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </>
          ) : (
            // Empty slot
            <div className={`flex-1 px-3 py-2 text-gray-400 italic text-center border-r border-gray-200 ${
              isDraggedOver ? 'bg-green-100 text-green-600' : 'bg-gray-50'
            }`}>
              {isDraggedOver ? 'Drop here' : ''}
            </div>
          )}
          </div>
        </div>

        {/* Divider - extends beyond row to cover horizontal borders */}
        <div className="w-0.5 bg-gray-500 shrink-0 z-10 self-stretch" style={{ margin: '-1px 0' }} />

        {/* === CURRENT ESTIMATE SECTION === */}
        <div className="flex flex-1">
          {targetItem ? (
            <>
              {/* QB Item */}
              <div className={`w-32 px-2 py-1.5 border-r border-gray-200 shrink-0 ${
                qbItemWillChange ? 'bg-amber-50 ring-2 ring-inset ring-amber-400' : 'text-gray-600'
              }`}>
                {qbItemWillChange ? (
                  <>
                    <div className="text-amber-700 font-medium">{stagedRow!.data.qb_item_name || '-'}</div>
                    {stagedRow!.data.qb_item_name !== targetItem.qb_item_name && (
                      <div className="text-gray-400 line-through">{targetItem.qb_item_name || '-'}</div>
                    )}
                  </>
                ) : (
                  targetItem.qb_item_name || <span className="text-gray-400 italic">-</span>
                )}
              </div>

              {/* QB Description */}
              <div className={`flex-1 min-w-0 px-2 py-1.5 border-r border-gray-200 ${
                qbDescWillChange ? 'bg-amber-50 ring-2 ring-inset ring-amber-400' : ''
              }`}>
                <div style={{ wordBreak: 'break-word' }}>
                  {qbDescWillChange ? (
                    <span className="text-amber-700 font-medium">
                      {renderWithNewlines(stagedRow!.data.qb_description)}
                    </span>
                  ) : (
                    renderWithNewlines(targetItem.qb_description)
                  )}
                </div>
                {qbDescWillChange && targetItem.qb_description && stagedRow!.data.qb_description !== targetItem.qb_description && (
                  <div className="text-gray-400 line-through mt-1" style={{ wordBreak: 'break-word' }}>
                    {renderWithNewlines(targetItem.qb_description)}
                  </div>
                )}
              </div>

              {/* Calculation (non-copyable) */}
              <div className="w-40 px-2 py-1.5 border-r border-gray-200 text-gray-500 shrink-0" style={{ wordBreak: 'break-word' }}>
                {renderWithNewlines(targetItem.calculation_display) || <span className="text-gray-400 italic">-</span>}
              </div>

              {/* Qty */}
              <div className={`w-10 px-2 py-1.5 text-center border-r border-gray-200 shrink-0 ${
                qtyWillChange ? 'bg-amber-50 ring-2 ring-inset ring-amber-400' : ''
              }`}>
                {qtyWillChange ? (
                  <>
                    <div className="text-amber-700 font-medium">{stagedRow!.data.quantity}</div>
                    {stagedRow!.data.quantity !== targetItem.quantity && (
                      <div className="text-gray-400 line-through">{targetItem.quantity}</div>
                    )}
                  </>
                ) : (
                  targetItem.quantity
                )}
              </div>

              {/* Unit Price */}
              <div className={`w-16 px-2 py-1.5 text-right shrink-0 ${
                priceWillChange ? 'bg-amber-50 ring-2 ring-inset ring-amber-400' : ''
              }`}>
                {priceWillChange ? (
                  <>
                    <div className="text-amber-700 font-medium">{formatCurrency(stagedRow!.data.unit_price)}</div>
                    {stagedRow!.data.unit_price !== targetItem.unit_price && (
                      <div className="text-gray-400 line-through">{formatCurrency(targetItem.unit_price)}</div>
                    )}
                  </>
                ) : (
                  formatCurrency(targetItem.unit_price)
                )}
              </div>
            </>
          ) : (
            // New row indicator
            <div className="flex-1 px-3 py-2 bg-green-50 text-green-600 italic">
              New row will be created
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable Area - Labels + Headers + Rows */}
      <div className="flex-1 overflow-y-auto">
        {/* Section Labels - Sticky */}
        <div className="flex border-b border-gray-200 bg-gray-100 text-xs sticky top-0 z-20 select-none">
          <div className="w-8 border-r border-gray-200 shrink-0" />
          <div className="py-1.5 px-2 text-blue-700 font-medium flex items-center justify-between shrink-0" style={{ width: '51%' }}>
            <span>To Be Copied ({stagedRows.length})</span>
            {stagedRows.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-red-600 hover:text-red-700"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="w-0.5 bg-gray-500 shrink-0 z-10 self-stretch" style={{ margin: '-1px 0' }} />
          <div className="flex-1 py-1.5 px-2 text-gray-700 font-medium">
            Current Estimate ({targetItems.length})
          </div>
        </div>

        {/* Column Headers - Sticky below section labels */}
        <div className="flex border-b border-gray-300 text-xs font-medium sticky top-[26px] z-10 select-none">
          {/* Slot # */}
          <div className="w-8 px-1 py-1.5 text-gray-500 text-center border-r border-gray-200 bg-gray-50 shrink-0">#</div>

          {/* To Be Copied Header */}
          <div className="flex shrink-0" style={{ width: '51%' }}>
            <div className="w-6 shrink-0 bg-gray-50" /> {/* drag handle space */}
            <div
              className={`w-32 shrink-0 ${getStagingHeaderClass('qb_item')}`}
              onClick={() => onColumnHeaderClick('qb_item')}
            >
              QB Item
            </div>
            <div
              className={`flex-1 min-w-0 ${getStagingHeaderClass('qb_description')}`}
              onClick={() => onColumnHeaderClick('qb_description')}
            >
              QB Description
            </div>
            <div className="w-40 px-2 py-1.5 text-gray-600 border-r border-gray-200 shrink-0 bg-gray-50">Calculation Display</div>
            <div
              className={`w-10 shrink-0 ${getStagingHeaderClass('quantity')}`}
              onClick={() => onColumnHeaderClick('quantity')}
            >
              Qty
            </div>
            <div
              className={`w-16 shrink-0 ${getStagingHeaderClass('unit_price')}`}
              onClick={() => onColumnHeaderClick('unit_price')}
            >
              Unit$
            </div>
            <div className="w-6 shrink-0 bg-gray-50" /> {/* remove button space */}
          </div>

          {/* Divider */}
          <div className="w-0.5 bg-gray-500 shrink-0 z-10 self-stretch" style={{ margin: '-1px 0' }} />

          {/* Current Estimate Header */}
          <div className="flex flex-1 bg-gray-50">
            <div className="w-32 px-2 py-1.5 text-gray-600 border-r border-gray-200 shrink-0">QB Item</div>
            <div className="flex-1 min-w-0 px-2 py-1.5 text-gray-600 border-r border-gray-200">QB Description</div>
            <div className="w-40 px-2 py-1.5 text-gray-600 border-r border-gray-200 shrink-0">Calculation Display</div>
            <div className="w-10 px-2 py-1.5 text-gray-600 text-center border-r border-gray-200 shrink-0">Qty</div>
            <div className="w-16 px-2 py-1.5 text-gray-600 text-right shrink-0">Unit$</div>
          </div>
        </div>
        {Array.from({ length: totalSlots }, (_, i) => renderSlotRow(i))}

        {/* Add New Slot Row */}
        <div
          className="flex border-b border-dashed border-gray-300 text-xs"
          onDragOver={(e) => handleDragOver(e, totalSlots)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, totalSlots)}
        >
          <div className={`w-8 px-1 py-2 text-center shrink-0 border-r border-gray-200 ${
            dragOverSlot === totalSlots ? 'bg-green-100 text-green-600' : 'text-gray-400'
          }`}>
            <Plus className="w-3 h-3 inline" />
          </div>
          <div className={`flex-1 px-3 py-2 text-gray-400 ${
            dragOverSlot === totalSlots ? 'bg-green-100 text-green-600' : ''
          }`}>
            {dragOverSlot === totalSlots ? 'Drop here to add new row' : 'Drag here to add new row'}
          </div>
        </div>
      </div>

      {/* Footer Legend */}
      <div className="p-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-100 ring-2 ring-inset ring-blue-400 rounded" />
              <span>Will copy</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-amber-50 ring-2 ring-inset ring-amber-400 rounded" />
              <span>Will change</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-50 border border-green-300 rounded" />
              <span>New row</span>
            </div>
          </div>
          <div className="text-gray-400">
            Shift+click to select range, Ctrl+click to toggle, drag to reorder
          </div>
        </div>
      </div>
    </div>
  );
};
