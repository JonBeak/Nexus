import React from 'react';
import { customerApi } from '../../services/api';
import { Address, Customer } from '../../types';

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
  onAddressDeleted: (index: number) => void;
  onCustomerDeactivated: () => void;
}

function ConfirmationModals({
  deleteConfirmation,
  setDeleteConfirmation,
  deactivateConfirmation,
  setDeactivateConfirmation,
  customer,
  onAddressDeleted,
  onCustomerDeactivated
}: ConfirmationModalsProps) {
  const getAddressTypeLabels = (address: Address) => {
    const types = [];
    if (Boolean(address.is_primary)) types.push('Primary');
    if (Boolean(address.is_billing)) types.push('Billing');
    if (Boolean(address.is_shipping)) types.push('Shipping');
    if (Boolean(address.is_jobsite)) types.push('Jobsite');
    if (Boolean(address.is_mailing)) types.push('Mailing');
    return types.length > 0 ? types.join(', ') : 'Address';
  };

  const handleDeleteConfirm = () => {
    onAddressDeleted(deleteConfirmation.index);
    setDeleteConfirmation({show: false, address: null, index: -1});
  };

  const handleDeactivateConfirm = async () => {
    try {
      await customerApi.deactivateCustomer(customer.customer_id);
      setDeactivateConfirmation({show: false, customer: null});
      onCustomerDeactivated();
    } catch (error) {
      console.error('Error deactivating customer:', error);
      alert('Failed to deactivate customer. Please try again.');
    }
  };

  return (
    <>
      {/* Delete Confirmation Dialog */}
      {deleteConfirmation.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-2">Are you sure you want to delete this address?</p>
            <div className="bg-gray-50 p-3 rounded text-sm mb-4">
              <strong>{getAddressTypeLabels(deleteConfirmation.address!)}</strong><br />
              {deleteConfirmation.address!.address_line1}<br />
              {deleteConfirmation.address!.city}, {deleteConfirmation.address!.province_state_short} {deleteConfirmation.address!.postal_zip}
            </div>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setDeleteConfirmation({show: false, address: null, index: -1})}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Deactivate Customer Confirmation Dialog */}
      {deactivateConfirmation.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Deactivate</h3>
            <p className="text-gray-600 mb-2">Are you sure you want to deactivate this customer?</p>
            <div className="bg-gray-50 p-3 rounded text-sm mb-4">
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
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded font-semibold transition-colors"
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