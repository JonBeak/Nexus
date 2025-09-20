import { useState, useEffect } from 'react';
import { customerApi } from '../../../services/api';

// Type definitions
interface LedType {
  led_id: number;
  product_code: string;
  price: string;
  watts: string;
  colour: string;
  brand: string;
  is_default: boolean;
}

interface PowerSupplyType {
  power_supply_id: number;
  transformer_type: string;
  price: string;
  watts: number;
  volts: number;
  ul_listed: boolean;
  is_default_non_ul: boolean;
  is_default_ul: boolean;
}

interface UseCustomerAPIReturn {
  ledTypes: LedType[];
  powerSupplyTypes: PowerSupplyType[];
  fetchCustomers: (search?: string, includeInactive?: boolean) => Promise<any[]>;
  reactivateCustomer: (customerId: number) => Promise<void>;
  fetchCustomerDetails: (customerId: number, fallbackCustomer: any) => Promise<any>;
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
  const fetchCustomers = async (search: string = '', includeInactive: boolean = false): Promise<any[]> => {
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
  };

  // Reactivate customer with error handling
  const reactivateCustomer = async (customerId: number): Promise<void> => {
    try {
      await customerApi.reactivateCustomer(customerId);
    } catch (error) {
      console.error('Error reactivating customer:', error);
      alert('Failed to reactivate customer. Please try again.');
      throw error;
    }
  };

  // Fetch customer details with fallback handling
  const fetchCustomerDetails = async (customerId: number, fallbackCustomer: any): Promise<any> => {
    try {
      // Use the customerApi which handles auth automatically via interceptors
      const detailedCustomer = await customerApi.getCustomer(customerId);
      return detailedCustomer;
    } catch (error) {
      console.error('Error fetching customer details:', error);

      // Fallback to basic customer data
      return fallbackCustomer;
    }
  };

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
