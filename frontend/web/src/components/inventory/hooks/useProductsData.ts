import { useState, useEffect, useCallback } from 'react';
import { VinylProduct } from '../ProductsTab';
import { useProductsAPI } from './useProductsAPI';
import { useProductsFiltering } from './useProductsFiltering';

interface UseProductsDataReturn {
  products: VinylProduct[];
  productsStats: any;
  productsLoading: boolean;
  productsError: string | null;
  refreshProducts: () => void;
  handleDelete: (id: number) => void;
  // Filtering interface
  searchTerm: string;
  filterType: string;
  columnFilters: any;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  setSearchTerm: (term: string) => void;
  setFilterType: (type: string) => void;
  handleColumnFilter: (column: string, value: string) => void;
  handleSort: (field: string) => void;
  clearAllFilters: () => void;
  getActiveFilterCount: () => number;
  getBrandOptions: string[];
  getSeriesOptions: string[];
  getColourNumberOptions: string[];
  getColourNameOptions: string[];
  getSupplierOptions: string[];
  filteredAndSortedProducts: VinylProduct[];
}

interface UseProductsDataProps {
  onDeleteProduct: (id: number) => void;
}

export const useProductsData = ({ onDeleteProduct }: UseProductsDataProps): UseProductsDataReturn => {
  const [products, setProducts] = useState<VinylProduct[]>([]);
  const [productsStats, setProductsStats] = useState<any>(null);

  const { loading: productsLoading, error: productsError, loadProductsData, refreshData } = useProductsAPI();
  
  const filtering = useProductsFiltering(products);

  const loadData = useCallback(async () => {
    try {
      const { products: loadedProducts, stats } = await loadProductsData();
      setProducts(loadedProducts);
      setProductsStats(stats);
    } catch (err) {
      // Error is handled by useProductsAPI
    }
  }, [loadProductsData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshProducts = useCallback(() => {
    loadData();
  }, [loadData]);

  const handleDelete = useCallback((id: number) => {
    onDeleteProduct(id);
    // Refresh data after deletion
    setTimeout(() => loadData(), 100);
  }, [onDeleteProduct, loadData]);

  return {
    products,
    productsStats,
    productsLoading,
    productsError,
    refreshProducts,
    handleDelete,
    ...filtering
  };
};