import { useState, useEffect, useCallback, useRef } from 'react';
import { Address, Customer, ProvinceState } from '../../../types';
import { useAddressAPI } from './useAddressAPI';

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
  const editBackupsRef = useRef<Record<number, Address>>({});

  const buildAddressKey = useCallback((address: Address, index: number) => {
    return `${address.address_id}-${index}`;
  }, []);

  const {
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
    clearError
  } = useAddressAPI();

  // Fetch provinces/states on component mount
  useEffect(() => {
    const loadProvincesStates = async () => {
      const data = await fetchProvincesStates();
      setProvincesStates(data);
    };

    loadProvincesStates();
  }, [fetchProvincesStates]);

  const fetchDeactivatedAddresses = useCallback(async () => {
    const refreshedAddresses = await refreshAddresses(customer, true);
    setAddresses(refreshedAddresses);
  }, [customer, refreshAddresses, setAddresses]);

  // Refetch addresses when showDeactivated toggle changes
  useEffect(() => {
    if (customer) {
      if (showDeactivated) {
        fetchDeactivatedAddresses();
      } else {
        setAddresses(prev => prev.filter(addr => addr.is_active !== false));
      }
    }
  }, [customer, fetchDeactivatedAddresses, setAddresses, showDeactivated]);

  // Handle API errors by setting save error
  useEffect(() => {
    if (error) {
      setSaveError(error);
      clearError();
    }
  }, [clearError, error, setSaveError]);

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
      success = await addAddress(customer.customer_id, addressData);
    } else {
      success = await updateAddress(customer.customer_id, address.address_id, addressData);
    }
    
    if (success) {
      const refreshedAddresses = await refreshAddresses(customer, showDeactivated);
      setAddresses(refreshedAddresses);
      delete editBackupsRef.current[addressIndex];
    }
  };

  const handleDeleteAddress = async (addressIndex: number) => {
    const address = addresses[addressIndex];
    if (address.address_id === 'new') {
      const newAddresses = addresses.filter((_, i) => i !== addressIndex);
      setAddresses(newAddresses);
    } else {
      const success = await deleteAddress(customer.customer_id, address.address_id);
      if (success) {
        const refreshedAddresses = await refreshAddresses(customer, showDeactivated);
        setAddresses(refreshedAddresses);
      }
    }
    delete editBackupsRef.current[addressIndex];
  };

  const handleMakePrimary = async (addressId: string | number) => {
    const success = await makePrimaryAddress(customer, addressId);
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
    const success = await reactivateAddress(customer.customer_id, address.address_id);
    if (success) {
      const refreshedAddresses = await refreshAddresses(customer, showDeactivated);
      setAddresses(refreshedAddresses);
    }
  };

  const handleAddressChange = useCallback(
    <K extends keyof Address>(index: number, field: K, value: Address[K] | null) => {
      const normalizedValue = value === null ? undefined : value;
      const existingAddress = addresses[index];
      const addressKey = buildAddressKey(existingAddress, index);

      setAddresses((prev) => {
        const next = [...prev];
        const target = { ...next[index], [field]: normalizedValue } as Address;

        if (field === 'province_state_short' && typeof normalizedValue === 'string') {
          const provinceShort = normalizedValue.trim();
          target.province_state_short = provinceShort;

          if (!provinceShort) {
            target.province_state_long = undefined;
            target.tax_id = undefined;
            target.tax_type = undefined;
            target.tax_override_percent = undefined;
            target.use_province_tax = true;
            setTaxDisplayValues((prevValues) => {
              const nextValues = { ...prevValues };
              delete nextValues[addressKey];
              return nextValues;
            });
            setTaxWarning('');
          } else {
            const matchingProvince = provincesStates.find(
              (province) => province.province_short === provinceShort
            );

            if (matchingProvince) {
              target.province_state_long = matchingProvince.province_long;
              target.country = matchingProvince.country_group === 'USA' ? 'USA' : 'Canada';
            }
          }
        }

        if (field === 'tax_type' || field === 'tax_override_percent') {
          setTaxWarning('');
        }

        next[index] = target;
        return next;
      });

      if (field === 'province_state_short' && typeof normalizedValue === 'string') {
        const provinceShort = normalizedValue.trim();
        if (provinceShort) {
          void (async () => {
            try {
              const taxInfo = await fetchTaxInfo(provinceShort);
              if (!taxInfo) {
                return;
              }

              setAddresses((prev) => {
                const next = [...prev];
                const target = { ...next[index] } as Address;
                target.tax_id = taxInfo.tax_id;
                target.tax_type = taxInfo.tax_name;
                target.tax_override_percent = Number(taxInfo.tax_percent) / 100;
                target.use_province_tax = true;
                next[index] = target;
                return next;
              });

              setTaxDisplayValues((prevValues) => {
                const nextValues = { ...prevValues };
                delete nextValues[addressKey];
                return nextValues;
              });

              setTaxWarning('');
            } catch (error) {
              console.error('Error fetching tax info:', error);
            }
          })();
        } else {
          setTaxDisplayValues((prevValues) => {
            const nextValues = { ...prevValues };
            delete nextValues[addressKey];
            return nextValues;
          });
          setTaxWarning('');
        }
      }
    },
    [addresses, buildAddressKey, fetchTaxInfo, provincesStates, setAddresses]
  );

  const getAddressTypeLabels = (address: Address): string => {
    const types = [];
    if (address.is_primary) types.push('Primary');
    if (address.is_billing) types.push('Billing');
    if (address.is_shipping) types.push('Shipping');
    if (address.is_jobsite) types.push('Jobsite');
    if (address.is_mailing) types.push('Mailing');
    return types.length > 0 ? types.join(', ') : 'Address';
  };

  const handleTaxDisplayValueChange = (
    _addressKey: string,
    displayValue: string,
    addressIndex: number
  ) => {
    const key = buildAddressKey(addresses[addressIndex], addressIndex);

    // Update display value immediately for smooth typing
    setTaxDisplayValues(prev => ({ ...prev, [key]: displayValue }));

    // Convert to decimal for storage
    const numValue = parseFloat(displayValue);
    const dbValue = Number.isNaN(numValue) ? null : numValue / 100;
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
    editBackupsRef.current[addressIndex] = { ...addresses[addressIndex] };
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
      const backup = editBackupsRef.current[addressIndex];
      const originalAddress = backup || customer.addresses?.find((a: Address) => a.address_id === address.address_id);
      if (originalAddress) {
        newAddresses[addressIndex] = { ...originalAddress, isEditing: false };
        setAddresses(newAddresses);
        const key = buildAddressKey(originalAddress, addressIndex);
        setTaxDisplayValues((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    }
    delete editBackupsRef.current[addressIndex];
  };

  return {
    // State
    provincesStates,
    taxWarning,
    taxDisplayValues,
    loading,

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
