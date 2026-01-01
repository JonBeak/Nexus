import React from 'react';
import { Address, Customer } from '../../types';
import { useAddressManagement } from './hooks/useAddressManagement';
import AddressForm from './components/AddressForm';
import AddressDisplay from './components/AddressDisplay';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';

interface AddressManagerProps {
  customer: Customer;
  addresses: Address[];
  setAddresses: (addresses: Address[]) => void;
  showDeactivated: boolean;
  setShowDeactivated: (show: boolean) => void;
  isEditing: boolean;
  setSaveError: (error: string) => void;
  onAddressDelete: (address: Address, index: number) => void;
}

function AddressManager({ 
  customer, 
  addresses, 
  setAddresses, 
  showDeactivated, 
  setShowDeactivated, 
  isEditing, 
  setSaveError,
  onAddressDelete
}: AddressManagerProps) {
  const {
    provincesStates,
    taxWarning,
    taxDisplayValues,
    loading,
    handleAddAddress,
    handleUpdateAddress,
    handleMakePrimary,
    handleReactivateAddress,
    handleAddressChange,
    handleTaxDisplayValueChange,
    handleTaxDisplayValueBlur,
    startEditing,
    cancelEditing,
    getAddressTypeLabels
  } = useAddressManagement(
    customer,
    addresses,
    setAddresses,
    showDeactivated,
    setSaveError
  );

  const handleSaveAddress = async (index: number, addressData: Address) => {
    if (!addressData.province_state_short?.trim()) {
      setSaveError('Province/State is required for each address.');
      return;
    }
    await handleUpdateAddress(index, addressData);
  };

  
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h4 className={`text-lg font-bold ${PAGE_STYLES.panel.text} border-b ${PAGE_STYLES.panel.border} pb-2`}>
            Addresses ({addresses.filter(addr => addr.is_active !== false).length})
          </h4>
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={showDeactivated}
              onChange={(e) => setShowDeactivated(e.target.checked)}
              className="rounded"
            />
            <span className={PAGE_STYLES.panel.textSecondary}>Show Deactivated</span>
          </label>
        </div>
        {!isEditing && (
          <button
            onClick={handleAddAddress}
            className={`${MODULE_COLORS.customers.base} ${MODULE_COLORS.customers.hover} text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm`}
          >
            + Add Address
          </button>
        )}
      </div>

      <div className="space-y-4">
        {addresses.map((address, index) => {
          const isDeactivated = !address.is_active;
          return (
          <div key={`${address.address_id}-${index}`} className={`border rounded-lg p-4 ${isDeactivated ? `${PAGE_STYLES.panel.border} ${PAGE_STYLES.header.background} opacity-60` : `${PAGE_STYLES.panel.border} ${PAGE_STYLES.header.background}`}`}>
            <div className="flex items-center justify-between mb-3">
              <h5 className={`font-semibold ${isDeactivated ? PAGE_STYLES.panel.textMuted : PAGE_STYLES.panel.text}`}>
                {getAddressTypeLabels(address)}
                {isDeactivated && <span className="text-red-500 text-sm ml-2">(Deactivated)</span>}
              </h5>
              <div className="flex space-x-2">
                {isDeactivated ? (
                  <button
                    onClick={() => handleReactivateAddress(index)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-semibold transition-colors"
                    disabled={loading}
                  >
                    Reactivate
                  </button>
                ) : (
                  !address.isEditing && (
                    <button
                      onClick={() => startEditing(index)}
                      className={`${MODULE_COLORS.customers.base} ${MODULE_COLORS.customers.hover} text-white px-3 py-1 rounded text-sm font-semibold transition-colors`}
                      disabled={loading}
                    >
                      Edit
                    </button>
                  )
                )}
                {address.isEditing && (
                  <>
                    <button
                      onClick={() => handleSaveAddress(index, address)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-semibold transition-colors"
                      disabled={loading}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => cancelEditing(index)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm font-semibold transition-colors"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </>
                )}
                {!address.isEditing && address.address_id !== 'new' && !isDeactivated && (
                  <>
                    {!address.is_primary && (
                      <button
                        onClick={() => handleMakePrimary(address.address_id)}
                        className={`${MODULE_COLORS.customers.base} ${MODULE_COLORS.customers.hover} text-white px-3 py-1 rounded text-sm font-semibold transition-colors`}
                        disabled={loading}
                      >
                        Make Primary
                      </button>
                    )}
                    <button
                      onClick={() => onAddressDelete(address, index)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-semibold transition-colors"
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            {address.isEditing ? (
              <AddressForm
                address={address}
                addressIndex={index}
                provincesStates={provincesStates}
                taxWarning={taxWarning}
                taxDisplayValues={taxDisplayValues}
                onAddressChange={handleAddressChange}
                onTaxDisplayValueChange={handleTaxDisplayValueChange}
                onTaxDisplayValueBlur={handleTaxDisplayValueBlur}
              />
            ) : (
              <AddressDisplay address={address} />
            )}
          </div>
          );
        })}

        {addresses.length === 0 && (
          <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted}`}>
            <p>No addresses found.</p>
            <button
              onClick={handleAddAddress}
              className={`mt-2 ${MODULE_COLORS.customers.base} ${MODULE_COLORS.customers.hover} text-white px-4 py-2 rounded-lg font-semibold transition-colors`}
            >
              Add First Address
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddressManager;
