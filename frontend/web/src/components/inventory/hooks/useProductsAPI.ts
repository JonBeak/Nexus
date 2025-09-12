import { useState, useCallback } from 'react';
import { vinylProductsApi } from '../../../services/api';
import { VinylProduct } from '../ProductsTab';

interface UseProductsAPIReturn {
  loading: boolean;
  error: string | null;
  loadProductsData: () => Promise<{ products: VinylProduct[], stats: any }>;
  refreshData: () => void;
}

export const useProductsAPI = (): UseProductsAPIReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProductsData = useCallback(async (): Promise<{ products: VinylProduct[], stats: any }> => {
    try {
      setLoading(true);
      setError(null);
      
      const [productsResponse, statsResponse] = await Promise.all([
        vinylProductsApi.getVinylProducts(),
        vinylProductsApi.getVinylProductStats()
      ]);
      
      return {
        products: productsResponse || [],
        stats: statsResponse || {}
      };
    } catch (err: any) {
      console.error('Error loading products data:', err);
      setError('Failed to load product catalog');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshData = useCallback(() => {
    // Trigger refresh after a short delay (for delete operations)
    setTimeout(() => loadProductsData(), 100);
  }, [loadProductsData]);

  return {
    loading,
    error,
    loadProductsData,
    refreshData
  };
};