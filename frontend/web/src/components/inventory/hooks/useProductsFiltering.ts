import { useState, useMemo, useCallback } from 'react';
import { ProductFilterType, VinylProduct } from '../types';

export interface ProductsColumnFilters {
  brand: string;
  series: string;
  colour_number: string;
  colour_name: string;
  suppliers: string;
  status: string;
}

interface UseProductsFilteringReturn {
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
  getStatusOptions: string[];
  filteredAndSortedProducts: VinylProduct[];
}

export type ProductsSortField = 'brand' | 'series' | 'colour_number' | 'colour_name' | 'suppliers' | 'status';

export const useProductsFiltering = (products: VinylProduct[]): UseProductsFilteringReturn => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ProductFilterType>('all');
  const [columnFilters, setColumnFilters] = useState<ProductsColumnFilters>({
    brand: '',
    series: '',
    colour_number: '',
    colour_name: '',
    suppliers: '',
    status: ''
  });
  const [sortField, setSortField] = useState<ProductsSortField>('brand');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleColumnFilter = useCallback((column: keyof ProductsColumnFilters, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  }, []);

  const handleSort = useCallback((field: ProductsSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  const clearAllFilters = useCallback(() => {
    setColumnFilters({
      brand: '',
      series: '',
      colour_number: '',
      colour_name: '',
      suppliers: '',
      status: ''
    });
    setFilterType('all');
    setSearchTerm('');
  }, []);

  const getActiveFilterCount = useCallback(() => {
    const activeColumnFilters = Object.values(columnFilters).filter(value => value !== '').length;
    return activeColumnFilters + (filterType !== 'all' ? 1 : 0) + (searchTerm !== '' ? 1 : 0);
  }, [columnFilters, filterType, searchTerm]);

  // Helper function to extract colour number with fallback
  const getColourNumber = useCallback((product: VinylProduct) => {
    return product.colour_number || product.colour?.split(' ')[0] || '';
  }, []);

  // Helper function to extract colour name with fallback
  const getColourName = useCallback((product: VinylProduct) => {
    return product.colour_name || product.colour?.split(' ').slice(1).join(' ') || '';
  }, []);

  // Pre-calculate lowercase search strings for each product (cached once when data loads)
  const productsWithSearchCache = useMemo(() => {
    return products.map(product => ({
      product,
      searchFieldsLower: [
        product.brand,
        product.series,
        product.colour,
        product.colour_number,
        product.colour_name,
        product.suppliers
      ].filter(Boolean).join(' ').toLowerCase()
    }));
  }, [products]);

  const getBrandOptions = useMemo(() => {
    // Apply contextual filtering - show brands that match OTHER selected filters (without counts for performance)
    const contextualProducts = products.filter(p => {
      return (!columnFilters.series || p.series === columnFilters.series) &&
             (!columnFilters.colour_number || getColourNumber(p) === columnFilters.colour_number) &&
             (!columnFilters.colour_name || getColourName(p) === columnFilters.colour_name);
    });

    const brands = Array.from(new Set(contextualProducts.map(p => p.brand).filter(Boolean))).sort();

    return ['---', ...brands];
  }, [products, columnFilters.series, columnFilters.colour_number, columnFilters.colour_name, getColourNumber, getColourName]);

  const getSeriesOptions = useMemo(() => {
    // Apply contextual filtering - show series that match OTHER selected filters (without counts for performance)
    const contextualProducts = products.filter(p => {
      return (!columnFilters.brand || p.brand === columnFilters.brand) &&
             (!columnFilters.colour_number || getColourNumber(p) === columnFilters.colour_number) &&
             (!columnFilters.colour_name || getColourName(p) === columnFilters.colour_name);
    });

    const series = Array.from(new Set(contextualProducts.map(p => p.series).filter(Boolean))).sort();

    return ['---', ...series];
  }, [products, columnFilters.brand, columnFilters.colour_number, columnFilters.colour_name, getColourNumber, getColourName]);

  const getColourNumberOptions = useMemo(() => {
    // Apply contextual filtering - show color numbers that match OTHER selected filters (without counts for performance)
    const contextualProducts = products.filter(p => {
      return (!columnFilters.brand || p.brand === columnFilters.brand) &&
             (!columnFilters.series || p.series === columnFilters.series) &&
             (!columnFilters.colour_name || getColourName(p) === columnFilters.colour_name);
    });

    const colours = Array.from(new Set(contextualProducts.map(p => getColourNumber(p)).filter(Boolean))).sort();

    return ['---', ...colours];
  }, [products, columnFilters.brand, columnFilters.series, columnFilters.colour_name, getColourNumber, getColourName]);

  const getColourNameOptions = useMemo(() => {
    // Apply contextual filtering - show color names that match OTHER selected filters (without counts for performance)
    const contextualProducts = products.filter(p => {
      return (!columnFilters.brand || p.brand === columnFilters.brand) &&
             (!columnFilters.series || p.series === columnFilters.series) &&
             (!columnFilters.colour_number || getColourNumber(p) === columnFilters.colour_number);
    });

    const colours = Array.from(new Set(contextualProducts.map(p => getColourName(p)).filter(Boolean))).sort();

    return ['---', ...colours];
  }, [products, columnFilters.brand, columnFilters.series, columnFilters.colour_number, getColourNumber, getColourName]);

  const getSupplierOptions = useMemo(() => {
    const suppliers = Array.from(new Set(products.map(p => p.suppliers).filter(Boolean))).sort();

    return ['---', ...suppliers];
  }, [products]);

  const getStatusOptions = useMemo(() => {
    const contextualProducts = products.filter(p => {
      return (!columnFilters.brand || p.brand === columnFilters.brand) &&
             (!columnFilters.series || p.series === columnFilters.series) &&
             (!columnFilters.colour_number || getColourNumber(p) === columnFilters.colour_number) &&
             (!columnFilters.colour_name || getColourName(p) === columnFilters.colour_name) &&
             (!columnFilters.suppliers || p.suppliers === columnFilters.suppliers);
    });

    const statuses = Array.from(new Set(contextualProducts.map(p => p.is_active ? 'Active' : 'Inactive'))).sort();

    return ['---', ...statuses];
  }, [products, columnFilters, getColourNumber, getColourName]);

  // Filtered and sorted products
  const filteredAndSortedProducts = useMemo(() => {
    // Pre-calculate lowercased search term once (not per product)
    const searchTermLower = searchTerm.toLowerCase();

    const filtered = productsWithSearchCache
      .filter(({ product, searchFieldsLower }) => {
        // Global search
        if (searchTerm && !searchFieldsLower.includes(searchTermLower)) {
          return false;
        }

        // Status filter
        if (filterType === 'active' && !product.is_active) return false;
        if (filterType === 'inactive' && product.is_active) return false;

        // Column filters
        if (columnFilters.brand && product.brand !== columnFilters.brand) return false;
        if (columnFilters.series && product.series !== columnFilters.series) return false;
        if (columnFilters.colour_number && getColourNumber(product) !== columnFilters.colour_number) return false;
        if (columnFilters.colour_name && getColourName(product) !== columnFilters.colour_name) return false;
        if (columnFilters.suppliers && product.suppliers !== columnFilters.suppliers) return false;
        if (columnFilters.status) {
          const productStatus = product.is_active ? 'Active' : 'Inactive';
          if (productStatus !== columnFilters.status) return false;
        }

        return true;
      })
      .map(({ product }) => product);

    // Sort products
    filtered.sort((a, b) => {
      let aValue = '';
      let bValue = '';

      switch (sortField) {
        case 'brand':
          aValue = a.brand || '';
          bValue = b.brand || '';
          break;
        case 'series':
          aValue = a.series || '';
          bValue = b.series || '';
          break;
        case 'colour_number':
          aValue = getColourNumber(a);
          bValue = getColourNumber(b);
          break;
        case 'colour_name':
          aValue = getColourName(a);
          bValue = getColourName(b);
          break;
        case 'suppliers':
          aValue = a.suppliers || '';
          bValue = b.suppliers || '';
          break;
        case 'status':
          aValue = a.is_active ? 'Active' : 'Inactive';
          bValue = b.is_active ? 'Active' : 'Inactive';
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

    return filtered;
  }, [productsWithSearchCache, searchTerm, filterType, columnFilters, sortField, sortDirection, getColourNumber, getColourName]);

  return {
    searchTerm,
    filterType,
    columnFilters,
    sortField,
    sortDirection,
    setSearchTerm,
    setFilterType,
    handleColumnFilter,
    handleSort,
    clearAllFilters,
    getActiveFilterCount,
    getBrandOptions,
    getSeriesOptions,
    getColourNumberOptions,
    getColourNameOptions,
    getSupplierOptions,
    getStatusOptions,
    filteredAndSortedProducts
  };
};
