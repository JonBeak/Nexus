import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { InventoryUser, VinylProduct } from '../types';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

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

  const tdClass = `px-3 py-4 whitespace-nowrap text-sm ${PAGE_STYLES.panel.text}`;

  return (
    <tr key={product.product_id} className="hover:bg-[var(--theme-hover-bg)]">
      <td className={tdClass}>
        {product.brand || '-'}
      </td>
      <td className={tdClass}>
        {product.series || '-'}
      </td>
      <td className={tdClass}>
        {getColourNumber()}
      </td>
      <td className={tdClass}>
        {getColourName()}
      </td>
      <td className={tdClass}>
        {product.default_width ? `${product.default_width}"` : '-'}
      </td>
      <td className={`px-3 py-4 whitespace-nowrap text-sm ${PAGE_STYLES.panel.textMuted}`}>
        <div>
          {Array.isArray(product.suppliers) && product.suppliers.length > 0 ? (
            <div>
              {product.suppliers.map((s: any, idx: number) => (
                <div key={idx} className={idx > 0 ? 'mt-1' : ''}>
                  {s.supplier_name || s.name}
                  {(s.is_primary === true || s.is_primary === 1) && <span className={`ml-1 text-xs ${MODULE_COLORS.vinyls.text}`}>(Primary)</span>}
                </div>
              ))}
            </div>
          ) : typeof product.suppliers === 'string' ? (
            product.suppliers
          ) : (
            '-'
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
              className={`${MODULE_COLORS.vinyls.text} hover:text-purple-700`}
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
