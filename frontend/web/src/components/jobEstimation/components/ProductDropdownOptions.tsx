import React from 'react';
import { ProductType, GroupedProductTypes } from '../hooks/useProductTypes';

interface ProductDropdownOptionsProps {
  groupedProducts: GroupedProductTypes;
  selectedProductId?: number | null;
  placeholder?: string;
  showCategories?: boolean;
}

/**
 * Pure component that renders product type options for dropdown
 * Handles the visual hierarchy: Normal → Sub-items → Special
 */
export const ProductDropdownOptions: React.FC<ProductDropdownOptionsProps> = ({
  groupedProducts,
  selectedProductId,
  placeholder = "Select Product Type",
  showCategories = true
}) => {
  const renderProductOption = (product: ProductType) => (
    <option 
      key={product.id} 
      value={product.id}
      className={product.category === 'sub_item' ? 'pl-4' : ''}
    >
      {product.name}
    </option>
  );

  const renderCategoryGroup = (
    label: string, 
    products: ProductType[], 
    showLabel: boolean = true
  ) => {
    if (products.length === 0) return null;
    
    return (
      <React.Fragment key={label}>
        {showCategories && showLabel && (
          <option disabled className="font-bold bg-gray-100">
            ── {label} ──
          </option>
        )}
        {products.map(renderProductOption)}
      </React.Fragment>
    );
  };

  return (
    <>
      {/* Placeholder option */}
      <option value="" disabled>
        {placeholder}
      </option>
      
      {/* Normal products (primary options) */}
      {renderCategoryGroup("Products", groupedProducts.normal, false)}
      
      {/* Sub-items (indented with ↳ prefix) */}
      {groupedProducts.sub_item.length > 0 && showCategories && (
        <option disabled className="font-bold bg-gray-100">
          ── Sub-items ──
        </option>
      )}
      {groupedProducts.sub_item.map(renderProductOption)}
      
      {/* Special items (Assembly, Shipping, UL) */}
      {renderCategoryGroup("Special", groupedProducts.special)}
    </>
  );
};