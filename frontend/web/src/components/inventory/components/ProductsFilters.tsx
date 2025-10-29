import React from 'react';
import { Search, Plus } from 'lucide-react';
import { InventoryUser, ProductFilterType } from '../types';

interface ProductsFiltersProps {
  user: InventoryUser;
  searchTerm: string;
  filterType: ProductFilterType;
  onSearchChange: (value: string) => void;
  onFilterTypeChange: (value: ProductFilterType) => void;
  onShowAddModal: () => void;
}

export const ProductsFilters: React.FC<ProductsFiltersProps> = ({
  user,
  searchTerm,
  filterType,
  onSearchChange,
  onFilterTypeChange,
  onShowAddModal
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">Product Catalog</h2>
        {(user.role === 'manager' || user.role === 'owner') && (
          <button
            onClick={onShowAddModal}
            className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Search className="inline w-4 h-4 mr-1" />
            Search Products
          </label>
          <input
            type="text"
            placeholder="Search by brand, series, color, or supplier..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
          <select
            value={filterType}
            onChange={(e) => onFilterTypeChange(e.target.value as ProductFilterType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="all">All Products</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
    </div>
  );
};
