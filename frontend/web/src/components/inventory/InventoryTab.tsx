import React from 'react';
import { X, Plus } from 'lucide-react';
import { useInventoryData } from './hooks/useInventoryData';
import { useInventoryFiltering } from './hooks/useInventoryFiltering';
import { InventoryStatsCards } from './components/InventoryStatsCards';
import { InventoryTableHeader } from './components/InventoryTableHeader';
import { InventoryTableRow } from './components/InventoryTableRow';
import { InventoryStats, InventoryUser, VinylItem } from './types';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';

interface InventoryTabProps {
  user: InventoryUser;
  vinylItems?: VinylItem[];
  stats?: InventoryStats | null;
  loading?: boolean;
  onShowAddModal: () => void;
  onEditItem: (item: VinylItem) => void;
  onDeleteItem: (id: number) => void;
  onChangeStatus: (item: VinylItem) => void;
  onDataLoad?: () => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  user,
  vinylItems: propVinylItems,
  stats: propStats,
  loading: propLoading,
  onShowAddModal,
  onEditItem,
  onDeleteItem,
  onChangeStatus,
  onDataLoad
}) => {
  // Use extracted data management hook
  const { vinylItems, stats, loading, error, getDispositionStatus } = useInventoryData({
    propVinylItems,
    propStats,
    propLoading,
    onDataLoad
  });

  // Use extracted filtering hook with vinyl items data
  const {
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    sortedItems,
    columnFilters,
    getBrandOptions,
    getSeriesOptions,
    getColourNumberOptions,
    getColourNameOptions,
    getDispositionOptions,
    getJobOptions,
    handleSort,
    handleColumnFilter,
    clearAllFilters,
    getActiveFilterCount,
    getSortIcon
  } = useInventoryFiltering(vinylItems);

  // Parent handles deletion and data reload
  const handleDelete = (id: number) => {
    onDeleteItem(id);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <InventoryStatsCards stats={stats} />

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
          {/* Add Item Button - Backend RBAC controls actual permissions */}
          <button
            onClick={onShowAddModal}
            className={`flex items-center space-x-2 ${MODULE_COLORS.vinyls.base} ${MODULE_COLORS.vinyls.hover} text-white px-4 py-2 rounded-lg`}
          >
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className={`${PAGE_STYLES.panel.background} shadow rounded-lg overflow-hidden border ${PAGE_STYLES.panel.border}`}>
        {loading ? (
          <div className="text-center py-12">
            <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${MODULE_COLORS.vinyls.border}`}></div>
            <p className={`mt-2 ${PAGE_STYLES.panel.textSecondary}`}>Loading inventory...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 text-lg font-medium mb-2">Error</div>
            <p className={`${PAGE_STYLES.panel.textMuted} mb-4`}>{error}</p>
            {onDataLoad && (
              <button
                onClick={() => {
                  onDataLoad();
                }}
                className={`${MODULE_COLORS.vinyls.base} ${MODULE_COLORS.vinyls.hover} text-white px-4 py-2 rounded-lg`}
              >
                Retry
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`min-w-full ${PAGE_STYLES.panel.divider}`}>
              <InventoryTableHeader
                user={user}
                columnFilters={columnFilters}
                handleSort={handleSort}
                handleColumnFilter={handleColumnFilter}
                getSortIcon={getSortIcon}
                getBrandOptions={getBrandOptions}
                getSeriesOptions={getSeriesOptions}
                getColourNumberOptions={getColourNumberOptions}
                getColourNameOptions={getColourNameOptions}
                getDispositionOptions={getDispositionOptions}
                getJobOptions={getJobOptions}
              />
              <tbody className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.divider}`}>
                {sortedItems.map((item) => (
                  <InventoryTableRow
                    key={item.id}
                    item={item}
                    user={user}
                    onEditItem={onEditItem}
                    onDeleteItem={handleDelete}
                    onChangeStatus={onChangeStatus}
                    getDispositionStatus={getDispositionStatus}
                  />
                ))}
                {sortedItems.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className={`px-6 py-12 text-center ${PAGE_STYLES.panel.textMuted}`}>
                      No vinyl items found matching your criteria.
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
