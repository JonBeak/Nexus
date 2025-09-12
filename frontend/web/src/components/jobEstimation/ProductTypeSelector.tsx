import React, { useState } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { useProductTypes } from './hooks/useProductTypes';
import { ProductDropdownOptions } from './components/ProductDropdownOptions';

interface ProductTypeSelectorProps {
  selectedProductId?: number | null;
  onProductSelect: (productTypeId: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showCategories?: boolean;
}

/**
 * Modular ProductTypeSelector as a proper dropdown
 * Uses unified product_types database with normal/sub_item/special categories
 */
export const ProductTypeSelector: React.FC<ProductTypeSelectorProps> = ({
  selectedProductId,
  onProductSelect,
  placeholder = "Select Product Type",
  disabled = false,
  className = "",
  showCategories = true
}) => {
  const { groupedProductTypes, loading, error } = useProductTypes();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const productId = value ? Number(value) : null;
    onProductSelect(productId);
    setIsOpen(false);
  };

  // Find selected product name for display
  const selectedProduct = [
    ...groupedProductTypes.normal,
    ...groupedProductTypes.sub_item,
    ...groupedProductTypes.special
  ].find(pt => pt.id === selectedProductId);

  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <div className="w-full p-2 border border-gray-300 rounded bg-gray-50 text-gray-500">
          Loading products...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`relative ${className}`}>
        <div className="w-full p-2 border border-red-300 rounded bg-red-50 text-red-600 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <select
        value={selectedProductId || ''}
        onChange={handleSelectChange}
        disabled={disabled}
        className={`
          w-full p-2 border border-gray-300 rounded bg-white
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-100 disabled:text-gray-500
          appearance-none cursor-pointer
          ${selectedProductId ? 'text-gray-900' : 'text-gray-500'}
        `}
      >
        <ProductDropdownOptions
          groupedProducts={groupedProductTypes}
          selectedProductId={selectedProductId}
          placeholder={placeholder}
          showCategories={showCategories}
        />
      </select>
      
      {/* Custom dropdown arrow */}
      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </div>
    </div>
  );
};