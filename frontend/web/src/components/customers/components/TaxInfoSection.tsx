import React from 'react';
import { Address } from '../../../types';

interface TaxInfoSectionProps {
  address: Address;
  addressIndex: number;
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

const TaxInfoSection: React.FC<TaxInfoSectionProps> = ({
  address,
  addressIndex,
  taxWarning,
  taxDisplayValues,
  onAddressChange,
  onTaxDisplayValueChange,
  onTaxDisplayValueBlur
}) => {
  const addressKey = `${address.address_id}-${addressIndex}`;

  return (
    <div className="md:col-span-2">
      <h6 className="text-md font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-2">
        Tax Information
      </h6>

      {taxWarning && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <div className="text-yellow-600 text-sm font-medium">
              ⚠️ {taxWarning}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-gray-600">
            Tax Override (%)
            <span className="text-xs text-gray-500 ml-2">Leave blank for province default</span>
          </label>
          <input
            type="number"
            step="0.01"
            value={taxDisplayValues[addressKey] !== undefined
              ? taxDisplayValues[addressKey]
              : address.tax_override_percent ? (address.tax_override_percent * 100).toFixed(2) : ''}
            onChange={(e) => onTaxDisplayValueChange(addressKey, e.target.value, addressIndex)}
            onBlur={() => onTaxDisplayValueBlur(addressKey)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
            placeholder="Leave blank to use province tax"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-semibold text-gray-600">Tax Override Reason</label>
          <input
            type="text"
            value={address.tax_override_reason || ''}
            onChange={(e) => onAddressChange(addressIndex, 'tax_override_reason', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
            placeholder="Reason for tax override (if applicable)"
          />
        </div>
      </div>
    </div>
  );
};

export default TaxInfoSection;
