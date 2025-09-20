import { useState } from 'react';

interface UseCustomerListFilteringReturn {
  searchTerm: string;
  showDeactivatedCustomers: boolean;
  setSearchTerm: (term: string) => void;
  setShowDeactivatedCustomers: (show: boolean) => void;
  handleSearch: (e: React.FormEvent, fetchCustomers: (search: string) => Promise<void>) => void;
  handleClearSearch: (fetchCustomers: (search: string) => Promise<void>) => void;
  getActiveCustomerCount: (customers: any[]) => number;
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
    // Search is now handled automatically by debounced useEffect in useCustomerListData
    // This just prevents the form from refreshing the page
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
  const getActiveCustomerCount = (customers: any[]): number => {
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