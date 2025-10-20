/**
 * ProductTypeSelector - Product type dropdown component
 * Matches original GridRow product selection styling and behavior
 * Simplified for Base Layer - uses basic product options
 */

import React from 'react';
import { GridRow } from '../core/types/LayerTypes';
import { ProductType } from '../hooks/useProductTypes';

interface ProductTypeSelectorProps {
  row: GridRow;
  rowIndex: number;
  productTypes: ProductType[];
  onProductTypeSelect: (rowIndex: number, productTypeId: number) => void;
  isReadOnly: boolean;
  validationState?: 'error' | 'valid'; // Structure validation state
  errorMessage?: string; // Error message for tooltip
}

export const ProductTypeSelector: React.FC<ProductTypeSelectorProps> = ({
  row,
  rowIndex,
  productTypes,
  onProductTypeSelect,
  isReadOnly,
  validationState,
  errorMessage
}) => {
  const handleProductTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      onProductTypeSelect(rowIndex, parseInt(value));
    }
  };

  if (isReadOnly || row.rowType === 'continuation') {
    // Read-only display - no validation errors shown (matches FieldCell pattern)
    const currentProduct = productTypes.find(pt => pt.id === row.productTypeId);
    const isSubItem = currentProduct?.category === 'sub_item';

    return (
      <span className={`text-sm text-left ${isSubItem ? 'text-purple-900' : 'text-gray-600'}`}>
        {row.productTypeName || 'No Product'}
      </span>
    );
  }

  // Check if current product is a sub-item or special item for styling
  const currentProduct = productTypes.find(pt => pt.id === row.productTypeId);
  const isSubItem = currentProduct?.category === 'sub_item';
  const isEmptyRow = row.productTypeId === 27; // Only Empty Row gets blue highlighting
  const hasError = validationState === 'error';

  // Error styling takes priority, then special category styling (matches FieldCell pattern)
  // Default uses transparent background to inherit row color
  const selectClassName = hasError
    ? 'w-full px-2 py-1 text-xs border border-red-500 bg-red-100 text-black rounded focus:border-red-600 appearance-none text-left'
    : isSubItem
      ? 'w-full px-2 py-1 text-xs border border-purple-300 bg-purple-50 text-purple-900 rounded focus:border-purple-400 appearance-none text-left'
      : isEmptyRow
        ? 'w-full px-2 py-1 text-xs border border-blue-500 bg-sky-50/25 text-black rounded focus:border-blue-300 appearance-none text-left'
        : 'w-full px-2 py-1 text-xs border border-gray-300 bg-transparent text-black rounded focus:border-blue-300 appearance-none text-left';

  // Group product types by category
  const groupedProductTypes = productTypes.reduce((acc, pt) => {
    const category = pt.category || 'normal';
    if (!acc[category]) acc[category] = [];
    acc[category].push(pt);
    return acc;
  }, {} as Record<string, ProductType[]>);

  return (
    <select
      value={row.productTypeId || ""}
      onChange={handleProductTypeChange}
      className={selectClassName}
      aria-label="Select product type"
      title={hasError ? errorMessage : "Select product type"}
    >
      <option value="">Clear Product Type</option>
      
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