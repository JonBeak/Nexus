import React from 'react';
import { Address } from '../../../types';

interface AddressDisplayProps {
  address: Address;
}

const AddressDisplay: React.FC<AddressDisplayProps> = ({ address }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <p className="text-gray-800">
          <strong>{address.address_line1}</strong>
          {address.address_line2 && <>, {address.address_line2}</>}
        </p>
        <p className="text-gray-800">
          {address.city}, {address.province_state_short} {address.postal_zip}
        </p>
        <p className="text-gray-600">{address.country}</p>
        
        {/* Tax Information Display */}
        {(address.tax_type || address.tax_override_percent) && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm font-semibold text-blue-800 mb-1">Tax Information:</p>
            <div className="text-sm text-blue-700">
              {address.tax_type && <div>Type: {address.tax_type}</div>}
              {address.tax_override_percent && (
                <div>Rate: {(address.tax_override_percent * 100).toFixed(2)}%</div>
              )}
              {address.tax_override_reason && (
                <div className="mt-1">Reason: {address.tax_override_reason}</div>
              )}
            </div>
          </div>
        )}
        
        {address.comments && (
          <p className="text-sm text-gray-600 mt-2 italic">{address.comments}</p>
        )}
      </div>
    </div>
  );
};

export default AddressDisplay;