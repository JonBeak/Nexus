import { useState, useMemo, useCallback } from 'react';
import { InventoryFilterType, VinylItem } from '../types';

export interface InventoryColumnFilters {
  brand: string;
  series: string;
  colour_number: string;
  colour_name: string;
  disposition: string;
  jobs: string;
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
  getDispositionOptions: string[];
  getJobOptions: string[];
  handleSort: (field: InventorySortField) => void;
  handleColumnFilter: (column: keyof InventoryColumnFilters, value: string) => void;
  clearAllFilters: () => void;
  getActiveFilterCount: () => number;
  getSortIcon: (field: InventorySortField) => string;
}

export const useInventoryFiltering = (vinylItems: VinylItem[]): UseInventoryFilteringReturn => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<InventoryFilterType>('all');
  const [sortField, setSortField] = useState<InventorySortField>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnFilters, setColumnFilters] = useState<InventoryColumnFilters>({
    brand: '',
    series: '',
    colour_number: '',
    colour_name: '',
    disposition: '',
    jobs: ''
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
      colour_name: '',
      disposition: '',
      jobs: ''
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

  // Pre-calculate lowercase search strings for each item (cached once when data loads)
  const itemsWithSearchCache = useMemo(() => {
    return vinylItems.map(item => ({
      item,
      searchFieldsLower: [
        item.brand,
        item.series,
        item.colour_number,
        item.colour_name
      ].filter(Boolean).join(' ').toLowerCase()
    }));
  }, [vinylItems]);

  // Filter items based on all criteria
  const filteredItems = useMemo(() => {
    // Pre-calculate lowercased search term once (not per item)
    const searchTermLower = searchTerm.toLowerCase();

    return itemsWithSearchCache
      .filter(({ item, searchFieldsLower }) => {
        // Search filter (only if searchTerm is not empty)
        if (searchTerm !== '' && !searchFieldsLower.includes(searchTermLower)) {
          return false;
        }

        // Status filter
        if (filterType !== 'all' && item.disposition !== filterType) return false;

        // Column-specific filters (exact match, no toLowerCase needed for exact equality)
        if (columnFilters.brand && item.brand !== columnFilters.brand) return false;
        if (columnFilters.series && item.series !== columnFilters.series) return false;
        if (columnFilters.colour_number && item.colour_number !== columnFilters.colour_number) return false;
        if (columnFilters.colour_name && item.colour_name !== columnFilters.colour_name) return false;
        if (columnFilters.disposition && item.disposition !== columnFilters.disposition) return false;

        // Jobs filter
        if (columnFilters.jobs) {
          const hasMatchingJob = item.order_associations?.some(order =>
            `#${order.order_number} - ${order.customer_name} - ${order.order_name}` === columnFilters.jobs
          );
          if (!hasMatchingJob) return false;
        }

        return true;
      })
      .map(({ item }) => item);
  }, [itemsWithSearchCache, searchTerm, filterType, columnFilters]);

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

  // Generate contextual dropdown options (without counts for performance)
  const getBrandOptions = useMemo(() => {
    const contextualItems = vinylItems.filter(item => {
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      const matchesSeries = !columnFilters.series || item.series === columnFilters.series;
      const matchesColourNumber = !columnFilters.colour_number || item.colour_number === columnFilters.colour_number;
      const matchesColourName = !columnFilters.colour_name || item.colour_name === columnFilters.colour_name;
      return matchesStatus && matchesSeries && matchesColourNumber && matchesColourName;
    });

    const brands = Array.from(new Set(contextualItems.map(item => item.brand).filter(Boolean))).sort();

    return ['---', ...brands];
  }, [vinylItems, columnFilters, filterType]);

  const getSeriesOptions = useMemo(() => {
    const contextualItems = vinylItems.filter(item => {
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      const matchesBrand = !columnFilters.brand || item.brand === columnFilters.brand;
      const matchesColourNumber = !columnFilters.colour_number || item.colour_number === columnFilters.colour_number;
      const matchesColourName = !columnFilters.colour_name || item.colour_name === columnFilters.colour_name;
      return matchesStatus && matchesBrand && matchesColourNumber && matchesColourName;
    });

    const series = Array.from(new Set(contextualItems.map(item => item.series).filter(Boolean))).sort();

    return ['---', ...series];
  }, [vinylItems, columnFilters, filterType]);

  const getColourNumberOptions = useMemo(() => {
    const contextualItems = vinylItems.filter(item => {
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      const matchesBrand = !columnFilters.brand || item.brand === columnFilters.brand;
      const matchesSeries = !columnFilters.series || item.series === columnFilters.series;
      const matchesColourName = !columnFilters.colour_name || item.colour_name === columnFilters.colour_name;
      return matchesStatus && matchesBrand && matchesSeries && matchesColourName;
    });

    const colourNumbers = Array.from(new Set(contextualItems.map(item => item.colour_number).filter(Boolean))).sort();

    return ['---', ...colourNumbers];
  }, [vinylItems, columnFilters, filterType]);

  const getColourNameOptions = useMemo(() => {
    const contextualItems = vinylItems.filter(item => {
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      const matchesBrand = !columnFilters.brand || item.brand === columnFilters.brand;
      const matchesSeries = !columnFilters.series || item.series === columnFilters.series;
      const matchesColourNumber = !columnFilters.colour_number || item.colour_number === columnFilters.colour_number;
      return matchesStatus && matchesBrand && matchesSeries && matchesColourNumber;
    });

    const colourNames = Array.from(new Set(contextualItems.map(item => item.colour_name).filter(Boolean))).sort();

    return ['---', ...colourNames];
  }, [vinylItems, columnFilters, filterType]);

  const getDispositionOptions = useMemo(() => {
    const contextualItems = vinylItems.filter(item => {
      const matchesBrand = !columnFilters.brand || item.brand === columnFilters.brand;
      const matchesSeries = !columnFilters.series || item.series === columnFilters.series;
      const matchesColourNumber = !columnFilters.colour_number || item.colour_number === columnFilters.colour_number;
      const matchesColourName = !columnFilters.colour_name || item.colour_name === columnFilters.colour_name;
      return matchesBrand && matchesSeries && matchesColourNumber && matchesColourName;
    });

    const dispositions = Array.from(new Set(contextualItems.map(item => item.disposition).filter(Boolean))).sort();

    return ['---', ...dispositions];
  }, [vinylItems, columnFilters]);

  const getJobOptions = useMemo(() => {
    // Apply contextual filtering (respect other active filters)
    const contextualItems = vinylItems.filter(item => {
      const matchesStatus = filterType === 'all' || item.disposition === filterType;
      const matchesBrand = !columnFilters.brand || item.brand === columnFilters.brand;
      const matchesSeries = !columnFilters.series || item.series === columnFilters.series;
      const matchesColourNumber = !columnFilters.colour_number || item.colour_number === columnFilters.colour_number;
      const matchesColourName = !columnFilters.colour_name || item.colour_name === columnFilters.colour_name;
      const matchesDisposition = !columnFilters.disposition || item.disposition === columnFilters.disposition;
      return matchesStatus && matchesBrand && matchesSeries && matchesColourNumber && matchesColourName && matchesDisposition;
    });

    // Extract all unique order associations
    const jobsMap = new Map<string, { order_number: number; customer_name: string; order_name: string }>();

    contextualItems.forEach(item => {
      item.order_associations?.forEach(order => {
        const key = `#${order.order_number} - ${order.customer_name} - ${order.order_name}`;
        if (!jobsMap.has(key)) {
          jobsMap.set(key, {
            order_number: order.order_number,
            customer_name: order.customer_name,
            order_name: order.order_name
          });
        }
      });
    });

    // Sort by order_number descending (most recent first)
    const sortedJobs = Array.from(jobsMap.entries())
      .sort((a, b) => b[1].order_number - a[1].order_number)
      .map(([key]) => key);

    return ['---', ...sortedJobs];
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
    getDispositionOptions,
    getJobOptions,
    handleSort,
    handleColumnFilter,
    clearAllFilters,
    getActiveFilterCount,
    getSortIcon
  };
};
