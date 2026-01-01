import React from 'react';
import { Address, ProvinceState } from '../../../types';
import TaxInfoSection from './TaxInfoSection';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

interface AddressFormProps {
  address: Address;
  addressIndex: number;
  provincesStates: ProvinceState[];
  taxWarning: string;
  taxDisplayValues: {[key: string]: string};
  onAddressChange: <K extends keyof Address>(
    index: number,
    field: K,
    value: Address[K] | null
  ) => void;
  onTaxDisplayValueChange: (addressKey: string, displayValue: string, addressIndex: number) => void;
  onTaxDisplayValueBlur: (addressKey: string) => void;
}

const AddressForm: React.FC<AddressFormProps> = ({
  address,
  addressIndex,
  provincesStates,
  taxWarning,
  taxDisplayValues,
  onAddressChange,
  onTaxDisplayValueChange,
  onTaxDisplayValueBlur
}) => {
  const inputClass = `w-full px-3 py-2 border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`;
  const labelClass = `text-sm font-semibold ${PAGE_STYLES.panel.textSecondary}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Address Type Checkboxes */}
      <div className="md:col-span-2">
        <label className={`${labelClass} mb-2 block`}>Address Types</label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={address.is_billing || false}
              onChange={(e) => onAddressChange(addressIndex, 'is_billing', e.target.checked)}
              className="mr-2"
            />
            Billing
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={address.is_shipping || false}
              onChange={(e) => onAddressChange(addressIndex, 'is_shipping', e.target.checked)}
              className="mr-2"
            />
            Shipping
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={address.is_jobsite || false}
              onChange={(e) => onAddressChange(addressIndex, 'is_jobsite', e.target.checked)}
              className="mr-2"
            />
            Jobsite
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={address.is_mailing || false}
              onChange={(e) => onAddressChange(addressIndex, 'is_mailing', e.target.checked)}
              className="mr-2"
            />
            Mailing
          </label>
        </div>
      </div>

      <div>
        <label className={labelClass}>Address Line 1</label>
        <input
          type="text"
          value={address.address_line1 || ''}
          onChange={(e) => onAddressChange(addressIndex, 'address_line1', e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Address Line 2</label>
        <input
          type="text"
          value={address.address_line2 || ''}
          onChange={(e) => onAddressChange(addressIndex, 'address_line2', e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>City</label>
        <input
          type="text"
          value={address.city || ''}
          onChange={(e) => onAddressChange(addressIndex, 'city', e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Province/State *</label>
        <select
          value={address.province_state_short || ''}
          onChange={(e) => onAddressChange(addressIndex, 'province_state_short', e.target.value)}
          className={inputClass}
          required
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
          onChange={(e) => onAddressChange(addressIndex, 'postal_zip', e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Country</label>
        <select
          value={address.country || 'Canada'}
          onChange={(e) => onAddressChange(addressIndex, 'country', e.target.value)}
          className={inputClass}
        >
          <option value="Canada">Canada</option>
          <option value="USA">USA</option>
          <option value="Mexico">Mexico</option>
        </select>
      </div>

      <TaxInfoSection
        address={address}
        addressIndex={addressIndex}
        taxWarning={taxWarning}
        taxDisplayValues={taxDisplayValues}
        onAddressChange={onAddressChange}
        onTaxDisplayValueChange={onTaxDisplayValueChange}
        onTaxDisplayValueBlur={onTaxDisplayValueBlur}
      />

      <div className="md:col-span-2">
        <label className={labelClass}>Comments</label>
        <textarea
          rows={2}
          value={address.comments || ''}
          onChange={(e) => onAddressChange(addressIndex, 'comments', e.target.value)}
          className={inputClass}
          placeholder="Any special delivery instructions or notes..."
        />
      </div>
    </div>
  );
};

export default AddressForm;
