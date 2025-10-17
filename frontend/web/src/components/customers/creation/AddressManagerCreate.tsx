import React, { useCallback, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AddressManagerCreateProps } from './CustomerCreationTypes';
import { Address } from '../../../types';
import { provincesApi } from '../../../services/api';
import TaxInfoSection from '../components/TaxInfoSection';

export const AddressManagerCreate: React.FC<AddressManagerCreateProps> = ({
  addresses,
  setAddresses,
  provincesStates
}) => {
  const [taxWarning, setTaxWarning] = useState('');
  const [taxDisplayValues, setTaxDisplayValues] = useState<Record<string, string>>({});

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500';

  const buildAddressKey = useCallback(
    (address: Partial<Address> | undefined, idx: number) =>
      `${address?.address_id ?? 'new'}-${idx}`,
    []
  );

  const getAddressKey = (idx: number) => buildAddressKey(addresses[idx], idx);

  const handleAddressChange = useCallback(
    <K extends keyof Address>(index: number, field: K, value: Address[K] | null) => {
      const normalizedValue = value === null ? undefined : value;
      const currentAddress = addresses[index];
      const addressKey = buildAddressKey(currentAddress, index);

      setAddresses((prev) => {
        const next = [...prev];
        const target = { ...next[index], [field]: normalizedValue } as Partial<Address>;

        if (field === 'province_state_short' && typeof normalizedValue === 'string') {
          const provinceShort = normalizedValue.trim();
          target.province_state_short = provinceShort;

          if (!provinceShort) {
            target.province_state_long = undefined;
            target.tax_id = undefined;
            target.tax_type = undefined;
            target.tax_override_percent = undefined;
            target.use_province_tax = true;
          } else {
            const matchingProvince = provincesStates.find(
              (province) => province.province_short === provinceShort
            );

            if (matchingProvince) {
              target.province_state_long = matchingProvince.province_long;
              target.country = matchingProvince.country_group;
            }
          }
        }

        next[index] = target;
        return next;
      });

      if (field === 'province_state_short' && typeof normalizedValue === 'string') {
        const provinceShort = normalizedValue.trim();

        if (!provinceShort) {
          setTaxDisplayValues((prev) => {
            const next = { ...prev };
            delete next[addressKey];
            return next;
          });
          setTaxWarning('');
        } else {
          void (async () => {
            try {
              const taxInfo = await provincesApi.getTaxInfo(provinceShort);
              if (!taxInfo) {
                return;
              }

              setAddresses((prev) => {
                const next = [...prev];
                const target = { ...next[index] } as Partial<Address>;
                target.tax_id = taxInfo.tax_id;
                target.tax_type = taxInfo.tax_name;
                target.tax_override_percent = Number(taxInfo.tax_percent) / 100;
                target.use_province_tax = true;
                next[index] = target;
                return next;
              });

              setTaxDisplayValues((prev) => {
                const next = { ...prev };
                delete next[addressKey];
                return next;
              });

              setTaxWarning('');
            } catch (error) {
              console.error('Error fetching tax info:', error);
            }
          })();
        }
      }

      if (field === 'tax_type' || field === 'tax_override_percent') {
        setTaxWarning('');
      }
    },
    [addresses, buildAddressKey, provincesStates, setAddresses]
  );

  const handleTaxDisplayValueChange = (
    _addressKey: string,
    displayValue: string,
    addressIndex: number
  ) => {
    const addressKey = getAddressKey(addressIndex);
    setTaxDisplayValues((prev) => ({ ...prev, [addressKey]: displayValue }));

    const numericValue = parseFloat(displayValue);
    const dbValue = Number.isNaN(numericValue) ? null : numericValue / 100;

    // Fire and forget; no need to await inside the UI handler
    handleAddressChange(addressIndex, 'tax_override_percent', dbValue as Address['tax_override_percent']);
  };

  const handleTaxDisplayValueBlur = (addressKey: string) => {
    setTaxDisplayValues((prev) => {
      const next = { ...prev };
      delete next[addressKey];
      return next;
    });
  };

  const addAddress = () => {
    setAddresses([...addresses, {
      address_line1: '',
      address_line2: '',
      city: '',
      province_state_short: '',
      postal_zip: '',
      is_primary: false,
      is_billing: false,
      is_shipping: false,
      is_jobsite: false,
      is_mailing: false
    }]);
  };

  const removeAddress = (index: number) => {
    if (addresses.length > 1) {
      setAddresses(addresses.filter((_, i) => i !== index));
    }
  };

  const handlePrimaryChange = (index: number, checked: boolean) => {
    if (checked) {
      // Set this as primary and unset all others
      const newAddresses = addresses.map((addr, idx) => ({
        ...addr,
        is_primary: idx === index
      }));
      setAddresses(newAddresses);
    } else {
      handleAddressChange(index, 'is_primary', false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2">Addresses *</h4>
        <button
          type="button"
          onClick={addAddress}
          className="flex items-center space-x-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Address</span>
        </button>
      </div>
      
      {addresses.map((address, index) => (
        <div key={index} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h5 className="font-semibold text-gray-700">Address {index + 1}</h5>
            {addresses.length > 1 && (
              <button
                type="button"
                onClick={() => removeAddress(index)}
                className="text-red-600 hover:text-red-800 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Address Types - Moved to top */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-600 mb-2">Address Types</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={address.is_primary || false}
                  onChange={(e) => handlePrimaryChange(index, e.target.checked)}
                  className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                Primary
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={address.is_billing || false}
                  onChange={(e) => handleAddressChange(index, 'is_billing', e.target.checked)}
                  className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                Billing
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={address.is_shipping || false}
                  onChange={(e) => handleAddressChange(index, 'is_shipping', e.target.checked)}
                  className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                Shipping
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={address.is_jobsite || false}
                  onChange={(e) => handleAddressChange(index, 'is_jobsite', e.target.checked)}
                  className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                Jobsite
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={address.is_mailing || false}
                  onChange={(e) => handleAddressChange(index, 'is_mailing', e.target.checked)}
                  className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                Mailing
              </label>
            </div>
          </div>

          {/* Address Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">
                Address Line 1
              </label>
              <input
                type="text"
                value={address.address_line1 || ''}
                onChange={(e) => handleAddressChange(index, 'address_line1', e.target.value)}
            className={inputClass}
                placeholder="Street address"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Address Line 2</label>
              <input
                type="text"
                value={address.address_line2 || ''}
                onChange={(e) => handleAddressChange(index, 'address_line2', e.target.value)}
            className={inputClass}
                placeholder="Suite, unit, building, floor, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">
                City
              </label>
              <input
                type="text"
                value={address.city || ''}
                onChange={(e) => handleAddressChange(index, 'city', e.target.value)}
            className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">
                Province/State <span className="text-red-500">*</span>
              </label>
              <select
                value={address.province_state_short || ''}
                onChange={(e) => handleAddressChange(index, 'province_state_short', e.target.value)}
                required
                className={inputClass}
              >
                <option value="">Select Province/State</option>
                {/* Canadian Provinces */}
                <optgroup label="Canada">
                  {provincesStates
                    .filter(p => p.country_group === 'Canada')
                    .map(province => (
                      <option key={province.province_short} value={province.province_short}>
                        {province.province_long} ({province.province_short})
                      </option>
                    ))}
                </optgroup>
                {/* US States */}
                <optgroup label="United States">
                  {provincesStates
                    .filter(p => p.country_group === 'United States')
                    .map(state => (
                      <option key={state.province_short} value={state.province_short}>
                        {state.province_long} ({state.province_short})
                      </option>
                    ))}
                </optgroup>
                {/* Special Options */}
                <optgroup label="Special">
                  {provincesStates
                    .filter(p => p.country_group === 'N/A')
                    .map(special => (
                      <option key={special.province_short} value={special.province_short}>
                        {special.province_long}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Postal/Zip Code</label>
              <input
                type="text"
                value={address.postal_zip || ''}
                onChange={(e) => handleAddressChange(index, 'postal_zip', e.target.value)}
            className={inputClass}
                placeholder="Postal or ZIP code"
              />
            </div>
          </div>

          <TaxInfoSection
            address={address as Address}
            addressIndex={index}
            taxWarning={taxWarning}
            taxDisplayValues={taxDisplayValues}
            onAddressChange={handleAddressChange}
            onTaxDisplayValueChange={handleTaxDisplayValueChange}
            onTaxDisplayValueBlur={handleTaxDisplayValueBlur}
          />

          {/* Address-specific contact info */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Contact Name</label>
              <input
                type="text"
                value={address.contact_name || ''}
                onChange={(e) => handleAddressChange(index, 'contact_name', e.target.value)}
            className={inputClass}
                placeholder="Contact person at this address"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Phone</label>
              <input
                type="text"
                value={address.phone || ''}
                onChange={(e) => handleAddressChange(index, 'phone', e.target.value)}
            className={inputClass}
                placeholder="Phone number for this address"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={address.email || ''}
                onChange={(e) => handleAddressChange(index, 'email', e.target.value)}
            className={inputClass}
                placeholder="Email for this address"
              />
            </div>
          </div>

          {/* Address Instructions */}
          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Delivery Instructions</label>
            <textarea
              rows={2}
              value={address.instructions || ''}
              onChange={(e) => handleAddressChange(index, 'instructions', e.target.value)}
            className={inputClass}
              placeholder="Special delivery or access instructions for this address..."
            />
          </div>
        </div>
      ))}

      {addresses.length === 0 && (
        <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          <p className="mb-2">No addresses added yet.</p>
          <button
            type="button"
            onClick={addAddress}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            Add First Address
          </button>
        </div>
      )}

      {/* Validation hint */}
      <div className="mt-4 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
        <p><strong>Required:</strong> Provide at least one address with a Province/State selected so taxes can be calculated.</p>
        <p><strong>Primary Address:</strong> When multiple addresses exist, one must be marked as primary.</p>
      </div>
    </div>
  );
};
