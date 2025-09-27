import React from 'react';
import { useProductsData } from './hooks/useProductsData';
import { ProductsStatsCards } from './components/ProductsStatsCards';
import { ProductsFilters } from './components/ProductsFilters';
import { ProductsTableHeader } from './components/ProductsTableHeader';
import { ProductsTableRow } from './components/ProductsTableRow';
import { InventoryUser, VinylProduct } from './types';

interface ProductsTabProps {
  user: InventoryUser;
  onShowAddModal: () => void;
  onEditProduct: (product: VinylProduct) => void;
  onDeleteProduct: (id: number) => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  user,
  onShowAddModal,
  onEditProduct,
  onDeleteProduct
}) => {
  const {
    productsStats,
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
    filteredAndSortedProducts
  } = useProductsData({ onDeleteProduct });

  return (
    <div className="space-y-6">
      {/* Product Summary Cards */}
      <ProductsStatsCards stats={productsStats} />

      {/* Product Filters */}
      <ProductsFilters
        user={user}
        searchTerm={searchTerm}
        filterType={filterType}
        onSearchChange={setSearchTerm}
        onFilterTypeChange={setFilterType}
        onShowAddModal={onShowAddModal}
        onClearFilters={clearAllFilters}
        activeFilterCount={getActiveFilterCount()}
      />

      {/* Products Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {productsLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="mt-2 text-gray-600">Loading products...</p>
          </div>
        ) : productsError ? (
          <div className="text-center py-12">
            <div className="text-red-600 text-lg font-medium mb-2">Error</div>
            <p className="text-gray-500 mb-4">{productsError}</p>
            <button
              onClick={refreshProducts}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
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
              />
              <tbody className="bg-white divide-y divide-gray-200">
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
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
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
