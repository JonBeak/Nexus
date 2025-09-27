import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { InventoryUser, VinylProduct } from '../types';

interface ProductsTableRowProps {
  product: VinylProduct;
  user: InventoryUser;
  onEditProduct: (product: VinylProduct) => void;
  onDeleteProduct: (id: number) => void;
}

export const ProductsTableRow: React.FC<ProductsTableRowProps> = ({
  product,
  user,
  onEditProduct,
  onDeleteProduct
}) => {
  // Helper functions for colour field fallback
  const getColourNumber = () => {
    return product.colour_number || product.colour?.split(' ')[0] || '-';
  };

  const getColourName = () => {
    return product.colour_name || product.colour?.split(' ').slice(1).join(' ') || '-';
  };

  return (
    <tr key={product.product_id} className="hover:bg-gray-50">
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {product.brand || '-'}
      </td>
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {product.series || '-'}
      </td>
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {getColourNumber()}
      </td>
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {getColourName()}
      </td>
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {product.default_width ? `${product.default_width}"` : '-'}
      </td>
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
        <div>
          {product.suppliers || 'No suppliers'}
          {product.supplier_details && product.supplier_details.length > 0 && (
            <div className="text-xs text-gray-400 mt-1">
              {product.supplier_details.length} supplier{product.supplier_details.length === 1 ? '' : 's'}
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          product.is_active 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {product.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      {(user.role === 'manager' || user.role === 'owner') && (
        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
          <div className="flex space-x-2">
            <button
              onClick={() => onEditProduct(product)}
              className="text-indigo-600 hover:text-indigo-900"
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button 
              onClick={() => onDeleteProduct(product.product_id)}
              className="text-red-600 hover:text-red-900"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
};
