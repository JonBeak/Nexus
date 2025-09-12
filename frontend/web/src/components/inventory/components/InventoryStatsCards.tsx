import React from 'react';
import { Package, TrendingUp, TrendingDown } from 'lucide-react';

interface InventoryStatsCardsProps {
  stats: any;
}

export const InventoryStatsCards: React.FC<InventoryStatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Package className="w-6 h-6 text-purple-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Total Items</p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats?.total_items || 0} 
              <span className="text-sm text-gray-500 ml-1">({(Number(stats?.total_yards_all) || 0).toFixed(1)} yds)</span>
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-green-100 rounded-lg">
            <Package className="w-6 h-6 text-green-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">In Stock</p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats?.in_stock_count || 0} 
              <span className="text-sm text-gray-500 ml-1">({(Number(stats?.total_yards_in_stock) || 0).toFixed(1)} yds)</span>
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 rounded-lg">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Used</p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats?.used_count || 0} 
              <span className="text-sm text-gray-500 ml-1">({(Number(stats?.total_yards_used) || 0).toFixed(1)} yds)</span>
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="p-2 bg-red-100 rounded-lg">
            <TrendingDown className="w-6 h-6 text-red-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Waste</p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats?.waste_count || 0} 
              <span className="text-sm text-gray-500 ml-1">({(Number(stats?.total_yards_waste) || 0).toFixed(1)} yds)</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};