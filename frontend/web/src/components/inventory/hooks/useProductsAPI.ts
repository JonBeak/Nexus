import { useState, useCallback } from 'react';
import { vinylProductsApi } from '../../../services/api';
import { VinylProduct, VinylProductStats } from '../types';

interface ProductsApiResult {
  products: VinylProduct[];
  stats: VinylProductStats;
}

interface UseProductsAPIReturn {
  loading: boolean;
  error: string | null;
  loadProductsData: () => Promise<ProductsApiResult>;
  refreshData: () => void;
}

export const useProductsAPI = (): UseProductsAPIReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProductsData = useCallback(async (): Promise<ProductsApiResult> => {
    try {
      setLoading(true);
      setError(null);

      const [productsResponse, statsResponse] = await Promise.all([
        vinylProductsApi.getVinylProducts(),
        vinylProductsApi.getVinylProductStats()
      ]);

      // Interceptor unwraps ServiceResult, so we get data directly
      return {
        products: (productsResponse || []) as VinylProduct[],
        stats: (statsResponse || {}) as VinylProductStats
      };
    } catch (err: unknown) {
      console.error('Error loading products data:', err);
      setError('Failed to load product catalog');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshData = useCallback(() => {
    // Trigger refresh after a short delay (for delete operations)
    setTimeout(() => {
      void loadProductsData();
    }, 100);
  }, [loadProductsData]);

  return {
    loading,
    error,
    loadProductsData,
    refreshData
  };
};
