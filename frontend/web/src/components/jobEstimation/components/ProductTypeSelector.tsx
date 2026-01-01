/**
 * ProductTypeSelector - Product type dropdown component
 * Matches original GridRow product selection styling and behavior
 * Simplified for Base Layer - uses basic product options
 */

import React from 'react';
import { GridRow } from '../core/types/LayerTypes';
import { ProductType } from '../hooks/useProductTypes';
import { PAGE_STYLES } from '../../../constants/moduleColors';

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

  // Navigate to adjacent cell (spreadsheet-like navigation)
  const navigateToCell = (direction: 'up' | 'down' | 'left' | 'right') => {
    // Find current cell's td element
    const currentInput = document.activeElement as HTMLElement;
    const currentTd = currentInput?.closest('td');
    if (!currentTd) return;

    const currentTr = currentTd.closest('tr');
    if (!currentTr) return;

    // Helper to check if a cell has an editable input
    const hasEditableInput = (td: HTMLElement): boolean => {
      const input = td.querySelector('input:not([readonly]), select:not([disabled])') as HTMLElement;
      return !!input;
    };

    // Helper to get next td in a direction
    const getNextTd = (currentTd: HTMLElement, currentTr: HTMLElement, direction: 'up' | 'down' | 'left' | 'right'): HTMLElement | null => {
      if (direction === 'left') {
        return currentTd.previousElementSibling as HTMLElement;
      } else if (direction === 'right') {
        return currentTd.nextElementSibling as HTMLElement;
      } else if (direction === 'up') {
        const prevTr = currentTr.previousElementSibling as HTMLElement;
        if (prevTr) {
          const cellIndex = Array.from(currentTr.children).indexOf(currentTd);
          return prevTr.children[cellIndex] as HTMLElement;
        }
      } else if (direction === 'down') {
        const nextTr = currentTr.nextElementSibling as HTMLElement;
        if (nextTr) {
          const cellIndex = Array.from(currentTr.children).indexOf(currentTd);
          return nextTr.children[cellIndex] as HTMLElement;
        }
      }
      return null;
    };

    // Find next valid cell, skipping inactive ones
    let targetTd: HTMLElement | null = null;
    let searchTd = currentTd;
    let searchTr = currentTr;
    let maxIterations = 100; // Safety limit to prevent infinite loops
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      const nextTd = getNextTd(searchTd, searchTr, direction);
      if (!nextTd) {
        // Reached end of grid in this direction
        break;
      }

      // Update search position
      searchTd = nextTd;
      if (direction === 'up' || direction === 'down') {
        searchTr = nextTd.closest('tr') as HTMLElement;
        if (!searchTr) break;
      }

      // Check if this cell has an editable input
      if (hasEditableInput(nextTd)) {
        targetTd = nextTd;
        break;
      }
    }

    // Focus the input/select in the target cell
    if (targetTd) {
      const targetInput = targetTd.querySelector('input:not([readonly]), select:not([disabled])') as HTMLElement;
      if (targetInput) {
        targetInput.focus();
        // Select all text if it's an input
        if (targetInput instanceof HTMLInputElement) {
          targetInput.select();
        }
      }
    }
  };

  // Handle keyboard navigation with Ctrl+Arrow keys
  const handleKeyDown = (event: React.KeyboardEvent<HTMLSelectElement>) => {
    if (event.ctrlKey) {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        navigateToCell('up');
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        navigateToCell('down');
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateToCell('left');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateToCell('right');
      }
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
  // Default uses theme input background for consistency
  const selectClassName = hasError
    ? 'w-full px-2 py-1 text-xs border border-red-500 bg-red-100 text-black rounded focus:border-red-600 appearance-none text-left'
    : isSubItem
      ? 'w-full px-2 py-1 text-xs border border-purple-300 bg-purple-50 text-purple-900 rounded focus:border-purple-400 appearance-none text-left'
      : isEmptyRow
        ? 'w-full px-2 py-1 text-xs border border-blue-500 bg-sky-50/25 text-black rounded focus:border-blue-300 appearance-none text-left'
        : `w-full px-2 py-1 text-xs ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} rounded focus:border-blue-300 appearance-none text-left`;

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
      onKeyDown={handleKeyDown}
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