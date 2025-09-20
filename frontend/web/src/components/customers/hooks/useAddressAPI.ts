import { useState } from 'react';
import { customerApi, provincesApi } from '../../../services/api';
import { Address, Customer } from '../../../types';

interface ProvinceState {
  province_state_id: number;
  province_state_name: string;
  province_state_short: string;
  country: string;
}

interface TaxInfo {
  tax_id: number;
  province_short: string;
  province_long: string;
  tax_name: string;
  tax_percent: number;
  tax_description?: string;
}

export const useAddressAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch provinces/states data
  const fetchProvincesStates = async (): Promise<ProvinceState[]> => {
    try {
      setLoading(true);
      const data = await provincesApi.getProvinces();
      return data;
    } catch (err) {
      const errorMessage = 'Error fetching provinces/states';
      console.error(errorMessage, err);
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fetch tax information for a province
  const fetchTaxInfo = async (provinceCode: string): Promise<TaxInfo | null> => {
    try {
      const data = await provincesApi.getTaxInfo(provinceCode);
      return data;
    } catch (err) {
      console.error('Error fetching tax info:', err);
      return null;
    }
  };

  // Refresh addresses for a customer
  const refreshAddresses = async (
    customer: Customer,
    showDeactivated: boolean
  ): Promise<Address[]> => {
    try {
      setLoading(true);
      if (showDeactivated) {
        const data = await customerApi.getAddresses(customer.customer_id, true);
        return data.addresses || [];
      } else {
        const data = await customerApi.getCustomer(customer.customer_id);
        return data.addresses || [];
      }
    } catch (err) {
      const errorMessage = 'Error refreshing addresses';
      console.error(errorMessage, err);
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Add new address
  const addAddress = async (customerId: number, addressData: Address): Promise<boolean> => {
    try {
      setLoading(true);
      await customerApi.addAddress(customerId, addressData);
      setError(null);
      return true;
    } catch (err) {
      const errorMessage = 'Failed to save address. Please try again.';
      console.error('Error saving address:', err);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Update existing address
  const updateAddress = async (
    customerId: number, 
    addressId: string | number, 
    addressData: Address
  ): Promise<boolean> => {
    try {
      setLoading(true);
      await customerApi.updateAddress(customerId, addressId, addressData);
      setError(null);
      return true;
    } catch (err) {
      const errorMessage = 'Failed to save address. Please try again.';
      console.error('Error saving address:', err);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Delete address
  const deleteAddress = async (customerId: number, addressId: string | number): Promise<boolean> => {
    try {
      setLoading(true);
      await customerApi.deleteAddress(customerId, addressId);
      setError(null);
      return true;
    } catch (err) {
      const errorMessage = 'Failed to delete address. Please try again.';
      console.error('Error deleting address:', err);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Make address primary
  const makePrimaryAddress = async (
    customer: Customer,
    addressId: string | number
  ): Promise<boolean> => {
    try {
      setLoading(true);
      await customerApi.makePrimaryAddress(customer.customer_id, addressId);
      setError(null);
      return true;
    } catch (err) {
      const errorMessage = 'Failed to set primary address. Please try again.';
      console.error('Error setting primary address:', err);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Reactivate address
  const reactivateAddress = async (customerId: number, addressId: string | number): Promise<boolean> => {
    try {
      setLoading(true);
      await customerApi.reactivateAddress(customerId, addressId);
      setError(null);
      return true;
    } catch (err) {
      const errorMessage = 'Failed to reactivate address. Please try again.';
      console.error('Error reactivating address:', err);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    fetchProvincesStates,
    fetchTaxInfo,
    refreshAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    makePrimaryAddress,
    reactivateAddress,
    clearError: () => setError(null)
  };
};