import { useState, useEffect, useCallback } from 'react';
import { InventoryFilterType, InventoryStats, VinylItem } from '../types';
import { useInventoryAPI } from './useInventoryAPI';

interface UseInventoryDataProps {
  propVinylItems?: VinylItem[];
  propStats?: InventoryStats | null;
  propLoading?: boolean;
  onDataLoad?: () => void;
}

interface UseInventoryDataReturn {
  vinylItems: VinylItem[];
  stats: InventoryStats | null;
  loading: boolean;
  error: string | null;
  loadVinylData: (filterType?: InventoryFilterType) => Promise<void>;
  getDispositionStatus: (item: VinylItem) => { color: string; text: string };
}

export const useInventoryData = ({
  propVinylItems,
  propStats,
  propLoading,
  onDataLoad
}: UseInventoryDataProps): UseInventoryDataReturn => {
  const [localVinylItems, setLocalVinylItems] = useState<VinylItem[]>([]);
  const [localStats, setLocalStats] = useState<InventoryStats | null>(null);
  const { loading: apiLoading, error, loadVinylData: apiLoadVinylData } = useInventoryAPI();

  // Use props data if available, otherwise use local state
  const vinylItems = propVinylItems || localVinylItems;
  const loading = propLoading !== undefined ? propLoading : apiLoading;
  const stats = propStats || localStats;

  const loadVinylData = useCallback(async (filterType?: InventoryFilterType) => {
    // If we're using props data, delegate to parent
    if (propVinylItems && onDataLoad) {
      onDataLoad();
      return;
    }

    // Otherwise load data locally
    try {
      const { items, stats: loadedStats } = await apiLoadVinylData(filterType);
      setLocalVinylItems(items);
      setLocalStats(loadedStats);
    } catch (error) {
      // Error is handled by useInventoryAPI
      console.error('Failed to load inventory data:', error);
    }
  }, [apiLoadVinylData, onDataLoad, propVinylItems]);

  useEffect(() => {
    void loadVinylData();
  }, [loadVinylData]);

  const getDispositionStatus = (item: VinylItem) => {
    switch (item.disposition) {
      case 'in_stock':
        return { color: 'text-green-600', text: 'In Stock' };
      case 'used':
        return { color: 'text-blue-600', text: 'Used' };
      case 'waste':
        return { color: 'text-red-600', text: 'Waste' };
      case 'returned':
        return { color: 'text-yellow-600', text: 'Returned' };
      case 'damaged':
        return { color: 'text-orange-600', text: 'Damaged' };
      default:
        return { color: 'text-gray-600', text: 'Unknown' };
    }
  };

  return {
    vinylItems,
    stats,
    loading,
    error,
    loadVinylData,
    getDispositionStatus
  };
};
