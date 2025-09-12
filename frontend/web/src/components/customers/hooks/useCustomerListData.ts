import { useState, useEffect } from 'react';
import { useCustomerAPI } from './useCustomerAPI';

interface UseCustomerListDataReturn {
  customers: any[];
  selectedCustomer: any;
  showCustomerDetails: boolean;
  showAddCustomerModal: boolean;
  scrollPosition: number;
  loading: boolean;
  error: string;
  setSelectedCustomer: (customer: any) => void;
  setShowCustomerDetails: (show: boolean) => void;
  setShowAddCustomerModal: (show: boolean) => void;
  setScrollPosition: (position: number) => void;
  refreshCustomers: (searchTerm?: string, includeInactive?: boolean) => Promise<void>;
  handleCustomerDetails: (customer: any) => Promise<void>;
  handleReactivateCustomer: (customerId: number, searchTerm: string) => Promise<void>;
  handleCustomerCreated: (newCustomer: any, searchTerm: string) => void;
  handleCloseCustomerDetails: (searchTerm: string) => Promise<void>;
}

export const useCustomerListData = (
  searchTerm: string, 
  showDeactivatedCustomers: boolean
): UseCustomerListDataReturn => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  
  const { fetchCustomers, fetchCustomerDetails, reactivateCustomer, loading, error } = useCustomerAPI();

  // Refresh customers with current filters
  const refreshCustomers = async (search?: string, includeInactive?: boolean) => {
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
  };

  // Handle customer details modal opening
  const handleCustomerDetails = async (customer: any) => {
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
  };

  // Handle customer reactivation
  const handleReactivateCustomer = async (customerId: number, currentSearchTerm: string) => {
    try {
      await reactivateCustomer(customerId);
      await refreshCustomers(currentSearchTerm, showDeactivatedCustomers);
    } catch (error) {
      // Error is already handled in reactivateCustomer
      console.error('Error in handleReactivateCustomer:', error);
    }
  };

  // Handle new customer creation
  const handleCustomerCreated = (newCustomer: any, currentSearchTerm: string) => {
    // Refresh customer list
    refreshCustomers(currentSearchTerm, showDeactivatedCustomers);
    
    // Open the newly created customer in details modal
    if (newCustomer.customer_id) {
      setSelectedCustomer(newCustomer);
      setShowCustomerDetails(true);
    }
  };

  // Handle closing customer details modal
  const handleCloseCustomerDetails = async (currentSearchTerm: string) => {
    // Close modal
    setShowCustomerDetails(false);
    // Refresh customer data
    await refreshCustomers(currentSearchTerm, showDeactivatedCustomers);
    // Restore scroll position
    setTimeout(() => {
      window.scrollTo(0, scrollPosition);
    }, 100);
  };

  // Load customers when search term or deactivated filter changes
  useEffect(() => {
    refreshCustomers(searchTerm, showDeactivatedCustomers);
  }, [searchTerm, showDeactivatedCustomers]);

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