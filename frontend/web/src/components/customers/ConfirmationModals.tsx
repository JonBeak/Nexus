import React, { useState } from 'react';
import { customerApi } from '../../services/api';
import { Address, Customer } from '../../types';
import { PAGE_STYLES } from '../../constants/moduleColors';
import SelectPrimaryAddressModal from './SelectPrimaryAddressModal';
import { useAlert } from '../../contexts/AlertContext';

interface DeleteConfirmation {
  show: boolean;
  address: Address | null;
  index: number;
}

interface DeactivateConfirmation {
  show: boolean;
  customer: Customer | null;
}

interface ConfirmationModalsProps {
  deleteConfirmation: DeleteConfirmation;
  setDeleteConfirmation: (confirmation: DeleteConfirmation) => void;
  deactivateConfirmation: DeactivateConfirmation;
  setDeactivateConfirmation: (confirmation: DeactivateConfirmation) => void;
  customer: Customer;
  allAddresses: Address[];
  onAddressDeleted: (index: number) => void;
  onDeletePrimaryAddress: (index: number, newPrimaryAddressId: number | string) => Promise<void>;
  onCustomerDeactivated: () => void;
}

function ConfirmationModals({
  deleteConfirmation,
  setDeleteConfirmation,
  deactivateConfirmation,
  setDeactivateConfirmation,
  customer,
  allAddresses,
  onAddressDeleted,
  onDeletePrimaryAddress,
  onCustomerDeactivated
}: ConfirmationModalsProps) {
  const { showError } = useAlert();
  const [showSelectPrimaryModal, setShowSelectPrimaryModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getAddressTypeLabels = (address: Address) => {
    const types = [];
    if (address.is_primary) types.push('Primary');
    if (address.is_billing) types.push('Billing');
    if (address.is_shipping) types.push('Shipping');
    if (address.is_jobsite) types.push('Jobsite');
    if (address.is_mailing) types.push('Mailing');
    return types.length > 0 ? types.join(', ') : 'Address';
  };

  // Get remaining active addresses (excluding the one being deleted)
  const getRemainingAddresses = () => {
    if (!deleteConfirmation.address) return [];
    return allAddresses.filter(
      addr => addr.address_id !== deleteConfirmation.address!.address_id && addr.is_active !== false
    );
  };

  // Get the newest address from remaining (for default selection)
  const getNewestAddressId = (remaining: Address[]): number | string | null => {
    if (remaining.length === 0) return null;
    // Assuming higher address_id = newer (auto-increment)
    // If address_id is string 'new', exclude it
    const validAddresses = remaining.filter(a => a.address_id !== 'new');
    if (validAddresses.length === 0) return null;
    const sorted = [...validAddresses].sort((a, b) => {
      const idA = typeof a.address_id === 'number' ? a.address_id : parseInt(a.address_id as string, 10);
      const idB = typeof b.address_id === 'number' ? b.address_id : parseInt(b.address_id as string, 10);
      return idB - idA; // Descending order (newest first)
    });
    return sorted[0].address_id;
  };

  const handleDeleteConfirm = () => {
    const address = deleteConfirmation.address;
    if (!address) return;

    // Check if deleting primary address
    if (address.is_primary) {
      const remaining = getRemainingAddresses();

      if (remaining.length === 0) {
        // Cannot delete last address - shouldn't happen, but handle it
        showError('Cannot delete the last address.');
        setDeleteConfirmation({show: false, address: null, index: -1});
        return;
      }

      if (remaining.length === 1) {
        // Auto-assign the only remaining address
        handleDeletePrimaryWithAutoAssign(remaining[0].address_id);
      } else {
        // Multiple remaining - show selection modal
        setShowSelectPrimaryModal(true);
      }
    } else {
      // Not primary - normal delete
      onAddressDeleted(deleteConfirmation.index);
      setDeleteConfirmation({show: false, address: null, index: -1});
    }
  };

  const handleDeletePrimaryWithAutoAssign = async (newPrimaryId: number | string) => {
    setIsDeleting(true);
    try {
      await onDeletePrimaryAddress(deleteConfirmation.index, newPrimaryId);
      setDeleteConfirmation({show: false, address: null, index: -1});
    } catch (error) {
      console.error('Error deleting primary address:', error);
      showError('Failed to delete address. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectPrimaryConfirm = async (newPrimaryAddressId: number | string) => {
    setShowSelectPrimaryModal(false);
    await handleDeletePrimaryWithAutoAssign(newPrimaryAddressId);
  };

  const handleSelectPrimaryCancel = () => {
    setShowSelectPrimaryModal(false);
    setDeleteConfirmation({show: false, address: null, index: -1});
  };

  const handleDeactivateConfirm = async () => {
    try {
      await customerApi.deactivateCustomer(customer.customer_id);
      setDeactivateConfirmation({show: false, customer: null});
      onCustomerDeactivated();
    } catch (error) {
      console.error('Error deactivating customer:', error);
      showError('Failed to deactivate customer. Please try again.');
    }
  };

  // Calculate remaining addresses for display logic
  const remainingAddresses = getRemainingAddresses();
  const isPrimaryWithOneRemaining = deleteConfirmation.address?.is_primary && remainingAddresses.length === 1;
  const newestAddressId = getNewestAddressId(remainingAddresses);

  return (
    <>
      {/* Select Primary Address Modal (shown when deleting primary with 2+ remaining) */}
      {showSelectPrimaryModal && deleteConfirmation.address && newestAddressId && (
        <SelectPrimaryAddressModal
          addresses={allAddresses}
          addressToDelete={deleteConfirmation.address}
          defaultSelectedId={newestAddressId}
          onConfirm={handleSelectPrimaryConfirm}
          onCancel={handleSelectPrimaryCancel}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation.show && !showSelectPrimaryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className={`${PAGE_STYLES.panel.background} rounded-lg p-6 max-w-md w-full mx-4`}>
            <h3 className={`text-lg font-bold ${PAGE_STYLES.panel.text} mb-4`}>Confirm Delete</h3>
            <p className={`${PAGE_STYLES.panel.textSecondary} mb-2`}>Are you sure you want to delete this address?</p>
            <div className={`${PAGE_STYLES.header.background} p-3 rounded text-sm mb-4`}>
              <strong>{getAddressTypeLabels(deleteConfirmation.address!)}</strong><br />
              {deleteConfirmation.address!.address_line1}<br />
              {deleteConfirmation.address!.city}, {deleteConfirmation.address!.province_state_short} {deleteConfirmation.address!.postal_zip}
            </div>
            {/* Note when deleting primary with exactly 1 remaining address */}
            {isPrimaryWithOneRemaining && (
              <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500 rounded text-sm">
                <span className="text-blue-300">
                  The remaining address will automatically become the new primary.
                </span>
              </div>
            )}
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setDeleteConfirmation({show: false, address: null, index: -1})}
                disabled={isDeleting}
                className={`px-4 py-2 ${PAGE_STYLES.header.background} hover:bg-gray-500 ${PAGE_STYLES.panel.text} rounded font-semibold transition-colors disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Customer Confirmation Dialog */}
      {deactivateConfirmation.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className={`${PAGE_STYLES.panel.background} rounded-lg p-6 max-w-md w-full mx-4`}>
            <h3 className={`text-lg font-bold ${PAGE_STYLES.panel.text} mb-4`}>Confirm Deactivate</h3>
            <p className={`${PAGE_STYLES.panel.textSecondary} mb-2`}>Are you sure you want to deactivate this customer?</p>
            <div className={`${PAGE_STYLES.header.background} p-3 rounded text-sm mb-4`}>
              <strong>{deactivateConfirmation.customer?.company_name}</strong><br />
              {deactivateConfirmation.customer?.contact_first_name && deactivateConfirmation.customer?.contact_last_name && (
                <span>{deactivateConfirmation.customer.contact_first_name} {deactivateConfirmation.customer.contact_last_name}<br /></span>
              )}
              {deactivateConfirmation.customer?.email && (
                <span>{deactivateConfirmation.customer.email}<br /></span>
              )}
              <span className="text-orange-600 text-xs">This will hide the customer from the main list.</span>
            </div>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setDeactivateConfirmation({show: false, customer: null})}
                className={`px-4 py-2 ${PAGE_STYLES.header.background} hover:bg-gray-500 ${PAGE_STYLES.panel.text} rounded font-semibold transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivateConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition-colors"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ConfirmationModals;