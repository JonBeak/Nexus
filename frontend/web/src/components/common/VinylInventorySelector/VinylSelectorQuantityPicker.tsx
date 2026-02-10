/**
 * Vinyl Selector Quantity Picker
 * Quantity selector for hold mode (whole piece or custom)
 */

import React from 'react';

interface VinylSelectorQuantityPickerProps {
  quantityType: 'whole' | 'custom';
  customQuantity: string;
  onQuantityTypeChange: (type: 'whole' | 'custom') => void;
  onCustomQuantityChange: (value: string) => void;
}

export const VinylSelectorQuantityPicker: React.FC<VinylSelectorQuantityPickerProps> = ({
  quantityType,
  customQuantity,
  onQuantityTypeChange,
  onCustomQuantityChange,
}) => {
  return (
    <div className="border-t pt-4 mb-4">
      <div className="flex items-center gap-4">
        <span className="text-xs font-medium text-gray-700">Quantity to Hold:</span>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="quantityType"
            value="whole"
            checked={quantityType === 'whole'}
            onChange={() => onQuantityTypeChange('whole')}
            className="text-purple-600"
          />
          <span className="text-xs">Whole piece</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="quantityType"
            value="custom"
            checked={quantityType === 'custom'}
            onChange={() => onQuantityTypeChange('custom')}
            className="text-purple-600"
          />
          <span className="text-xs">Custom:</span>
        </label>
        {quantityType === 'custom' && (
          <input
            type="text"
            value={customQuantity}
            onChange={(e) => onCustomQuantityChange(e.target.value)}
            placeholder="e.g., 50 sq ft"
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
          />
        )}
      </div>
    </div>
  );
};
