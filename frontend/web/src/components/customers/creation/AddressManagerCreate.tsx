import React, { useCallback, useState } from 'react';
import { AddressManagerCreateProps } from './CustomerCreationTypes';
import { Address } from '../../../types';
import { provincesApi } from '../../../services/api';
import TaxInfoSection from '../components/TaxInfoSection';
import { PAGE_STYLES } from '../../../constants/moduleColors';

export const AddressManagerCreate: React.FC<AddressManagerCreateProps> = ({
  addresses,
  setAddresses,
  provincesStates
}) => {
  const [taxWarning, setTaxWarning] = useState('');
  const [taxDisplayValues, setTaxDisplayValues] = useState<Record<string, string>>({});

  const inputClass = `w-full px-3 py-2 border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`;
  const labelClass = `block text-sm font-semibold ${PAGE_STYLES.panel.textSecondary} mb-1`;

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

  // For creation, we only show the first address (always primary + billing)
  const address = addresses[0] || {};
  const index = 0;

  return (
    <div>
      <div className="mb-4">
        <h4 className={`text-lg font-bold ${PAGE_STYLES.panel.text} border-b ${PAGE_STYLES.panel.border} pb-2`}>Primary Address (Billing)</h4>
        <p className={`text-sm ${PAGE_STYLES.panel.textMuted} mt-1`}>
          Add additional addresses after customer is created
        </p>
      </div>

      <div className={`p-4 border ${PAGE_STYLES.panel.border} rounded-lg ${PAGE_STYLES.header.background}`}>
        {/* Address Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
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
              <label className={labelClass}>Address Line 2</label>
              <input
                type="text"
                value={address.address_line2 || ''}
                onChange={(e) => handleAddressChange(index, 'address_line2', e.target.value)}
                className={inputClass}
                placeholder="Suite, unit, building, floor, etc."
              />
            </div>
            <div>
              <label className={labelClass}>
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
              <label className={labelClass}>
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
              <label className={labelClass}>Postal/Zip Code</label>
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

        </div>

      {/* Validation hint */}
      <div className={`mt-4 text-sm ${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.header.background} p-3 rounded-lg border-l-4 border-blue-400`}>
        <p><strong>Required:</strong> Provide at least one address with a Province/State selected so taxes can be calculated.</p>
        <p><strong>Primary Address:</strong> When multiple addresses exist, one must be marked as primary.</p>
      </div>
    </div>
  );
};
