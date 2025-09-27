import { useState, useEffect, useCallback } from 'react';
import { customerApi } from '../../../services/api';
import { Customer, LedType, PowerSupplyType } from '../../../types';

interface UseCustomerAPIReturn {
  ledTypes: LedType[];
  powerSupplyTypes: PowerSupplyType[];
  fetchCustomers: (search?: string, includeInactive?: boolean) => Promise<Customer[]>;
  reactivateCustomer: (customerId: number) => Promise<void>;
  fetchCustomerDetails: (customerId: number, fallbackCustomer: Customer) => Promise<Customer>;
  loading: boolean;
  error: string;
}

export const useCustomerAPI = (): UseCustomerAPIReturn => {
  const [ledTypes, setLedTypes] = useState<LedType[]>([]);
  const [powerSupplyTypes, setPowerSupplyTypes] = useState<PowerSupplyType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch LED and Power Supply types on mount
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const [ledTypesData, powerSupplyTypesData] = await Promise.all([
          customerApi.getLedTypes(),
          customerApi.getPowerSupplyTypes()
        ]);
        
        setLedTypes(ledTypesData);
        setPowerSupplyTypes(powerSupplyTypesData);
      } catch (error) {
        console.error('Error fetching types:', error);
      }
    };

    fetchTypes();
  }, []);

  // Centralized customer fetching with error handling
  const fetchCustomers = useCallback(async (
    search: string = '',
    includeInactive: boolean = false
  ): Promise<Customer[]> => {
    setLoading(true);
    setError('');

    try {
      const data = await customerApi.getCustomers({
        limit: 100000,
        search: search || undefined,
        include_inactive: includeInactive || undefined,
      });
      // API returns { customers, total, ... }
      return data.customers ?? [];
    } catch (err) {
      const errorMessage = 'Failed to load customers. Please try again.';
      setError(errorMessage);
      console.error('Error fetching customers:', err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reactivate customer with error handling
  const reactivateCustomer = useCallback(async (customerId: number): Promise<void> => {
    try {
      await customerApi.reactivateCustomer(customerId);
    } catch (error) {
      console.error('Error reactivating customer:', error);
      alert('Failed to reactivate customer. Please try again.');
      throw error;
    }
  }, []);

  // Fetch customer details with fallback handling
  const fetchCustomerDetails = useCallback(async (
    customerId: number,
    fallbackCustomer: Customer
  ): Promise<Customer> => {
    try {
      // Use the customerApi which handles auth automatically via interceptors
      const detailedCustomer = await customerApi.getCustomer(customerId);
      return detailedCustomer;
    } catch (error) {
      console.error('Error fetching customer details:', error);

      // Fallback to basic customer data
      return fallbackCustomer;
    }
  }, []);

  return {
    ledTypes,
    powerSupplyTypes,
    fetchCustomers,
    reactivateCustomer,
    fetchCustomerDetails,
    loading,
    error
  };
};
