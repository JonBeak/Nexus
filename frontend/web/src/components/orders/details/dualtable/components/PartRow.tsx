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

import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ordersApi } from '@/services/api';
import { OrderPart } from '@/types/orders';
import { QBItem } from '../constants/tableConstants';
import { formatCurrency } from '../utils/formatting';
import { getValidInputClass } from '@/utils/highlightStyles';
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
  onUpdate
}) => {
  const [saving, setSaving] = useState(false);
  const isParent = part.is_parent;

  // Get QB description from specifications (auto-filled when QB Item changes, but editable)
  const qbDescription = part.specifications?._qb_description || '';

  // Use specs_display_name if available, otherwise fall back to product_type
  const displayName = part.specs_display_name || part.product_type;

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
          specifications: {
            ...part.specifications,
            _qb_description: qbDescriptionValue
          }
        };

        // Save to API immediately
        await ordersApi.updateOrderParts(orderNumber, [{
          part_id: updatedPart.part_id,
          qb_item_name: updatedPart.qb_item_name,
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

    const baseClass = `w-full px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${
      !currentValue ? 'text-gray-400' : 'text-gray-900'
    }`;

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
      className="border-b-2 border-gray-300 grid gap-2 px-2"
      style={{
        gridTemplateColumns: '130px 120px 110px 110px 110px 70px 190px 410px 270px 55px 75px 85px'
      }}
    >
      {/* Item Name - editable dropdown + Part Scope + QTY field for parent parts */}
      <div className={`flex flex-col ${isParent ? 'font-semibold text-gray-900 text-sm' : 'text-gray-700 text-sm'}`}>
        <ItemNameDropdown
          partId={part.part_id}
          orderNumber={orderNumber}
          currentValue={displayName}
          onUpdate={onUpdate}
          isParentOrRegular={isParent}
        />
        {!!isParent && (
          <>
            {/* Part Scope - inline editable text input (only for parent parts) */}
            <input
              type="text"
              value={part.part_scope || ''}
              onChange={(e) => {
                // Local update handled by parent component through onFieldSave
              }}
              onBlur={(e) => {
                // Save to backend on blur
                onFieldSave(part.part_id, 'part_scope', e.target.value);
              }}
              placeholder="Scope (e.g., Main Sign, Logo...)"
              className="text-xs px-1 py-0.5 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 mt-1"
            />
            <EditableSpecsQty
              partId={part.part_id}
              orderNumber={orderNumber}
              currentValue={part.specifications?.specs_qty ?? 0}
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
        onTemplateSave={onTemplateSave}
        onSpecFieldSave={onSpecFieldSave}
      />

      {/* Actions: Toggle Base/Sub, Add/Remove Row Buttons */}
      <div className="flex flex-row items-start justify-center pt-1 space-x-1">
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
        <button
          onClick={() => onAddRow(part.part_id)}
          disabled={rowCount >= 20}
          className="w-6 h-6 flex items-center justify-center text-xs font-bold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded"
          title="Add row"
        >
          +
        </button>
        <button
          onClick={() => onRemoveRow(part.part_id)}
          disabled={rowCount <= 1}
          className="w-6 h-6 flex items-center justify-center text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded"
          title="Remove row"
        >
          −
        </button>
      </div>

      {/* QB Item Name - spans full height (with divider) */}
      <div className="flex items-start border-l-2 border-gray-400 pl-2">
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
        />
      </div>

      {/* Quantity - spans full height */}
      <div className="flex items-start">
        <EditableInput
          partId={part.part_id}
          field="quantity"
          currentValue={part.quantity}
          onSave={onFieldSave}
          placeholder="Qty"
          hasValue={part.quantity !== null && part.quantity !== 0}
          align="left"
        />
      </div>

      {/* Unit Price - spans full height */}
      <div className="flex items-start text-right">
        <EditableInput
          partId={part.part_id}
          field="unit_price"
          currentValue={part.unit_price}
          onSave={onFieldSave}
          placeholder="Price"
          hasValue={part.unit_price !== null && part.unit_price !== 0}
          align="right"
        />
      </div>

      {/* Extended Price - spans full height */}
      <div className="flex items-start justify-end">
        <span className="text-base font-semibold text-gray-900">
          {formatCurrency(part.extended_price)}
        </span>
      </div>
    </div>
  );
};
