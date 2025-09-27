import { useState } from 'react';
import { Customer } from '../../../types';

interface UseCustomerListFilteringReturn {
  searchTerm: string;
  showDeactivatedCustomers: boolean;
  setSearchTerm: (term: string) => void;
  setShowDeactivatedCustomers: (show: boolean) => void;
  handleSearch: (e: React.FormEvent, fetchCustomers: (search: string) => Promise<void>) => void;
  handleClearSearch: (fetchCustomers: (search: string) => Promise<void>) => void;
  getActiveCustomerCount: (customers: Customer[]) => number;
}

export const useCustomerListFiltering = (): UseCustomerListFilteringReturn => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeactivatedCustomers, setShowDeactivatedCustomers] = useState(false);

  // Handle search form submission (now just prevents page reload since search is debounced automatically)
  const handleSearch = async (
    e: React.FormEvent,
    fetchCustomers: (search: string) => Promise<void>
  ) => {
    e.preventDefault();
    try {
      await fetchCustomers(searchTerm);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  // Handle clearing search
  const handleClearSearch = async (fetchCustomers: (search: string) => Promise<void>) => {
    setSearchTerm('');
    try {
      await fetchCustomers('');
    } catch (error) {
      console.error('Clear search failed:', error);
    }
  };

  // Get count of active customers for display
  const getActiveCustomerCount = (customers: Customer[]): number => {
    return customers.filter(c => c.active !== false && c.active !== 0).length;
  };

  return {
    searchTerm,
    showDeactivatedCustomers,
    setSearchTerm,
    setShowDeactivatedCustomers,
    handleSearch,
    handleClearSearch,
    getActiveCustomerCount
  };
};
