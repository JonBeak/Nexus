import React from 'react';
import { Package, TrendingUp, TrendingDown } from 'lucide-react';
import { InventoryStats } from '../types';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

interface InventoryStatsCardsProps {
  stats: InventoryStats | null;
}

export const InventoryStatsCards: React.FC<InventoryStatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6 border ${PAGE_STYLES.panel.border}`}>
        <div className="flex items-center">
          <div className={`p-2 ${MODULE_COLORS.vinyls.light} rounded-lg`}>
            <Package className={`w-6 h-6 ${MODULE_COLORS.vinyls.text}`} />
          </div>
          <div className="ml-4">
            <p className={`text-sm font-medium ${PAGE_STYLES.panel.textMuted}`}>Total Items</p>
            <p className={`text-2xl font-semibold ${PAGE_STYLES.panel.text}`}>
              {stats?.total_items || 0}
              <span className={`text-sm ${PAGE_STYLES.panel.textMuted} ml-1`}>({(Number(stats?.total_yards_all) || 0).toFixed(1)} yds)</span>
            </p>
          </div>
        </div>
      </div>

      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6 border ${PAGE_STYLES.panel.border}`}>
        <div className="flex items-center">
          <div className="p-2 bg-green-100 rounded-lg">
            <Package className="w-6 h-6 text-green-600" />
          </div>
          <div className="ml-4">
            <p className={`text-sm font-medium ${PAGE_STYLES.panel.textMuted}`}>In Stock</p>
            <p className={`text-2xl font-semibold ${PAGE_STYLES.panel.text}`}>
              {stats?.in_stock_count || 0}
              <span className={`text-sm ${PAGE_STYLES.panel.textMuted} ml-1`}>({(Number(stats?.total_yards_in_stock) || 0).toFixed(1)} yds)</span>
            </p>
          </div>
        </div>
      </div>

      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6 border ${PAGE_STYLES.panel.border}`}>
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 rounded-lg">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className={`text-sm font-medium ${PAGE_STYLES.panel.textMuted}`}>Used</p>
            <p className={`text-2xl font-semibold ${PAGE_STYLES.panel.text}`}>
              {stats?.used_count || 0}
              <span className={`text-sm ${PAGE_STYLES.panel.textMuted} ml-1`}>({(Number(stats?.total_yards_used) || 0).toFixed(1)} yds)</span>
            </p>
          </div>
        </div>
      </div>

      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-6 border ${PAGE_STYLES.panel.border}`}>
        <div className="flex items-center">
          <div className="p-2 bg-red-100 rounded-lg">
            <TrendingDown className="w-6 h-6 text-red-600" />
          </div>
          <div className="ml-4">
            <p className={`text-sm font-medium ${PAGE_STYLES.panel.textMuted}`}>Waste</p>
            <p className={`text-2xl font-semibold ${PAGE_STYLES.panel.text}`}>
              {stats?.waste_count || 0}
              <span className={`text-sm ${PAGE_STYLES.panel.textMuted} ml-1`}>({(Number(stats?.total_yards_waste) || 0).toFixed(1)} yds)</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
