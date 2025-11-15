import { useState, useEffect, useCallback } from 'react';
import { ProductFilterType, VinylProduct, VinylProductStats } from '../types';
import { useProductsAPI } from './useProductsAPI';
import { ProductsColumnFilters, ProductsSortField, useProductsFiltering } from './useProductsFiltering';

interface UseProductsDataReturn {
  products: VinylProduct[];
  productsStats: VinylProductStats | null;
  productsLoading: boolean;
  productsError: string | null;
  refreshProducts: () => void;
  handleDelete: (id: number) => void;
  // Filtering interface
  searchTerm: string;
  filterType: ProductFilterType;
  columnFilters: ProductsColumnFilters;
  sortField: ProductsSortField;
  sortDirection: 'asc' | 'desc';
  setSearchTerm: (term: string) => void;
  setFilterType: (type: ProductFilterType) => void;
  handleColumnFilter: (column: keyof ProductsColumnFilters, value: string) => void;
  handleSort: (field: ProductsSortField) => void;
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
  const [productsStats, setProductsStats] = useState<VinylProductStats | null>(null);

  const { loading: productsLoading, error: productsError, loadProductsData } = useProductsAPI();
  
  const filtering = useProductsFiltering(products);

  const loadData = useCallback(async () => {
    try {
      const { products: loadedProducts, stats } = await loadProductsData();
      setProducts(loadedProducts);
      setProductsStats(stats);
    } catch {
      // Error is handled by useProductsAPI
    }
  }, [loadProductsData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refreshProducts = useCallback(() => {
    void loadData();
  }, [loadData]);

  const handleDelete = useCallback((id: number) => {
    // Parent component (VinylInventory) handles the confirmation modal and refresh
    onDeleteProduct(id);
  }, [onDeleteProduct]);

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
