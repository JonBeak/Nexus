import { useState, useMemo, useCallback } from 'react';
import { InventoryFilterType, VinylItem } from '../types';

export interface InventoryColumnFilters {
  brand: string;
  series: string;
  colour_number: string;
  colour_name: string;
}

export type InventorySortField = keyof Pick<
  VinylItem,
  'brand' | 'series' | 'colour_number' | 'colour_name' | 'width' | 'length_yards' |
    'disposition' | 'storage_date' | 'purchase_date' | 'created_at' | 'updated_at'
>;

interface UseInventoryFilteringReturn {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterType: InventoryFilterType;
  setFilterType: (type: InventoryFilterType) => void;
  sortField: InventorySortField;
  setSortField: (field: InventorySortField) => void;
  sortDirection: 'asc' | 'desc';
  setSortDirection: (direction: 'asc' | 'desc') => void;
  columnFilters: InventoryColumnFilters;
  setColumnFilters: (filters: InventoryColumnFilters) => void;
  filteredItems: VinylItem[];
  sortedItems: VinylItem[];
  getBrandOptions: string[];
  getSeriesOptions: string[];
  getColourNumberOptions: string[];
  getColourNameOptions: string[];
  handleSort: (field: InventorySortField) => void;
  handleColumnFilter: (column: keyof InventoryColumnFilters, value: string) => void;
  clearAllFilters: () => void;
  getActiveFilterCount: () => number;
  getSortIcon: (field: InventorySortField) => string;
}

