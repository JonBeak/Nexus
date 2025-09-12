import { useState, useMemo } from 'react';
import { VinylItem } from '../InventoryTab';

interface ColumnFilters {
  brand: string;
  series: string;
  colour_number: string;
  colour_name: string;
}

interface UseInventoryFilteringReturn {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  sortField: string;
  setSortField: (field: string) => void;
  sortDirection: 'asc' | 'desc';
  setSortDirection: (direction: 'asc' | 'desc') => void;
  columnFilters: ColumnFilters;
  setColumnFilters: (filters: ColumnFilters) => void;
  filteredItems: VinylItem[];
  sortedItems: VinylItem[];
  getBrandOptions: string[];
  getSeriesOptions: string[];
  getColourNumberOptions: string[];
  getColourNameOptions: string[];
  handleSort: (field: string) => void;
  handleColumnFilter: (column: keyof ColumnFilters, value: string) => void;
  clearAllFilters: () => void;
  getActiveFilterCount: () => number;
  getSortIcon: (field: string) => string;
}

export const useInventoryFiltering = (vinylItems: VinylItem[]): UseInventoryFilteringReturn => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('in_stock');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    brand: '',
    series: '',
    colour_number: '',
    colour_name: ''
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleColumnFilter = (column: keyof ColumnFilters, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const clearAllFilters = () => {
    setColumnFilters({
      brand: '',
      series: '',
      colour_number: '',
      colour_name: ''
    });
    setSearchTerm('');
  };

  const getActiveFilterCount = () => {
    const filterCount = Object.values(columnFilters).filter(value => value.trim() !== '').length;
    return searchTerm.trim() !== '' ? filterCount + 1 : filterCount;
  };

  const getSortIcon = (field: string): string => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? '↑' : '↓';
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
      let aValue: any = a[sortField as keyof VinylItem];
      let bValue: any = b[sortField as keyof VinylItem];
      
      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue == null) return sortDirection === 'asc' ? 1 : -1;
      
      // Convert to string for comparison if not already
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortDirection]);

  // Generate contextual dropdown options with counts
  const getBrandOptions = useMemo(() => {
    const { series, colour_number, colour_name } = columnFilters;
    
    const contextualItems = vinylItems.filter(item => {
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      const matchesSeries = !series || (item.series && item.series.toLowerCase().includes(series.toLowerCase()));
      const matchesColourNumber = !colour_number || (item.colour_number && item.colour_number.toLowerCase().includes(colour_number.toLowerCase()));
      const matchesColourName = !colour_name || (item.colour_name && item.colour_name.toLowerCase().includes(colour_name.toLowerCase()));
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
  }, [vinylItems, columnFilters.series, columnFilters.colour_number, columnFilters.colour_name, filterType]);

  const getSeriesOptions = useMemo(() => {
    const { brand, colour_number, colour_name } = columnFilters;
    
    const contextualItems = vinylItems.filter(item => {
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      const matchesBrand = !brand || (item.brand && item.brand.toLowerCase().includes(brand.toLowerCase()));
      const matchesColourNumber = !colour_number || (item.colour_number && item.colour_number.toLowerCase().includes(colour_number.toLowerCase()));
      const matchesColourName = !colour_name || (item.colour_name && item.colour_name.toLowerCase().includes(colour_name.toLowerCase()));
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
  }, [vinylItems, columnFilters.brand, columnFilters.colour_number, columnFilters.colour_name, filterType]);

  const getColourNumberOptions = useMemo(() => {
    const { brand, series, colour_name } = columnFilters;
    
    const contextualItems = vinylItems.filter(item => {
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      const matchesBrand = !brand || (item.brand && item.brand.toLowerCase().includes(brand.toLowerCase()));
      const matchesSeries = !series || (item.series && item.series.toLowerCase().includes(series.toLowerCase()));
      const matchesColourName = !colour_name || (item.colour_name && item.colour_name.toLowerCase().includes(colour_name.toLowerCase()));
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
  }, [vinylItems, columnFilters.brand, columnFilters.series, columnFilters.colour_name, filterType]);

  const getColourNameOptions = useMemo(() => {
    const { brand, series, colour_number } = columnFilters;
    
    const contextualItems = vinylItems.filter(item => {
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      const matchesBrand = !brand || (item.brand && item.brand.toLowerCase().includes(brand.toLowerCase()));
      const matchesSeries = !series || (item.series && item.series.toLowerCase().includes(series.toLowerCase()));
      const matchesColourNumber = !colour_number || (item.colour_number && item.colour_number.toLowerCase().includes(colour_number.toLowerCase()));
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
  }, [vinylItems, columnFilters.brand, columnFilters.series, columnFilters.colour_number, filterType]);

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