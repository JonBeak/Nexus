/**
 * PartRow Component
 * Extracted from DualTableLayout.tsx (Phase 5)
 *
 * Renders a complete row for a single order part including:
 * - Item name dropdown
 * - Part scope (for parent items)
 * - Specs quantity (for parent items)
 * - Specification rows (template + spec fields)
 * - Action buttons (toggle parent/sub, add/remove rows)
 * - QB item dropdown
 * - QB description
 * - Invoice description
 * - Quantity, unit price, extended price
 */

import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ordersApi } from '@/services/api';
import { OrderPart } from '@/types/orders';
import { QBItem } from '../constants/tableConstants';
import { formatCurrency } from '../utils/formatting';
import { getValidInputClass, EMPTY_FIELD_BG_CLASS } from '@/utils/highlightStyles';
import { INPUT_STYLES } from '@/utils/inputStyles';
import { getSpecificationTemplate } from '@/config/orderProductTemplates';
import { ItemNameDropdown } from './ItemNameDropdown';
import { EditableSpecsQty } from './EditableSpecsQty';
import { SpecificationRows } from './SpecificationRows';
import { EditableTextarea } from './EditableTextarea';
import { EditableInput } from './EditableInput';

interface PartRowProps {
  part: OrderPart;
  orderNumber: number;
  availableTemplates: string[];
  qbItems: QBItem[];
  rowCount: number;
  onFieldSave: (partId: number, field: string, value: string) => Promise<void>;
  onTemplateSave: (partId: number, rowNum: number, value: string) => Promise<void>;
  onSpecFieldSave: (partId: number, specKey: string, value: string) => Promise<void>;
  onAddRow: (partId: number) => void;
  onRemoveRow: (partId: number) => void;
  onToggleParent: (partId: number) => void;
  onRemovePartRow: (partId: number) => void;
  onUpdate: () => void;
}

