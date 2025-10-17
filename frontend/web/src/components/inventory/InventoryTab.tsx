import React from 'react';
import { useInventoryData } from './hooks/useInventoryData';
import { useInventoryFiltering } from './hooks/useInventoryFiltering';
import { InventoryStatsCards } from './components/InventoryStatsCards';
import { InventoryFilters } from './components/InventoryFilters';
import { InventoryTableHeader } from './components/InventoryTableHeader';
import { InventoryTableRow } from './components/InventoryTableRow';
import { InventoryStats, InventoryUser, VinylItem } from './types';

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

      {/* Filters */}
      <InventoryFilters
        user={user}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterType={filterType}
        setFilterType={setFilterType}
        clearAllFilters={clearAllFilters}
        getActiveFilterCount={getActiveFilterCount}
        onShowAddModal={onShowAddModal}
      />

      {/* Inventory Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="mt-2 text-gray-600">Loading inventory...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 text-lg font-medium mb-2">Error</div>
            <p className="text-gray-500 mb-4">{error}</p>
            {onDataLoad && (
              <button
                onClick={() => {
                  onDataLoad();
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                Retry
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
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
              />
              <tbody className="bg-white divide-y divide-gray-200">
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
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
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
