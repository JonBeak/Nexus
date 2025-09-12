import { useState, useEffect } from 'react';
import { Address, Customer } from '../../../types';
import { useAddressAPI } from './useAddressAPI';

interface ProvinceState {
  province_state_id: number;
  province_state_name: string;
  province_state_short: string;
  country: string;
}

export const useAddressManagement = (
  customer: Customer,
  addresses: Address[],
  setAddresses: (addresses: Address[]) => void,
  showDeactivated: boolean,
  setSaveError: (error: string) => void
) => {
  const [provincesStates, setProvincesStates] = useState<ProvinceState[]>([]);
  const [taxWarning, setTaxWarning] = useState<string>('');
  const [taxDisplayValues, setTaxDisplayValues] = useState<{[key: string]: string}>({});

  const api = useAddressAPI();

  // Fetch provinces/states on component mount
  useEffect(() => {
    const loadProvincesStates = async () => {
      const data = await api.fetchProvincesStates();
      setProvincesStates(data);
    };

    loadProvincesStates();
  }, []);

  // Refetch addresses when showDeactivated toggle changes
  useEffect(() => {
    if (customer) {
      if (showDeactivated) {
        fetchDeactivatedAddresses();
      } else {
        const activeAddresses = addresses.filter(addr => addr.is_active !== false);
        setAddresses(activeAddresses);
      }
    }
  }, [showDeactivated]);

  // Handle API errors by setting save error
  useEffect(() => {
    if (api.error) {
      setSaveError(api.error);
      api.clearError();
    }
  }, [api.error, setSaveError]);

  const fetchDeactivatedAddresses = async () => {
    const refreshedAddresses = await api.refreshAddresses(customer, true);
    setAddresses(refreshedAddresses);
  };

  const handleAddAddress = () => {
    const newAddress: Address = {
      is_primary: addresses.filter(addr => addr.is_active !== false).length === 0,
      is_billing: false,
      is_shipping: false,
      is_jobsite: false,
      is_mailing: false,
      address_line1: '',
      address_line2: '',
      city: '',
      province_state_short: '',
      postal_zip: '',
      country: 'Canada',
      comments: ''
    };
    
    setAddresses([...addresses, { ...newAddress, address_id: 'new', isEditing: true, is_active: true }]);
    
    // Scroll to bottom after adding
    setTimeout(() => {
      const modal = document.querySelector('.modal-content');
      if (modal) {
        modal.scrollTop = modal.scrollHeight;
      }
    }, 100);
  };

  const handleUpdateAddress = async (addressIndex: number, addressData: Address) => {
    const address = addresses[addressIndex];
    let success = false;

    if (address.address_id === 'new') {
      success = await api.addAddress(customer.customer_id, addressData);
    } else {
      success = await api.updateAddress(customer.customer_id, address.address_id, addressData);
    }
    
    if (success) {
      const refreshedAddresses = await api.refreshAddresses(customer, showDeactivated);
      setAddresses(refreshedAddresses);
    }
  };

  const handleDeleteAddress = async (addressIndex: number) => {
    const address = addresses[addressIndex];
    if (address.address_id === 'new') {
      const newAddresses = addresses.filter((_, i) => i !== addressIndex);
      setAddresses(newAddresses);
    } else {
      const success = await api.deleteAddress(customer.customer_id, address.address_id);
      if (success) {
        const refreshedAddresses = await api.refreshAddresses(customer, showDeactivated);
        setAddresses(refreshedAddresses);
      }
    }
  };

  const handleMakePrimary = async (addressId: string | number) => {
    const success = await api.makePrimaryAddress(customer, addressId);
    if (success) {
      // Update local state to reflect the change
      setAddresses(addresses.map(addr => ({
        ...addr,
        is_primary: addr.address_id === addressId
      })));
    }
  };

  const handleReactivateAddress = async (addressIndex: number) => {
    const address = addresses[addressIndex];
    const success = await api.reactivateAddress(customer.customer_id, address.address_id);
    if (success) {
      const refreshedAddresses = await api.refreshAddresses(customer, showDeactivated);
      setAddresses(refreshedAddresses);
    }
  };

  const handleAddressChange = async (index: number, field: string, value: any) => {
    const newAddresses = [...addresses];
    newAddresses[index] = { ...newAddresses[index], [field]: value };
    
    // Handle province change - auto-populate tax fields if they're empty
    if (field === 'province_state_short' && value) {
      const currentAddress = newAddresses[index];
      const hasExistingTaxData = currentAddress.tax_id || currentAddress.tax_type || currentAddress.tax_override_percent;
      
      const taxInfo = await api.fetchTaxInfo(value);
      if (taxInfo) {
        // Auto-populate if no existing tax data
        if (!hasExistingTaxData) {
          newAddresses[index] = {
            ...newAddresses[index],
            tax_id: taxInfo.tax_id,
            tax_type: taxInfo.tax_name,
            tax_override_percent: taxInfo.tax_percent / 100, // Convert 13.00 to 0.13 for database
            use_province_tax: true
          };
          setTaxWarning('');
        } else {
          // Check for mismatch and show warning
          const currentTaxPercent = parseFloat(currentAddress.tax_override_percent?.toString() || '0') * 100;
          const expectedTaxPercent = parseFloat(taxInfo.tax_percent.toString());
          
          if (currentAddress.tax_type !== taxInfo.tax_name || 
              Math.abs(currentTaxPercent - expectedTaxPercent) > 0.01) {
            setTaxWarning(`Warning: Tax settings don't match ${value}. Expected: ${taxInfo.tax_name} at ${taxInfo.tax_percent}%`);
          } else {
            setTaxWarning('');
          }
        }
      }
    }
    
    // Clear tax warning when tax fields are manually changed
    if (field === 'tax_type' || field === 'tax_override_percent') {
      setTaxWarning('');
    }
    
    setAddresses(newAddresses);
  };

  const getAddressTypeLabels = (address: Address): string => {
    const types = [];
    if (Boolean(address.is_primary)) types.push('Primary');
    if (Boolean(address.is_billing)) types.push('Billing');
    if (Boolean(address.is_shipping)) types.push('Shipping');
    if (Boolean(address.is_jobsite)) types.push('Jobsite');
    if (Boolean(address.is_mailing)) types.push('Mailing');
    return types.length > 0 ? types.join(', ') : 'Address';
  };

  const handleTaxDisplayValueChange = (
    addressKey: string, 
    displayValue: string, 
    addressIndex: number
  ) => {
    // Update display value immediately for smooth typing
    setTaxDisplayValues(prev => ({ ...prev, [addressKey]: displayValue }));
    
    // Convert to decimal for storage
    const numValue = parseFloat(displayValue);
    const dbValue = numValue ? numValue / 100 : null;
    handleAddressChange(addressIndex, 'tax_override_percent', dbValue);
  };

  const handleTaxDisplayValueBlur = (addressKey: string) => {
    // Clean up display value on blur to sync with actual stored value
    setTaxDisplayValues(prev => {
      const newValues = { ...prev };
      delete newValues[addressKey];
      return newValues;
    });
  };

  const startEditing = (addressIndex: number) => {
    const newAddresses = [...addresses];
    newAddresses[addressIndex] = { ...newAddresses[addressIndex], isEditing: true };
    setAddresses(newAddresses);
  };

  const cancelEditing = (addressIndex: number) => {
    const address = addresses[addressIndex];
    if (address.address_id === 'new') {
      handleDeleteAddress(addressIndex);
    } else {
      const newAddresses = [...addresses];
      const originalAddress = customer.addresses?.find((a: Address) => a.address_id === address.address_id);
      if (originalAddress) {
        newAddresses[addressIndex] = { ...originalAddress, isEditing: false };
        setAddresses(newAddresses);
      }
    }
  };

  return {
    // State
    provincesStates,
    taxWarning,
    taxDisplayValues,
    loading: api.loading,

    // Handlers
    handleAddAddress,
    handleUpdateAddress,
    handleDeleteAddress,
    handleMakePrimary,
    handleReactivateAddress,
    handleAddressChange,
    handleTaxDisplayValueChange,
    handleTaxDisplayValueBlur,
    startEditing,
    cancelEditing,

    // Utilities
    getAddressTypeLabels,
    setTaxWarning
  };
};