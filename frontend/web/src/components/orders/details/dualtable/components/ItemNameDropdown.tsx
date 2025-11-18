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
import { INPUT_STYLES } from '@/utils/inputStyles';

interface ItemNameDropdownProps {
  partId: number;
  orderNumber: number;
  currentValue: string;
  onUpdate: () => void;
  isParentOrRegular?: boolean;
  applyGrayBackground?: boolean;
}

export const ItemNameDropdown = React.memo<ItemNameDropdownProps>(({
  partId,
  orderNumber,
  currentValue,
  onUpdate,
  isParentOrRegular = false,
  applyGrayBackground = false
}) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (value: string) => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      console.log('[ItemNameDropdown] Updating part', partId, 'with specs_display_name:', value);

      // Call the new API endpoint
      // Note: axios interceptor unwraps successful responses, so we just get the data
      await ordersApi.updateSpecsDisplayName(orderNumber, partId, value);

      console.log('[ItemNameDropdown] Successfully updated specs_display_name');
      // Trigger parent refresh
      onUpdate();
    } catch (error: any) {
      console.error('[ItemNameDropdown] Error updating specs_display_name:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to update Item Name: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const baseClass = INPUT_STYLES.itemNameDropdown({
    hasValue: !!currentValue,
    isParentOrRegular,
    applyGrayBackground,
  });

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
         prevProps.isParentOrRegular === nextProps.isParentOrRegular &&
         prevProps.applyGrayBackground === nextProps.applyGrayBackground;
});

ItemNameDropdown.displayName = 'ItemNameDropdown';
