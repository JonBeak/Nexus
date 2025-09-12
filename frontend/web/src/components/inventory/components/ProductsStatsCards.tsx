import React from 'react';
import { Package, TrendingUp } from 'lucide-react';

interface ProductsStatsCardsProps {
  stats: {
    total_products?: number;
    active_products?: number;
    brand_count?: number;
    supplier_count?: number;
  } | null;
}

export const ProductsStatsCards: React.FC<ProductsStatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Package className="w-6 h-6 text-purple-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Total Products</p>
            <p className="text-2xl font-semibold text-gray-900">{stats?.total_products || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-green-100 rounded-lg">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Active Products</p>
            <p className="text-2xl font-semibold text-gray-900">{stats?.active_products || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Brands</p>
            <p className="text-2xl font-semibold text-gray-900">{stats?.brand_count || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Package className="w-6 h-6 text-orange-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Suppliers</p>
            <p className="text-2xl font-semibold text-gray-900">{stats?.supplier_count || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
};