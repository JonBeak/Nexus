import { useState, useEffect, useCallback } from 'react';
import { useCustomerAPI } from './useCustomerAPI';
import { Customer } from '../../../types';

interface UseCustomerListDataReturn {
  customers: Customer[];
  selectedCustomer: Customer | null;
  showCustomerDetails: boolean;
  showAddCustomerModal: boolean;
  scrollPosition: number;
  loading: boolean;
  error: string;
  setSelectedCustomer: (customer: Customer | null) => void;
  setShowCustomerDetails: (show: boolean) => void;
  setShowAddCustomerModal: (show: boolean) => void;
  setScrollPosition: (position: number) => void;
  refreshCustomers: (searchTerm?: string, includeInactive?: boolean) => Promise<void>;
  handleCustomerDetails: (customer: Customer) => Promise<void>;
  handleReactivateCustomer: (customerId: number, searchTerm: string) => Promise<void>;
  handleCustomerCreated: (newCustomer: Customer, searchTerm: string) => void;
  handleCloseCustomerDetails: (searchTerm: string) => Promise<void>;
}

export const useCustomerListData = (
  searchTerm: string, 
  showDeactivatedCustomers: boolean
): UseCustomerListDataReturn => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  
  const { fetchCustomers, fetchCustomerDetails, reactivateCustomer, loading, error } = useCustomerAPI();

  // Refresh customers with current filters
  const refreshCustomers = useCallback(async (
    search?: string,
    includeInactive?: boolean
  ) => {
    try {
      const customerData = await fetchCustomers(
        search ?? searchTerm, 
        includeInactive ?? showDeactivatedCustomers
      );
      setCustomers(customerData);
    } catch (error) {
      // Error is already handled in useCustomerAPI
      console.error('Failed to refresh customers:', error);
    }
  }, [fetchCustomers, searchTerm, showDeactivatedCustomers]);

  // Handle customer details modal opening
  const handleCustomerDetails = useCallback(async (customer: Customer) => {
    try {
      // Save current scroll position
      setScrollPosition(window.pageYOffset);
      
      const detailedCustomer = await fetchCustomerDetails(customer.customer_id, customer);
      setSelectedCustomer(detailedCustomer);
      setShowCustomerDetails(true);
    } catch (error) {
      // Error handling is done in fetchCustomerDetails
      console.error('Error in handleCustomerDetails:', error);
    }
  }, [fetchCustomerDetails]);

  // Handle customer reactivation
  const handleReactivateCustomer = useCallback(async (
    customerId: number,
    currentSearchTerm: string
  ) => {
    try {
      await reactivateCustomer(customerId);
      await refreshCustomers(currentSearchTerm, showDeactivatedCustomers);
    } catch (error) {
      // Error is already handled in reactivateCustomer
      console.error('Error in handleReactivateCustomer:', error);
    }
  }, [reactivateCustomer, refreshCustomers, showDeactivatedCustomers]);

  // Handle new customer creation
  const handleCustomerCreated = useCallback((
    newCustomer: Customer,
    currentSearchTerm: string
  ) => {
    // Refresh customer list
    refreshCustomers(currentSearchTerm, showDeactivatedCustomers);
    
    // Open the newly created customer in details modal
    if (newCustomer.customer_id) {
      setSelectedCustomer(newCustomer);
      setShowCustomerDetails(true);
    }
  }, [refreshCustomers, showDeactivatedCustomers]);

  // Handle closing customer details modal
  const handleCloseCustomerDetails = useCallback(async (currentSearchTerm: string) => {
    // Close modal
    setShowCustomerDetails(false);
    // Refresh customer data
    await refreshCustomers(currentSearchTerm, showDeactivatedCustomers);
    // Restore scroll position
    setTimeout(() => {
      window.scrollTo(0, scrollPosition);
    }, 100);
  }, [refreshCustomers, scrollPosition, showDeactivatedCustomers]);

  // Load customers when search term or deactivated filter changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      refreshCustomers(searchTerm, showDeactivatedCustomers);
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timeoutId);
  }, [refreshCustomers, searchTerm, showDeactivatedCustomers]);

  return {
    customers,
    selectedCustomer,
    showCustomerDetails,
    showAddCustomerModal,
    scrollPosition,
    loading,
    error,
    setSelectedCustomer,
    setShowCustomerDetails,
    setShowAddCustomerModal,
    setScrollPosition,
    refreshCustomers,
    handleCustomerDetails,
    handleReactivateCustomer,
    handleCustomerCreated,
    handleCloseCustomerDetails
  };
};
