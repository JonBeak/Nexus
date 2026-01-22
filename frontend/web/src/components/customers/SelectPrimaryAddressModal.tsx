import React, { useState } from 'react';
import { Address } from '../../types';
import { PAGE_STYLES } from '../../constants/moduleColors';

interface SelectPrimaryAddressModalProps {
  addresses: Address[];
  addressToDelete: Address;
  defaultSelectedId: number | string;
  onConfirm: (newPrimaryAddressId: number | string) => void;
  onCancel: () => void;
}

/**
 * Modal for selecting a new primary address when deleting the current primary.
 * Pre-selects the newest address by default.
 */
function SelectPrimaryAddressModal({
  addresses,
  addressToDelete,
  defaultSelectedId,
  onConfirm,
  onCancel
}: SelectPrimaryAddressModalProps) {
  const [selectedAddressId, setSelectedAddressId] = useState<number | string>(defaultSelectedId);

  const getAddressTypeLabels = (address: Address) => {
    const types = [];
    if (address.is_billing) types.push('Billing');
    if (address.is_shipping) types.push('Shipping');
    if (address.is_jobsite) types.push('Jobsite');
    if (address.is_mailing) types.push('Mailing');
    return types.length > 0 ? types.join(', ') : 'Address';
  };

  const formatAddress = (address: Address) => {
    const parts = [address.address_line1];
    if (address.address_line2) parts.push(address.address_line2);
    parts.push(`${address.city}, ${address.province_state_short} ${address.postal_zip}`);
    return parts;
  };

  // Filter out the address being deleted
  const remainingAddresses = addresses.filter(
    addr => addr.address_id !== addressToDelete.address_id && addr.is_active !== false
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
      <div className={`${PAGE_STYLES.panel.background} rounded-lg p-6 max-w-lg w-full mx-4`}>
        <h3 className={`text-lg font-bold ${PAGE_STYLES.panel.text} mb-2`}>
          Select New Primary Address
        </h3>
        <p className={`${PAGE_STYLES.panel.textSecondary} mb-4 text-sm`}>
          You are deleting the primary address. Please select which address should become the new primary.
        </p>

        {/* Address being deleted */}
        <div className={`${PAGE_STYLES.header.background} p-3 rounded text-sm mb-4 border-l-4 border-red-500`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-400 font-semibold">Deleting:</span>
            <span className={`${PAGE_STYLES.panel.textMuted}`}>Primary</span>
          </div>
          <div className={PAGE_STYLES.panel.textSecondary}>
            {formatAddress(addressToDelete).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>

        {/* Address selection */}
        <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
          {remainingAddresses.map((address) => (
            <label
              key={address.address_id}
              className={`flex items-start gap-3 p-3 rounded cursor-pointer transition-colors ${
                selectedAddressId === address.address_id
                  ? 'bg-blue-900/30 border border-blue-500'
                  : `${PAGE_STYLES.header.background} hover:bg-gray-600/50 border border-transparent`
              }`}
            >
              <input
                type="radio"
                name="primaryAddress"
                value={String(address.address_id)}
                checked={selectedAddressId === address.address_id}
                onChange={() => setSelectedAddressId(address.address_id)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className={`font-medium ${PAGE_STYLES.panel.text}`}>
                  {getAddressTypeLabels(address)}
                </div>
                <div className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                  {formatAddress(address).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex space-x-3 justify-end">
          <button
            onClick={onCancel}
            className={`px-4 py-2 ${PAGE_STYLES.header.background} hover:bg-gray-500 ${PAGE_STYLES.panel.text} rounded font-semibold transition-colors`}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedAddressId)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition-colors"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default SelectPrimaryAddressModal;