export const PartRow: React.FC<PartRowProps> = ({
  part,
  orderNumber,
  availableTemplates,
  qbItems,
  rowCount,
  onFieldSave,
  onTemplateSave,
  onSpecFieldSave,
  onAddRow,
  onRemoveRow,
  onToggleParent,
  onRemovePartRow,
  onUpdate
}) => {
  const [saving, setSaving] = useState(false);
  const [localPartScope, setLocalPartScope] = useState(part.part_scope || '');
  const isParent = part.is_parent;

  // Sync local scope state when part changes
  useEffect(() => {
    setLocalPartScope(part.part_scope || '');
  }, [part.part_scope]);

  // Setup drag-and-drop sortable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: part.part_id });

  const style = {
    // Only apply vertical (Y-axis) transform, ignore horizontal movement
    transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  // Get QB description from column (auto-filled when QB Item changes, but editable)
  const qbDescription = part.qb_description || '';

  // Use specs_display_name if available, otherwise fall back to product_type
  const displayName = part.specs_display_name || part.product_type;

  // Calculate which spec rows are empty (all 3 spec fields empty)
  const emptySpecRows = useMemo(() => {
    const empty = new Set<number>();
    for (let rowNum = 1; rowNum <= rowCount; rowNum++) {
      const template = part.specifications?.[`_template_${rowNum}`] || '';
      const templateConfig = template ? getSpecificationTemplate(template) : null;

      let hasData = false;
      for (let specNum = 1; specNum <= 3; specNum++) {
        const field = templateConfig?.[`spec${specNum}` as 'spec1' | 'spec2' | 'spec3'];
        if (field) {
          const specKey = `row${rowNum}_${field.key}`;
          const value = part.specifications?.[specKey] ?? '';
          if (value !== '' && value !== null && value !== undefined && value !== false) {
            hasData = true;
            break;
          }
        }
      }

      if (!hasData) {
        empty.add(rowNum);
      }
    }
    return empty;
  }, [part.specifications, rowCount]);

  // Check if all spec rows are empty
  const allSpecRowsEmpty = emptySpecRows.size === rowCount;

  // Check if QB data is empty (QB Item, QB Description, Unit Price all empty)
  const isQBDataEmpty = useMemo(() => {
    const hasQBItem = !!part.qb_item_name && part.qb_item_name.trim() !== '';
    const hasQBDescription = !!qbDescription && qbDescription.trim() !== '';
    const hasUnitPrice = part.unit_price !== null && part.unit_price !== undefined && part.unit_price !== 0;

    return !hasQBItem && !hasQBDescription && !hasUnitPrice;
  }, [part.qb_item_name, qbDescription, part.unit_price]);

  // Render QB Item dropdown
  const renderQBItemDropdown = () => {
    const currentValue = part.qb_item_name || '';
    const hasValue = !!currentValue;

    const handleChange = async (value: string) => {
      // Find the selected QB item to get its description
      const selectedQBItem = qbItems.find(item => item.name === value);
      const qbDescriptionValue = selectedQBItem?.description || '';

      try {
        setSaving(true);

        // Update local part with both QB item name and description
        const updatedPart = {
          ...part,
          qb_item_name: value,
          qb_description: qbDescriptionValue
        };

        // Save to API immediately
        await ordersApi.updateOrderParts(orderNumber, [{
          part_id: updatedPart.part_id,
          qb_item_name: updatedPart.qb_item_name,
          qb_description: updatedPart.qb_description,
          part_scope: updatedPart.part_scope,
          specifications: updatedPart.specifications,
          invoice_description: updatedPart.invoice_description,
          quantity: updatedPart.quantity,
          unit_price: updatedPart.unit_price,
          extended_price: updatedPart.extended_price,
          production_notes: updatedPart.production_notes
        }]);

        // Trigger parent to refresh parts
        onUpdate();
      } catch (error) {
        console.error('Error saving QB item:', error);
        alert('Failed to save QB item. Please try again.');
      } finally {
        setSaving(false);
      }
    };

    const baseClass = INPUT_STYLES.qbItemDropdown({
      hasValue: !!currentValue,
      isQBDataEmpty,
    });

    return (
      <div className="py-1">
        <select
          value={currentValue}
          onChange={(e) => handleChange(e.target.value)}
          className={getValidInputClass(hasValue, baseClass)}
          disabled={saving}
        >
          <option value="" className="text-gray-400">Select QB Item...</option>
          {qbItems.map((item) => (
            <option key={item.id} value={item.name} className="text-gray-900">
              {item.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div
      ref={setNodeRef}
      className="border-b-2 border-gray-300 grid gap-2 px-2"
      style={{
        ...style,
        gridTemplateColumns: '75px 165px 120px 110px 110px 110px 60px 140px 380px 270px 55px 75px 85px'
      }}
    >
      {/* Row Controls: Drag Handle, Remove Part, Toggle Parent */}
      <div className="flex flex-row items-start justify-center pt-1 space-x-1">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>
        <button
          onClick={() => onRemovePartRow(part.part_id)}
          className="w-6 h-6 flex items-center justify-center text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded"
          title="Remove part row"
        >
          −
        </button>
        <button
          onClick={() => onToggleParent(part.part_id)}
          className={`w-6 h-6 flex items-center justify-center text-white rounded ${
            part.is_parent
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-500 hover:bg-gray-600'
          }`}
          title={part.is_parent ? 'Convert to Sub-Item' : 'Promote to Base Item'}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Item Name - editable dropdown + Part Scope + QTY field for parent parts */}
      <div className={`flex flex-col h-full ${isParent ? 'font-semibold text-gray-900 text-sm' : 'text-gray-700 text-sm'}`}>
        <ItemNameDropdown
          partId={part.part_id}
          orderNumber={orderNumber}
          currentValue={displayName}
          onUpdate={onUpdate}
          isParentOrRegular={isParent}
          applyGrayBackground={allSpecRowsEmpty}
        />
        {!!isParent && (
          <>
            {/* Part Scope - inline editable text input (only for parent parts) */}
            <input
              type="text"
              value={localPartScope}
              onChange={(e) => {
                setLocalPartScope(e.target.value);
              }}
              onBlur={(e) => {
                // Save to backend on blur
                onFieldSave(part.part_id, 'part_scope', e.target.value);
              }}
              placeholder="Scope (e.g., Main Sign, Logo...)"
              className={INPUT_STYLES.partScopeInput()}
            />
            <EditableSpecsQty
              partId={part.part_id}
              orderNumber={orderNumber}
              currentValue={part.specs_qty ?? 0}
              invoiceQuantity={part.quantity ?? 0}
              onUpdate={onUpdate}
            />
          </>
        )}
      </div>

      {/* Specification Rows - contains template dropdown + spec 1-3 fields */}
      <SpecificationRows
        part={part}
        rowCount={rowCount}
        availableTemplates={availableTemplates}
        emptySpecRows={emptySpecRows}
        onTemplateSave={onTemplateSave}
        onSpecFieldSave={onSpecFieldSave}
      />

      {/* Actions: Add/Remove Spec Row Buttons */}
      <div className="flex flex-row items-start justify-center pt-1 space-x-1 h-full">
        <button
          onClick={() => onAddRow(part.part_id)}
          disabled={rowCount >= 20}
          className="w-5 h-5 flex items-center justify-center text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 border-2 border-gray-500 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed rounded"
          title="Add spec row"
        >
          +
        </button>
        <button
          onClick={() => onRemoveRow(part.part_id)}
          disabled={rowCount <= 1}
          className="w-5 h-5 flex items-center justify-center text-xs font-bold text-white bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded"
          title="Remove spec row"
        >
          −
        </button>
      </div>

      {/* QB Item Name - spans full height (with divider) */}
      <div className="flex items-start border-l-2 border-gray-400 pl-2 h-full">
        {renderQBItemDropdown()}
      </div>

      {/* QB Description - spans full height */}
      <div className="h-full">
        <EditableTextarea
          partId={part.part_id}
          field="qb_description"
          currentValue={qbDescription}
          onSave={onFieldSave}
          placeholder="QB Description..."
          hasValue={!!qbDescription && qbDescription.trim() !== ''}
          applyGrayBackground={isQBDataEmpty}
        />
      </div>

      {/* Price Calculation - spans full height */}
      <div className="h-full">
        <EditableTextarea
          partId={part.part_id}
          field="invoice_description"
          currentValue={part.invoice_description || ''}
          onSave={onFieldSave}
          placeholder="Description..."
          hasValue={false} // invoice_description doesn't use highlighting
          applyGrayBackground={isQBDataEmpty}
        />
      </div>

      {/* Quantity - spans full height */}
      <div className="flex items-start h-full">
        <EditableInput
          partId={part.part_id}
          field="quantity"
          currentValue={part.quantity}
          onSave={onFieldSave}
          placeholder="Qty"
          hasValue={part.quantity !== null && part.quantity !== 0}
          align="left"
          applyGrayBackground={isQBDataEmpty}
        />
      </div>

      {/* Unit Price - spans full height */}
      <div className="flex items-start text-right h-full">
        <EditableInput
          partId={part.part_id}
          field="unit_price"
          currentValue={part.unit_price}
          onSave={onFieldSave}
          placeholder="Price"
          hasValue={part.unit_price !== null && part.unit_price !== 0}
          align="right"
          applyGrayBackground={isQBDataEmpty}
        />
      </div>

      {/* Extended Price - spans full height */}
      <div className="flex items-start justify-end h-full">
        <span className="text-base font-semibold text-gray-900">
          {formatCurrency(part.extended_price)}
        </span>
      </div>
    </div>
  );
};
