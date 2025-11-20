/**
 * EditableSpecsQty Component
 * Extracted from DualTableLayout.tsx (Phase 1)
 *
 * Editable manufacturing quantity (specs_qty) field
 * Highlights in red when different from invoice quantity
 */

import React, { useState, useEffect } from 'react';
import { ordersApi } from '@/services/api';

interface EditableSpecsQtyProps {
  partId: number;
  orderNumber: number;
  currentValue: number;
  invoiceQuantity: number;
  onUpdate: () => void;
}

export const EditableSpecsQty = React.memo<EditableSpecsQtyProps>(({
  partId,
  orderNumber,
  currentValue,
  invoiceQuantity,
  onUpdate
}) => {
  const [localValue, setLocalValue] = useState(currentValue?.toString() ?? '0');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Update local value when prop changes (from server)
  useEffect(() => {
    setLocalValue(currentValue?.toString() ?? '0');
  }, [currentValue]);

  const handleBlur = async () => {
    setIsEditing(false);

    // Only save if value changed
    const numericValue = parseFloat(localValue) || 0;
    if (numericValue !== currentValue && !isSaving) {
      setIsSaving(true);
      try {
        console.log('[EditableSpecsQty] Updating part', partId, 'with specs_qty:', numericValue);

        const response = await ordersApi.updatePartSpecsQty(orderNumber, partId, numericValue);

        if (response.success) {
          console.log('[EditableSpecsQty] Successfully updated specs_qty');
          onUpdate();
        } else {
          console.error('[EditableSpecsQty] Failed to update:', response.error);
          alert(`Failed to update QTY: ${response.error || 'Unknown error'}`);
          // Revert to previous value
          setLocalValue(currentValue?.toString() ?? '0');
        }
      } catch (error) {
        console.error('[EditableSpecsQty] Error updating specs_qty:', error);
        alert('Failed to update QTY. Please try again.');
        // Revert to previous value
        setLocalValue(currentValue?.toString() ?? '0');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setLocalValue(currentValue?.toString() ?? '0');
      setIsEditing(false);
      e.currentTarget.blur();
    }
  };

  // Determine styling based on comparison with invoice quantity
  const isDifferent = currentValue !== invoiceQuantity;
  const textColor = isDifferent ? 'text-red-600 font-bold' : 'text-gray-900';

  return (
    <div className="flex items-center mt-1">
      <span className="text-xs text-gray-600 mr-1 flex-shrink-0">QTY:</span>
      <input
        type="number"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={() => setIsEditing(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`w-20 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${textColor} ${
          isEditing ? 'border-indigo-500' : 'border-gray-300'
        }`}
        disabled={isSaving}
        min="0"
        step="1"
      />
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.currentValue === nextProps.currentValue &&
         prevProps.invoiceQuantity === nextProps.invoiceQuantity &&
         prevProps.partId === nextProps.partId;
});

EditableSpecsQty.displayName = 'EditableSpecsQty';
