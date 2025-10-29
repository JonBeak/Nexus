import React from 'react';
import { Search, Plus } from 'lucide-react';
import { InventoryFilterType, InventoryUser } from '../types';

interface InventoryFiltersProps {
  user: InventoryUser;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterType: InventoryFilterType;
  setFilterType: (type: InventoryFilterType) => void;
  onShowAddModal: () => void;
}

export const InventoryFilters: React.FC<InventoryFiltersProps> = ({
  user,
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  onShowAddModal
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">Inventory Management</h2>
        {(user.role === 'manager' || user.role === 'owner') && (
          <button
            onClick={onShowAddModal}
            className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Search className="inline w-4 h-4 mr-1" />
            Search Inventory
          </label>
          <input
            type="text"
            placeholder="Search by brand, series, or color..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as InventoryFilterType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="all">All Items</option>
            <option value="in_stock">In Stock</option>
            <option value="used">Used</option>
            <option value="waste">Waste</option>
            <option value="returned">Returned</option>
            <option value="damaged">Damaged</option>
          </select>
        </div>
      </div>
    </div>
  );
};
