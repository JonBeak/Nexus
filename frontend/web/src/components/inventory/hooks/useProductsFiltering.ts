import { useState, useMemo, useCallback } from 'react';
import { ProductFilterType, VinylProduct } from '../types';

export interface ProductsColumnFilters {
  brand: string;
  series: string;
  colour_number: string;
  colour_name: string;
  suppliers: string;
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
    suppliers: ''
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
      suppliers: ''
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

  const getBrandOptions = useMemo(() => {
    // Apply contextual filtering - show brands that match OTHER selected filters
    const contextualProducts = products.filter(p => {
      return (!columnFilters.series || p.series === columnFilters.series) &&
             (!columnFilters.colour_number || getColourNumber(p) === columnFilters.colour_number) &&
             (!columnFilters.colour_name || getColourName(p) === columnFilters.colour_name);
    });
    
    const brands = Array.from(new Set(contextualProducts.map(p => p.brand).filter(Boolean))).sort();
    const brandOptions = brands.map(brand => {
      const count = contextualProducts.filter(p => p.brand === brand).length;
      return `${brand} (${count})`;
    });
    
    return ['---', ...brandOptions];
  }, [products, columnFilters.series, columnFilters.colour_number, columnFilters.colour_name, getColourNumber, getColourName]);

  const getSeriesOptions = useMemo(() => {
    // Apply contextual filtering - show series that match OTHER selected filters
    const contextualProducts = products.filter(p => {
      return (!columnFilters.brand || p.brand === columnFilters.brand) &&
             (!columnFilters.colour_number || getColourNumber(p) === columnFilters.colour_number) &&
             (!columnFilters.colour_name || getColourName(p) === columnFilters.colour_name);
    });
    
    const series = Array.from(new Set(contextualProducts.map(p => p.series).filter(Boolean))).sort();
    const seriesOptions = series.map(s => {
      const count = contextualProducts.filter(p => p.series === s).length;
      return `${s} (${count})`;
    });
    
    return ['---', ...seriesOptions];
  }, [products, columnFilters.brand, columnFilters.colour_number, columnFilters.colour_name, getColourNumber, getColourName]);

  const getColourNumberOptions = useMemo(() => {
    // Apply contextual filtering - show color numbers that match OTHER selected filters
    const contextualProducts = products.filter(p => {
      return (!columnFilters.brand || p.brand === columnFilters.brand) &&
             (!columnFilters.series || p.series === columnFilters.series) &&
             (!columnFilters.colour_name || getColourName(p) === columnFilters.colour_name);
    });
    
    const colours = Array.from(new Set(contextualProducts.map(p => getColourNumber(p)).filter(Boolean))).sort();
    const colourNumberOptions = colours.map(colour => {
      const count = contextualProducts.filter(p => getColourNumber(p) === colour).length;
      return `${colour} (${count})`;
    });
    
    return ['---', ...colourNumberOptions];
  }, [products, columnFilters.brand, columnFilters.series, columnFilters.colour_name, getColourNumber, getColourName]);

  const getColourNameOptions = useMemo(() => {
    // Apply contextual filtering - show color names that match OTHER selected filters
    const contextualProducts = products.filter(p => {
      return (!columnFilters.brand || p.brand === columnFilters.brand) &&
             (!columnFilters.series || p.series === columnFilters.series) &&
             (!columnFilters.colour_number || getColourNumber(p) === columnFilters.colour_number);
    });
    
    const colours = Array.from(new Set(contextualProducts.map(p => getColourName(p)).filter(Boolean))).sort();
    const colourNameOptions = colours.map(colour => {
      const count = contextualProducts.filter(p => getColourName(p) === colour).length;
      return `${colour} (${count})`;
    });
    
    return ['---', ...colourNameOptions];
  }, [products, columnFilters.brand, columnFilters.series, columnFilters.colour_number, getColourNumber, getColourName]);

  const getSupplierOptions = useMemo(() => {
    const suppliers = Array.from(new Set(products.map(p => p.suppliers).filter(Boolean))).sort();
    const supplierOptions = suppliers.map(supplier => {
      const count = products.filter(p => p.suppliers === supplier).length;
      return `${supplier} (${count})`;
    });
    
    return ['---', ...supplierOptions];
  }, [products]);

  // Filtered and sorted products
  const filteredAndSortedProducts = useMemo(() => {
    const filtered = products.filter(product => {
      // Global search
      if (searchTerm) {
        const searchFields = [
          product.brand,
          product.series,
          product.colour,
          product.colour_number,
          product.colour_name,
          product.suppliers
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchFields.includes(searchTerm.toLowerCase())) {
          return false;
        }
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

      return true;
    });

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
  }, [products, searchTerm, filterType, columnFilters, sortField, sortDirection, getColourNumber, getColourName]);

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
    filteredAndSortedProducts
  };
};
