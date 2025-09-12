import { useState, useEffect } from 'react';
import { VinylItem } from '../InventoryTab';
import { useInventoryAPI } from './useInventoryAPI';

interface UseInventoryDataProps {
  propVinylItems?: VinylItem[];
  propStats?: any;
  propLoading?: boolean;
  onDataLoad?: () => void;
}

interface UseInventoryDataReturn {
  vinylItems: VinylItem[];
  stats: any;
  loading: boolean;
  error: string | null;
  loadVinylData: (filterType?: string) => Promise<void>;
  getDispositionStatus: (item: VinylItem) => { color: string; text: string };
}

export const useInventoryData = ({
  propVinylItems,
  propStats,
  propLoading,
  onDataLoad
}: UseInventoryDataProps): UseInventoryDataReturn => {
  const [localVinylItems, setLocalVinylItems] = useState<VinylItem[]>([]);
  const [localStats, setLocalStats] = useState<any>(null);
  const { loading: apiLoading, error, loadVinylData: apiLoadVinylData } = useInventoryAPI();

  // Use props data if available, otherwise use local state
  const vinylItems = propVinylItems || localVinylItems;
  const loading = propLoading !== undefined ? propLoading : apiLoading;
  const stats = propStats || localStats;

  const loadVinylData = async (filterType?: string) => {
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
    } catch (err) {
      // Error is handled by useInventoryAPI
    }
  };

  useEffect(() => {
    loadVinylData();
  }, []);

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