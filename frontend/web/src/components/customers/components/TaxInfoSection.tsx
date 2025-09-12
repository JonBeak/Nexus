import React from 'react';
import { Address } from '../../../types';

interface TaxInfoSectionProps {
  address: Address;
  addressIndex: number;
  taxWarning: string;
  taxDisplayValues: {[key: string]: string};
  onAddressChange: (index: number, field: string, value: any) => void;
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
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-semibold text-gray-600">Use Province Tax</label>
          <select
            value={address.use_province_tax ? 'yes' : 'no'}
            onChange={(e) => onAddressChange(addressIndex, 'use_province_tax', e.target.value === 'yes')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        
        <div>
          <label className="text-sm font-semibold text-gray-600">Tax Type</label>
          <input
            type="text"
            value={address.tax_type || ''}
            onChange={(e) => onAddressChange(addressIndex, 'tax_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
            placeholder="e.g., HST ON, GST"
          />
        </div>
        
        <div>
          <label className="text-sm font-semibold text-gray-600">Tax Percentage (%)</label>
          <input
            type="number"
            step="0.01"
            value={taxDisplayValues[addressKey] !== undefined 
              ? taxDisplayValues[addressKey]
              : address.tax_override_percent ? (address.tax_override_percent * 100).toFixed(2) : ''}
            onChange={(e) => onTaxDisplayValueChange(addressKey, e.target.value, addressIndex)}
            onBlur={() => onTaxDisplayValueBlur(addressKey)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-primary-red"
            placeholder="13.00"
          />
        </div>
        
        <div className="md:col-span-3">
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