export const useInventoryFiltering = (vinylItems: VinylItem[]): UseInventoryFilteringReturn => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<InventoryFilterType>('in_stock');
  const [sortField, setSortField] = useState<InventorySortField>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnFilters, setColumnFilters] = useState<InventoryColumnFilters>({
    brand: '',
    series: '',
    colour_number: '',
    colour_name: ''
  });

  const handleSort = useCallback((field: InventorySortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  const handleColumnFilter = useCallback((column: keyof InventoryColumnFilters, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setColumnFilters({
      brand: '',
      series: '',
      colour_number: '',
      colour_name: ''
    });
    setSearchTerm('');
  }, []);

  const getActiveFilterCount = useCallback(() => {
    const filterCount = Object.values(columnFilters).filter(value => value.trim() !== '').length;
    return searchTerm.trim() !== '' ? filterCount + 1 : filterCount;
  }, [columnFilters, searchTerm]);

  const getSortIcon = (field: InventorySortField): string => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const normalizeValue = (value: VinylItem[InventorySortField] | undefined): string => {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).toLowerCase();
  };

  // Filter items based on all criteria
  const filteredItems = useMemo(() => {
    return vinylItems.filter(item => {
      const searchFields = [
        item.brand,
        item.series,
        item.colour_number,
        item.colour_name
      ].filter(Boolean).join(' ').toLowerCase();
      
      const matchesSearch = searchTerm === '' || searchFields.includes(searchTerm.toLowerCase());
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      
      // Column-specific filters
      const matchesBrand = !columnFilters.brand || 
        (item.brand && item.brand.toLowerCase().includes(columnFilters.brand.toLowerCase()));
      const matchesSeries = !columnFilters.series || 
        (item.series && item.series.toLowerCase().includes(columnFilters.series.toLowerCase()));
      const matchesColourNumber = !columnFilters.colour_number || 
        (item.colour_number && item.colour_number.toLowerCase().includes(columnFilters.colour_number.toLowerCase()));
      const matchesColourName = !columnFilters.colour_name || 
        (item.colour_name && item.colour_name.toLowerCase().includes(columnFilters.colour_name.toLowerCase()));
      
      return matchesSearch && matchesStatus && matchesBrand && matchesSeries && 
             matchesColourNumber && matchesColourName;
    });
  }, [vinylItems, searchTerm, filterType, columnFilters]);

  // Sort the filtered items
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aValue = normalizeValue(a[sortField]);
      const bValue = normalizeValue(b[sortField]);

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortDirection]);

  // Generate contextual dropdown options with counts
  const getBrandOptions = useMemo(() => {
    const contextualItems = vinylItems.filter(item => {
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      const matchesSeries = !columnFilters.series || (item.series && item.series.toLowerCase().includes(columnFilters.series.toLowerCase()));
      const matchesColourNumber = !columnFilters.colour_number || (item.colour_number && item.colour_number.toLowerCase().includes(columnFilters.colour_number.toLowerCase()));
      const matchesColourName = !columnFilters.colour_name || (item.colour_name && item.colour_name.toLowerCase().includes(columnFilters.colour_name.toLowerCase()));
      return matchesStatus && matchesSeries && matchesColourNumber && matchesColourName;
    });
    
    const brandCounts = contextualItems.reduce((acc, item) => {
      if (item.brand) {
        acc[item.brand] = (acc[item.brand] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const brands = Object.keys(brandCounts).sort();
    const brandOptions = brands.map(brand => `${brand} (${brandCounts[brand]})`);
    
    return ['---', ...brandOptions];
  }, [vinylItems, columnFilters, filterType]);

  const getSeriesOptions = useMemo(() => {
    const contextualItems = vinylItems.filter(item => {
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      const matchesBrand = !columnFilters.brand || (item.brand && item.brand.toLowerCase().includes(columnFilters.brand.toLowerCase()));
      const matchesColourNumber = !columnFilters.colour_number || (item.colour_number && item.colour_number.toLowerCase().includes(columnFilters.colour_number.toLowerCase()));
      const matchesColourName = !columnFilters.colour_name || (item.colour_name && item.colour_name.toLowerCase().includes(columnFilters.colour_name.toLowerCase()));
      return matchesStatus && matchesBrand && matchesColourNumber && matchesColourName;
    });
    
    const seriesCounts = contextualItems.reduce((acc, item) => {
      if (item.series) {
        acc[item.series] = (acc[item.series] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const series = Object.keys(seriesCounts).sort();
    const seriesOptions = series.map(series => `${series} (${seriesCounts[series]})`);
    
    return ['---', ...seriesOptions];
  }, [vinylItems, columnFilters, filterType]);

  const getColourNumberOptions = useMemo(() => {
    const contextualItems = vinylItems.filter(item => {
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      const matchesBrand = !columnFilters.brand || (item.brand && item.brand.toLowerCase().includes(columnFilters.brand.toLowerCase()));
      const matchesSeries = !columnFilters.series || (item.series && item.series.toLowerCase().includes(columnFilters.series.toLowerCase()));
      const matchesColourName = !columnFilters.colour_name || (item.colour_name && item.colour_name.toLowerCase().includes(columnFilters.colour_name.toLowerCase()));
      return matchesStatus && matchesBrand && matchesSeries && matchesColourName;
    });
    
    const colourNumberCounts = contextualItems.reduce((acc, item) => {
      if (item.colour_number) {
        acc[item.colour_number] = (acc[item.colour_number] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const colourNumbers = Object.keys(colourNumberCounts).sort();
    const colourNumberOptions = colourNumbers.map(num => `${num} (${colourNumberCounts[num]})`);
    
    return ['---', ...colourNumberOptions];
  }, [vinylItems, columnFilters, filterType]);

  const getColourNameOptions = useMemo(() => {
    const contextualItems = vinylItems.filter(item => {
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      const matchesBrand = !columnFilters.brand || (item.brand && item.brand.toLowerCase().includes(columnFilters.brand.toLowerCase()));
      const matchesSeries = !columnFilters.series || (item.series && item.series.toLowerCase().includes(columnFilters.series.toLowerCase()));
      const matchesColourNumber = !columnFilters.colour_number || (item.colour_number && item.colour_number.toLowerCase().includes(columnFilters.colour_number.toLowerCase()));
      return matchesStatus && matchesBrand && matchesSeries && matchesColourNumber;
    });
    
    const colourNameCounts = contextualItems.reduce((acc, item) => {
      if (item.colour_name) {
        acc[item.colour_name] = (acc[item.colour_name] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const colourNames = Object.keys(colourNameCounts).sort();
    const colourNameOptions = colourNames.map(name => `${name} (${colourNameCounts[name]})`);
    
    return ['---', ...colourNameOptions];
  }, [vinylItems, columnFilters, filterType]);

  return {
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    columnFilters,
    setColumnFilters,
    filteredItems,
    sortedItems,
    getBrandOptions,
    getSeriesOptions,
    getColourNumberOptions,
    getColourNameOptions,
    handleSort,
    handleColumnFilter,
    clearAllFilters,
    getActiveFilterCount,
    getSortIcon
  };
};
