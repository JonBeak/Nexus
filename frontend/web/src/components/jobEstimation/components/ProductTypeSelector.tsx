/**
 * ProductTypeSelector - Product type dropdown component
 * Matches original GridRow product selection styling and behavior
 * Simplified for Base Layer - uses basic product options
 */

import React from 'react';
import { GridRow } from '../core/types/LayerTypes';

interface ProductTypeSelectorProps {
  row: GridRow;
  rowIndex: number;
  productTypes: any[]; // Database product types
  onProductTypeSelect: (rowIndex: number, productTypeId: number) => void;
  isReadOnly: boolean;
}

export const ProductTypeSelector: React.FC<ProductTypeSelectorProps> = ({
  row,
  rowIndex,
  productTypes,
  onProductTypeSelect,
  isReadOnly
}) => {
  const handleProductTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      onProductTypeSelect(rowIndex, parseInt(value));
    }
  };

  if (isReadOnly || row.rowType === 'continuation') {
    // Read-only display for continuation rows or read-only mode
    return (
      <span className="text-sm text-gray-600">
        {row.productTypeName || 'No Product'}
      </span>
    );
  }

  // Style based on row type - matches original GridRow exactly
  const selectClassName = `w-36 px-2 py-1 text-xs border border-gray-300 rounded focus:border-blue-300 appearance-none ${
    row.rowType === 'main' 
      ? 'text-gray-500' 
      : row.parentId === null 
        ? 'text-red-600 bg-red-50 border-red-300' 
        : 'text-blue-600 bg-blue-50'
  }`;

  // Group product types by category
  const groupedProductTypes = productTypes.reduce((acc, pt) => {
    const category = pt.category || 'normal';
    if (!acc[category]) acc[category] = [];
    acc[category].push(pt);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <select
      value={row.productTypeId || ""}
      onChange={handleProductTypeChange}
      className={selectClassName}
    >
      <option value="">Select Type</option>
      
      {/* Normal Products */}
      {groupedProductTypes.normal && groupedProductTypes.normal.length > 0 && (
        <optgroup label="Products">
          {groupedProductTypes.normal.map(pt => (
            <option key={pt.id} value={pt.id} className="text-black">
              {pt.name}
            </option>
          ))}
        </optgroup>
      )}
      
      {/* Sub-items */}
      {groupedProductTypes.sub_item && groupedProductTypes.sub_item.length > 0 && (
        <optgroup label="Sub-items">
          {groupedProductTypes.sub_item.map(pt => (
            <option key={pt.id} value={pt.id} className="text-black">
              {pt.name}
            </option>
          ))}
        </optgroup>
      )}
      
      {/* Special Items */}
      {groupedProductTypes.special && groupedProductTypes.special.length > 0 && (
        <optgroup label="Special Items">
          {groupedProductTypes.special.map(pt => (
            <option key={pt.id} value={pt.id} className="text-black">
              {pt.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
};