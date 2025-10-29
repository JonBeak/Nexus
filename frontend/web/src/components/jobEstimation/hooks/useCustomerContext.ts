import { useState, useCallback } from 'react';
import { customerApi, provincesApi } from '../../../services/api';
import { Customer } from '../../../types';
import { CustomerPreferencesData, CustomerPreferencesValidationResult } from '../types/customerPreferences';
import { PreferencesCache } from '../core/validation/context/useCustomerPreferences';

export const useCustomerContext = () => {
  const [taxRate, setTaxRate] = useState<number>(0.13);
  const [fullCustomer, setFullCustomer] = useState<Customer | null>(null);
  const [customerPreferencesData, setCustomerPreferencesData] = useState<CustomerPreferencesData | null>(null);
  const [preferencesValidationResult, setPreferencesValidationResult] = useState<CustomerPreferencesValidationResult | null>(null);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);

  // Reusable function to reload complete customer data (name, cash flag, tax rate, discount, turnaround)
  // Used by: breadcrumb navigation, handleVersionSelected
  const reloadCustomerData = useCallback(async (customerId: number) => {
    try {
      const customer = await customerApi.getCustomer(customerId);
      setFullCustomer(customer);

      // Get tax rate from billing address (or primary as fallback)
      const billingAddress = customer.addresses?.find((a: any) => a.is_billing);
      const addressToUse = billingAddress || customer.addresses?.find((a: any) => a.is_primary);

      // Extract postal code from primary address
      const primaryAddress = customer.addresses?.find((a: any) => a.is_primary);
      const postalCode = primaryAddress?.postal_zip;

      if (!addressToUse) {
        setTaxRate(1.0); // 100% = ERROR: no billing or primary address
      } else if (addressToUse.tax_override_percent != null) {
        setTaxRate(addressToUse.tax_override_percent);
      } else if (addressToUse.province_state_short) {
        const taxInfo = await provincesApi.getTaxInfo(addressToUse.province_state_short);
        setTaxRate(taxInfo?.tax_percent ?? 1.0); // 100% = ERROR: lookup failed
      } else {
        setTaxRate(1.0); // 100% = ERROR: no province
      }

      // Build customer preferences data for panel
      // Note: preferences will be populated by GridJobBuilder via handlePreferencesLoaded callback
      setCustomerPreferencesData({
        customerId: customer.customer_id,
        customerName: customer.company_name || '',
        cashCustomer: customer.cash_yes_or_no === 1,
        discount: customer.discount,
        defaultTurnaround: customer.default_turnaround,
        postalCode: postalCode,
        preferences: null // Will be set by GridJobBuilder callback to avoid stale data
      });
    } catch (error) {
      console.error('Error fetching customer data:', error);
      setTaxRate(1.0); // 100% = ERROR
    }
  }, []); // Empty deps - only uses stable state setters and external APIs

  const handleEditCustomer = useCallback(() => {
    setShowEditCustomerModal(true);
  }, []);

  const handleCloseEditCustomerModal = useCallback(async (customerId: number | null) => {
    setShowEditCustomerModal(false);

    // Refresh customer data and preferences
    if (customerId) {
      // Clear preferences cache to force fresh fetch
      PreferencesCache.clearCustomer(customerId);

      // Reload customer data
      await reloadCustomerData(customerId);

      // Note: Preferences will be refetched automatically by GridJobBuilder's hook
      // due to the cache clear above. This will trigger re-validation via the callback.
    }
  }, [reloadCustomerData]);

  return {
    // State
    taxRate,
    fullCustomer,
    customerPreferencesData,
    preferencesValidationResult,
    showEditCustomerModal,
    // Setters
    setCustomerPreferencesData,
    setPreferencesValidationResult,
    // Functions
    reloadCustomerData,
    handleEditCustomer,
    handleCloseEditCustomerModal
  };
};
