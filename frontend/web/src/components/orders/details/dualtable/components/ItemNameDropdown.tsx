/**
 * ItemNameDropdown Component
 * Extracted from DualTableLayout.tsx (Phase 1)
 *
 * Dropdown for selecting item display name (specs_display_name)
 * Highlighted with blue border for parent/base items
 */

import React, { useState } from 'react';
import { ordersApi } from '@/services/api';
import { SPECS_DISPLAY_NAMES } from '../constants/tableConstants';

interface ItemNameDropdownProps {
  partId: number;
  orderNumber: number;
  currentValue: string;
  onUpdate: () => void;
  isParentOrRegular?: boolean;
}

export const ItemNameDropdown = React.memo<ItemNameDropdownProps>(({
  partId,
  orderNumber,
  currentValue,
  onUpdate,
  isParentOrRegular = false
}) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (value: string) => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      console.log('[ItemNameDropdown] Updating part', partId, 'with specs_display_name:', value);

      // Call the new API endpoint
      const response = await ordersApi.updateSpecsDisplayName(orderNumber, partId, value);

      if (response.success) {
        console.log('[ItemNameDropdown] Successfully updated specs_display_name');
        // Trigger parent refresh
        onUpdate();
      } else {
        console.error('[ItemNameDropdown] Failed to update:', response.message);
        alert(`Failed to update Item Name: ${response.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[ItemNameDropdown] Error updating specs_display_name:', error);
      alert('Failed to update Item Name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const baseClass = `w-full px-1.5 py-0.5 text-sm rounded focus:outline-none focus:ring-1 ${
    !currentValue ? 'text-gray-400' : 'text-gray-900'
  } ${
    isParentOrRegular && currentValue
      ? 'border-2 border-blue-600 bg-blue-100 focus:ring-blue-600'
      : 'border border-gray-300 focus:ring-indigo-500'
  }`;

  return (
    <div className="py-1">
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className={baseClass}
        disabled={isSaving}
      >
        <option value="" className="text-gray-400">Select Item Name...</option>
        {SPECS_DISPLAY_NAMES.map((name) => (
          <option key={name} value={name} className="text-gray-900">
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.currentValue === nextProps.currentValue &&
         prevProps.partId === nextProps.partId &&
         prevProps.isParentOrRegular === nextProps.isParentOrRegular;
});

ItemNameDropdown.displayName = 'ItemNameDropdown';
