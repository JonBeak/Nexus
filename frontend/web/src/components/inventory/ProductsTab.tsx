import React, { useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useProductsData } from './hooks/useProductsData';
import { ProductsTableHeader } from './components/ProductsTableHeader';
import { ProductsTableRow } from './components/ProductsTableRow';
import { InventoryUser, VinylProduct } from './types';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';

interface ProductsTabProps {
  user: InventoryUser;
  onShowAddModal: () => void;
  onEditProduct: (product: VinylProduct) => void;
  onDeleteProduct: (id: number) => void;
  onRefreshReady?: (refreshFn: () => void) => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  user,
  onShowAddModal,
  onEditProduct,
  onDeleteProduct,
  onRefreshReady
}) => {
  const {
    productsLoading,
    productsError,
    refreshProducts,
    handleDelete,
    searchTerm,
    filterType,
    columnFilters,
    sortField,
    sortDirection,
    setSearchTerm,
    setFilterType,
    handleColumnFilter,
    handleSort,
    clearAllFilters,
    getActiveFilterCount,
    getBrandOptions,
    getSeriesOptions,
    getColourNumberOptions,
    getColourNameOptions,
    getSupplierOptions,
    getStatusOptions,
    filteredAndSortedProducts
  } = useProductsData({ onDeleteProduct });

  // Expose refresh function to parent component
  useEffect(() => {
    if (onRefreshReady) {
      onRefreshReady(refreshProducts);
    }
  }, [onRefreshReady, refreshProducts]);

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex justify-between items-center">
        {/* Clear Filters Button */}
        {getActiveFilterCount() > 0 && (
          <button
            onClick={clearAllFilters}
            className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} hover:bg-gray-500`}
            title={`Clear ${getActiveFilterCount()} active filter(s)`}
          >
            <X className="w-4 h-4 mr-1" />
            Clear Filters
            <span className="ml-1 px-1.5 py-0.5 bg-gray-600 text-white text-xs rounded-full">
              {getActiveFilterCount()}
            </span>
          </button>
        )}
        <div className={getActiveFilterCount() > 0 ? '' : 'ml-auto'}>
          {/* Add Product Button - Backend RBAC controls actual permissions */}
          <button
            onClick={onShowAddModal}
            className={`flex items-center space-x-2 ${MODULE_COLORS.vinyls.base} ${MODULE_COLORS.vinyls.hover} text-white px-4 py-2 rounded-lg`}
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className={`${PAGE_STYLES.panel.background} shadow rounded-lg overflow-hidden border ${PAGE_STYLES.panel.border}`}>
        {productsLoading ? (
          <div className="text-center py-12">
            <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${MODULE_COLORS.vinyls.border}`}></div>
            <p className={`mt-2 ${PAGE_STYLES.panel.textSecondary}`}>Loading products...</p>
          </div>
        ) : productsError ? (
          <div className="text-center py-12">
            <div className="text-red-600 text-lg font-medium mb-2">Error</div>
            <p className={`${PAGE_STYLES.panel.textMuted} mb-4`}>{productsError}</p>
            <button
              onClick={refreshProducts}
              className={`${MODULE_COLORS.vinyls.base} ${MODULE_COLORS.vinyls.hover} text-white px-4 py-2 rounded-lg`}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`min-w-full ${PAGE_STYLES.panel.divider}`}>
              <ProductsTableHeader
                user={user}
                sortField={sortField}
                sortDirection={sortDirection}
                columnFilters={columnFilters}
                onSort={handleSort}
                onColumnFilter={handleColumnFilter}
                getBrandOptions={getBrandOptions}
                getSeriesOptions={getSeriesOptions}
                getColourNumberOptions={getColourNumberOptions}
                getColourNameOptions={getColourNameOptions}
                getSupplierOptions={getSupplierOptions}
                getStatusOptions={getStatusOptions}
              />
              <tbody className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.divider}`}>
                {filteredAndSortedProducts.map((product) => (
                  <ProductsTableRow
                    key={product.product_id}
                    product={product}
                    user={user}
                    onEditProduct={onEditProduct}
                    onDeleteProduct={handleDelete}
                  />
                ))}
                {filteredAndSortedProducts.length === 0 && !productsLoading && (
                  <tr>
                    <td colSpan={7} className={`px-6 py-12 text-center ${PAGE_STYLES.panel.textMuted}`}>
                      No products found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
