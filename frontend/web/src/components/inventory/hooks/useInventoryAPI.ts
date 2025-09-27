import { useState } from 'react';
import { vinylApi } from '../../../services/api';
import { InventoryFilterType, InventoryStats, VinylItem } from '../types';

interface InventoryApiResult {
  items: VinylItem[];
  stats: InventoryStats;
}

interface UseInventoryAPIReturn {
  loading: boolean;
  error: string | null;
  loadVinylData: (filterType?: InventoryFilterType) => Promise<InventoryApiResult>;
  refreshData: (filterType?: InventoryFilterType) => Promise<void>;
  clearError: () => void;
}

export const useInventoryAPI = (): UseInventoryAPIReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVinylData = async (filterType?: InventoryFilterType): Promise<InventoryApiResult> => {
    try {
      setLoading(true);
      setError(null);
      
      const [itemsResponse, statsResponse] = await Promise.all([
        vinylApi.getVinylItems({ disposition: filterType !== 'all' ? filterType : undefined }),
        vinylApi.getVinylStats()
      ]);
      
      return {
        items: (itemsResponse || []) as VinylItem[],
        stats: (statsResponse || {}) as InventoryStats
      };
    } catch (err: unknown) {
      console.error('Error loading vinyl data:', err);
      const errorMessage = 'Failed to load vinyl inventory';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async (filterType?: InventoryFilterType): Promise<void> => {
    await loadVinylData(filterType);
  };

  const clearError = () => {
    setError(null);
  };

  return {
    loading,
    error,
    loadVinylData,
    refreshData,
    clearError
  };
};
