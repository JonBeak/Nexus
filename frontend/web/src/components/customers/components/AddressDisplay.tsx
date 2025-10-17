import React, { useState, useEffect } from 'react';
import { Address } from '../../../types';
import { provincesApi } from '../../../services/api';

interface AddressDisplayProps {
  address: Address;
}

const AddressDisplay: React.FC<AddressDisplayProps> = ({ address }) => {
  const [provinceTaxInfo, setProvinceTaxInfo] = useState<{ tax_name: string; tax_percent: number } | null>(null);

  // Fetch province tax info when province changes
  useEffect(() => {
    if (address.province_state_short && !address.tax_override_percent) {
      provincesApi.getTaxInfo(address.province_state_short)
        .then((data) => {
          if (data) {
            setProvinceTaxInfo({
              tax_name: data.tax_name,
              tax_percent: data.tax_percent
            });
          }
        })
        .catch((err) => {
          console.error('Error fetching province tax info:', err);
          setProvinceTaxInfo(null);
        });
    } else {
      setProvinceTaxInfo(null);
    }
  }, [address.province_state_short, address.tax_override_percent]);

  // Determine what tax info to display
  const getTaxDisplay = () => {
    if (address.tax_override_percent != null) {
      return {
        label: 'Tax Override (%)',
        value: `${(address.tax_override_percent * 100).toFixed(2)}%`,
        reason: address.tax_override_reason
      };
    } else if (provinceTaxInfo) {
      return {
        label: provinceTaxInfo.tax_name,
        value: `${(provinceTaxInfo.tax_percent * 100).toFixed(2)}%`,
        reason: null
      };
    }
    return null;
  };

  const taxDisplay = getTaxDisplay();

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
        {taxDisplay && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm font-semibold text-blue-800 mb-1">Tax Information:</p>
            <div className="text-sm text-blue-700">
              <div>{taxDisplay.label}: {taxDisplay.value}</div>
              {taxDisplay.reason && (
                <div className="mt-1">Reason: {taxDisplay.reason}</div>
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