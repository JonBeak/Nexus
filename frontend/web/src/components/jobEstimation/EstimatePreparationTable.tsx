/**
 * EstimatePreparationTable
 *
 * Editable table for preparation items that get sent 1:1 to QuickBooks.
 * Replaces the read-only EstimateTable after "Prepare to Send".
 *
 * Features:
 * - Inline editing for all cells
 * - Row type toggle (Regular <-> Description Only)
 * - QB Item dropdown for regular items
 * - Add/delete rows
 * - Auto-save on blur
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { jobVersioningApi } from '../../services/jobVersioningApi';
import { QBItemDropdown } from './components/QBItemDropdown';
import { EditableCell } from './components/EditableCell';
import { ImportQBDescriptionsModal } from './modals/ImportQBDescriptionsModal';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Download } from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';

// ============================================================================
// Types
// ============================================================================

interface PreparationItem {
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

export interface PreparationTotals {
  subtotal: number;
  tax: number;
  total: number;
}

interface EstimatePreparationTableProps {
  estimateId: number;
  jobId?: number;
  readOnly?: boolean;
  taxRate?: number;
  onTotalsChange?: (totals: PreparationTotals) => void;
  onItemsChange?: (items: PreparationItem[]) => void;
}

// ============================================================================
// Sortable Row Component
// ============================================================================

interface SortableRowProps {
  item: PreparationItem;
  index: number;
  readOnly: boolean;
  saving: number | null;
  onToggleType: (itemId: number) => void;
  onUpdateItem: (itemId: number, updates: Partial<PreparationItem>) => void;
  onDeleteRow: (itemId: number) => void;
  formatCurrency: (value: number) => string;
}

const SortableRow: React.FC<SortableRowProps> = ({
  item,
  index,
  readOnly,
  saving,
  onToggleType,
  onUpdateItem,
  onDeleteRow,
  formatCurrency
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b ${PAGE_STYLES.interactive.hover} ${saving === item.id ? 'opacity-50' : ''} ${isDragging ? 'bg-blue-50' : ''}`}
    >
      {/* Drag Handle */}
      {!readOnly && (
        <td className="px-1 py-1 text-center">
          <div
            {...attributes}
            {...listeners}
            className={`cursor-grab active:cursor-grabbing p-0.5 ${PAGE_STYLES.interactive.hover} rounded inline-flex`}
          >
            <GripVertical className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />
          </div>
        </td>
      )}

      {/* Type Toggle */}
      <td className="px-2 py-1 text-center">
        {readOnly ? (
          <span className={`text-xs px-1 py-0.5 rounded ${
            item.is_description_only
              ? 'bg-gray-200 text-gray-600'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {item.is_description_only ? 'Desc' : 'Item'}
          </span>
        ) : (
          <button
            onClick={() => onToggleType(item.id)}
            className={`text-xs px-1 py-0.5 rounded border ${
              item.is_description_only
                ? 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300'
                : 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200'
            }`}
            title={item.is_description_only ? 'Click to make regular item' : 'Click to make description only'}
          >
            {item.is_description_only ? 'Desc' : 'Item'}
          </button>
        )}
      </td>

      {/* Row number */}
      <td className={`px-2 py-1 ${PAGE_STYLES.panel.textMuted}`}>
        {index + 1}
      </td>

      {/* QB Item Dropdown */}
      <td className="px-2 py-1">
        {item.is_description_only ? (
          <span></span>
        ) : (
          <QBItemDropdown
            value={item.qb_item_id}
            displayValue={item.qb_item_name}
            onChange={(qbItemId, qbItemName) =>
              onUpdateItem(item.id, { qb_item_id: qbItemId, qb_item_name: qbItemName })
            }
            disabled={readOnly}
          />
        )}
      </td>

      {/* QB Description */}
      <td className="px-2 py-1">
        <EditableCell
          value={item.qb_description}
          onChange={(val) => onUpdateItem(item.id, { qb_description: val })}
          type="textarea"
          disabled={readOnly}
        />
      </td>

      {/* Calculation Display (read-only) */}
      <td className="px-2 py-1">
        {item.calculation_display && (
          <div className={`text-xs ${PAGE_STYLES.panel.textMuted} px-1 whitespace-pre-wrap break-words`}>
            {item.calculation_display}
          </div>
        )}
      </td>

      {/* Quantity */}
      <td className="px-2 py-1 text-right">
        <EditableCell
          value={item.is_description_only ? '' : item.quantity}
          onChange={(val) => {
            const qty = parseFloat(val) || 0;
            onUpdateItem(item.id, {
              quantity: qty,
              extended_price: qty * item.unit_price
            });
          }}
          type="number"
          disabled={readOnly || item.is_description_only}
          className="text-right w-16"
        />
      </td>

      {/* Unit Price */}
      <td className="px-2 py-1 text-right">
        <EditableCell
          value={item.is_description_only ? '' : item.unit_price}
          onChange={(val) => {
            const price = parseFloat(val) || 0;
            onUpdateItem(item.id, {
              unit_price: price,
              extended_price: item.quantity * price
            });
          }}
          type="currency"
          disabled={readOnly || item.is_description_only}
          className="text-right w-20"
        />
      </td>

      {/* Extended Price (calculated) */}
      <td className="px-2 py-1 text-right">
        {!item.is_description_only && (
          <span className="font-medium">
            {formatCurrency(Number(item.extended_price) || 0)}
          </span>
        )}
      </td>

      {/* Delete button */}
      {!readOnly && (
        <td className="px-2 py-1 text-center">
          <button
            onClick={() => onDeleteRow(item.id)}
            className="text-red-400 hover:text-red-600"
            title="Delete row"
          >
            ×
          </button>
        </td>
      )}
    </tr>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const EstimatePreparationTable: React.FC<EstimatePreparationTableProps> = ({
  estimateId,
  jobId,
  readOnly = false,
  taxRate = 0,
  onTotalsChange,
  onItemsChange
}) => {
  // Debug: check if jobId is being passed
  console.log('[PrepTable] Props:', { estimateId, jobId, readOnly });

  const [items, setItems] = useState<PreparationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null); // Item ID being saved
  const [showImportModal, setShowImportModal] = useState(false);

  // Use ref for callback to avoid infinite re-render loop
  // (callback changes reference on parent re-render, which would trigger loadItems recreation)
  const onTotalsChangeRef = useRef(onTotalsChange);
  const onItemsChangeRef = useRef(onItemsChange);
  useEffect(() => {
    onTotalsChangeRef.current = onTotalsChange;
    onItemsChangeRef.current = onItemsChange;
  }, [onTotalsChange, onItemsChange]);

  // Notify parent whenever items change
  useEffect(() => {
    onItemsChangeRef.current?.(items);
  }, [items]);

  // Load preparation items
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // API client unwraps { success, data } - returns array directly
      const items = await jobVersioningApi.getPreparationItems(estimateId);
      if (Array.isArray(items)) {
        setItems(items);
        // Calculate totals
        const subtotal = items
          .filter((item: PreparationItem) => !item.is_description_only)
          .reduce((sum: number, item: PreparationItem) => sum + (Number(item.extended_price) || 0), 0);
        const tax = subtotal * (taxRate || 0);
        const total = subtotal + tax;
        onTotalsChangeRef.current?.({ subtotal, tax, total });
      } else {
        setError('Invalid response format');
      }
    } catch (err) {
      console.error('[PrepTable] Error caught:', err);
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [estimateId, taxRate]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Update item
  const handleUpdateItem = useCallback(async (
    itemId: number,
    updates: Partial<PreparationItem>
  ) => {
    try {
      setSaving(itemId);
      // API client unwraps response - returns updated item directly
      const updatedItem = await jobVersioningApi.updatePreparationItem(estimateId, itemId, updates);
      if (updatedItem && updatedItem.id) {
        setItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, ...updatedItem } : item
        ));
        // Recalculate totals
        const newItems = items.map(item =>
          item.id === itemId ? { ...item, ...updatedItem } : item
        );
        const subtotal = newItems
          .filter(item => !item.is_description_only)
          .reduce((sum, item) => sum + (Number(item.extended_price) || 0), 0);
        const tax = subtotal * (taxRate || 0);
        const total = subtotal + tax;
        onTotalsChangeRef.current?.({ subtotal, tax, total });
      }
    } catch (err) {
      console.error('Error updating item:', err);
    } finally {
      setSaving(null);
    }
  }, [estimateId, items, taxRate]);

  // Toggle row type
  const handleToggleType = useCallback(async (itemId: number) => {
    try {
      setSaving(itemId);
      // API client unwraps response - returns updated item directly
      const updatedItem = await jobVersioningApi.togglePreparationItemType(estimateId, itemId);
      if (updatedItem && updatedItem.id) {
        setItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, ...updatedItem } : item
        ));
        // Recalculate totals after toggle
        loadItems();
      }
    } catch (err) {
      console.error('Error toggling type:', err);
    } finally {
      setSaving(null);
    }
  }, [estimateId, loadItems]);

  // Add new row
  const handleAddRow = useCallback(async (afterDisplayOrder?: number) => {
    try {
      // API client unwraps response - returns new item directly
      const newItem = await jobVersioningApi.addPreparationItem(
        estimateId,
        { item_name: '', is_description_only: false },
        afterDisplayOrder
      );
      if (newItem && newItem.id) {
        loadItems();
      }
    } catch (err) {
      console.error('Error adding row:', err);
    }
  }, [estimateId, loadItems]);

  // Delete row
  const handleDeleteRow = useCallback(async (itemId: number) => {
    if (!window.confirm('Delete this row?')) return;
    try {
      // API returns message on success, just reload
      await jobVersioningApi.deletePreparationItem(estimateId, itemId);
      loadItems();
    } catch (err) {
      console.error('Error deleting row:', err);
    }
  }, [estimateId, loadItems]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Handle drag end for reordering
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(item => item.id === active.id);
    const newIndex = items.findIndex(item => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      // Optimistically update UI
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      // Persist to backend
      try {
        await jobVersioningApi.reorderPreparationItems(
          estimateId,
          newItems.map(item => item.id)
        );
      } catch (err) {
        console.error('Error reordering items:', err);
        // Revert on error
        loadItems();
      }
    }
  }, [items, estimateId, loadItems]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  if (loading) {
    return (
      <div className={`p-4 text-center ${PAGE_STYLES.panel.textMuted}`}>
        Loading preparation table...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        Error: {error}
        <button
          onClick={loadItems}
          className="ml-2 text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Calculate subtotal, tax, and total
  const subtotal = items
    .filter(item => !item.is_description_only)
    .reduce((sum, item) => sum + (Number(item.extended_price) || 0), 0);
  const tax = subtotal * (taxRate || 0);
  const total = subtotal + tax;

  return (
    <div className={`${PAGE_STYLES.composites.panelContainer} overflow-hidden`}>
      {/* Header */}
      <div className={`${PAGE_STYLES.composites.tableHeader} px-3 py-2 flex items-center justify-between`}>
        <h3 className={`text-sm font-semibold ${PAGE_STYLES.header.text}`}>
          Preparation Table
          {readOnly && <span className={`ml-2 text-xs ${PAGE_STYLES.panel.textMuted}`}>(Read-only)</span>}
        </h3>
        {!readOnly && jobId && (
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
            title="Import QB descriptions from other estimates"
          >
            <Download className="w-3 h-3" />
            Import
          </button>
        )}
      </div>

      {/* Table */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className={PAGE_STYLES.header.background}>
              <tr>
                {!readOnly && <th className="px-1 py-1 w-6"></th>}
                <th className="px-2 py-1 text-center w-14">Type</th>
                <th className="px-2 py-1 text-left w-8">#</th>
                <th className="px-2 py-1 text-left w-40">QB Item</th>
                <th className="px-2 py-1 text-left min-w-[120px]">QB Description</th>
                <th className="px-2 py-1 text-left w-48">Calculation Display</th>
                <th className="px-2 py-1 text-right w-20">Qty</th>
                <th className="px-2 py-1 text-right w-24">Unit $</th>
                <th className="px-2 py-1 text-right w-24">Ext. $</th>
                {!readOnly && <th className="px-2 py-1 w-8"></th>}
              </tr>
            </thead>
            <SortableContext
              items={items.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {items.map((item, index) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    index={index}
                    readOnly={readOnly}
                    saving={saving}
                    onToggleType={handleToggleType}
                    onUpdateItem={handleUpdateItem}
                    onDeleteRow={handleDeleteRow}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </DndContext>

      {/* Footer with totals */}
      <div className={`${PAGE_STYLES.header.background} px-3 py-2 border-t ${PAGE_STYLES.border} flex justify-between items-start`}>
        {/* Add Row Button - Left Side */}
        {!readOnly && (
          <button
            onClick={() => handleAddRow()}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm flex items-center gap-2"
            title="Add row"
          >
            <span className="text-lg font-bold">+</span>
            Add Row
          </button>
        )}

        {/* Totals - Right Side */}
        <div className="text-sm text-right">
          <div className={PAGE_STYLES.panel.text}>Subtotal: {formatCurrency(subtotal)}</div>
          <div className={PAGE_STYLES.panel.text}>Tax ({(taxRate * 100).toFixed(0)}%): {formatCurrency(tax)}</div>
          <div className={`font-semibold ${PAGE_STYLES.panel.text}`}>Total: {formatCurrency(total)}</div>
        </div>
      </div>

      {/* Import QB Descriptions Modal */}
      {jobId && (
        <ImportQBDescriptionsModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          estimateId={estimateId}
          jobId={jobId}
          targetItems={items}
          onImportComplete={(updatedItems) => {
            setItems(updatedItems);
            // Recalculate totals
            const newSubtotal = updatedItems
              .filter((item: PreparationItem) => !item.is_description_only)
              .reduce((sum: number, item: PreparationItem) => sum + (Number(item.extended_price) || 0), 0);
            const newTax = newSubtotal * (taxRate || 0);
            const newTotal = newSubtotal + newTax;
            onTotalsChangeRef.current?.({ subtotal: newSubtotal, tax: newTax, total: newTotal });
          }}
        />
      )}
    </div>
  );
};
