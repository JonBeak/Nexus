import { useState } from 'react';
import { vinylApi } from '../../../services/api';
import { VinylItem } from '../InventoryTab';

interface UseInventoryAPIReturn {
  loading: boolean;
  error: string | null;
  loadVinylData: (filterType?: string) => Promise<{ items: VinylItem[]; stats: any }>;
  refreshData: (filterType?: string) => Promise<void>;
  clearError: () => void;
}

export const useInventoryAPI = (): UseInventoryAPIReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVinylData = async (filterType?: string): Promise<{ items: VinylItem[]; stats: any }> => {
    try {
      setLoading(true);
      setError(null);
      
      const [itemsResponse, statsResponse] = await Promise.all([
        vinylApi.getVinylItems({ disposition: filterType !== 'all' ? filterType : undefined }),
        vinylApi.getVinylStats()
      ]);
      
      return {
        items: itemsResponse || [],
        stats: statsResponse || {}
      };
    } catch (err: any) {
      console.error('Error loading vinyl data:', err);
      const errorMessage = 'Failed to load vinyl inventory';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async (filterType?: string): Promise<void> => {
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