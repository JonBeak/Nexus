import React, { useState, useEffect, useCallback } from 'react';
import { customerApi, ledsApi, powerSuppliesApi } from '../../services/api';
import CustomerForm from './CustomerForm';
import AddressManager from './AddressManager';
import ContactsEditor from './ContactsEditor';
import AccountingEmailsEditor from './AccountingEmailsEditor';
import ConfirmationModals from './ConfirmationModals';
import { Address, Customer, LedType, PowerSupplyType } from '../../types';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import { useModalBackdrop } from '../../hooks/useModalBackdrop';

interface DeleteConfirmation {
  show: boolean;
  address: Address | null;
  index: number;
}

interface DeactivateConfirmation {
  show: boolean;
  customer: Customer | null;
}

interface CustomerDetailsModalProps {
  isOpen: boolean;
  customer: Customer | null;
  onClose: () => void;
}

function CustomerDetailsModal({ isOpen, customer, onClose }: CustomerDetailsModalProps) {
  // Nested modal states (for preventClose)
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>({show: false, address: null, index: -1});
  const [deactivateConfirmation, setDeactivateConfirmation] = useState<DeactivateConfirmation>({show: false, customer: null});

  const { modalContentRef, handleBackdropMouseDown, handleBackdropMouseUp, isMobile } =
    useModalBackdrop({
      isOpen,
      onClose,
      preventClose: deleteConfirmation.show || deactivateConfirmation.show
    });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Customer>({} as Customer);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [ledTypes, setLedTypes] = useState<LedType[]>([]);
  const [powerSupplyTypes, setPowerSupplyTypes] = useState<PowerSupplyType[]>([]);

  // Helper function to refresh customer details
  const refreshCustomerDetails = async () => {
    if (!customer) return;
    try {
      const updatedCustomer = await customerApi.getCustomer(customer.customer_id);
      setFormData({ ...updatedCustomer });
      // Don't automatically set addresses here - let the toggle logic handle it
    } catch (error) {
      console.error('Error refreshing customer details:', error);
    }
  };
  
  const refreshAddresses = useCallback(async () => {
    if (!customer) return;
    try {
      if (showDeactivated) {
        const data = await customerApi.getAddresses(customer.customer_id, true);
        setAddresses(data.addresses || []);
      } else {
        const data = await customerApi.getCustomer(customer.customer_id);
        setAddresses(data.addresses || []);
      }
    } catch (error) {
      console.error('Error refreshing addresses:', error);
    }
  }, [customer?.customer_id, showDeactivated]);

  useEffect(() => {
    if (customer) setFormData({ ...customer });
  }, [customer]);

  // Fetch LED and Power Supply types on component mount
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const [ledTypesData, powerSupplyTypesData] = await Promise.all([
          ledsApi.getActiveLEDs(),
          powerSuppliesApi.getActivePowerSupplies()
        ]);

        setLedTypes(ledTypesData as LedType[]);
        setPowerSupplyTypes(powerSupplyTypesData as PowerSupplyType[]);
      } catch (error) {
        console.error('Error fetching types:', error);
      }
    };

    fetchTypes();
  }, []);

  // Refetch addresses when customer or toggle state changes
  useEffect(() => {
    refreshAddresses();
  }, [refreshAddresses]);

  if (!isOpen || !customer) return null;

  const handleCancel = () => {
    setFormData({ ...customer });
    setIsEditing(false);
    setSaveError('');
  };

  const handleInputChange = <K extends keyof Customer>(
    field: K,
    value: Customer[K] | null
  ) => {
    setFormData(prev => {
      const normalizedValue = value === null ? undefined : value;
      const updated: Customer = {
        ...prev,
        [field]: normalizedValue
      };

      if (field === 'company_name') {
        const companyName = typeof normalizedValue === 'string' ? normalizedValue : '';
        updated.quickbooks_name = companyName;
      }

      return updated;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError('');
    
    try {
      await customerApi.updateCustomer(customer.customer_id, formData);
      setIsEditing(false);
      // Refresh the customer data without page reload
      await refreshCustomerDetails();
      // Refresh addresses based on current toggle state
      await refreshAddresses();
    } catch (error) {
      console.error('Error saving customer:', error);
      setSaveError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteAddress = (address: Address, index: number) => {
    setDeleteConfirmation({ show: true, address, index });
  };

  const handleAddressDeleted = async (index: number) => {
    const address = addresses[index];
    if (address.address_id === 'new') {
      // Remove unsaved address
      const newAddresses = addresses.filter((_, i) => i !== index);
      setAddresses(newAddresses);
    } else {
      try {
        await customerApi.deleteAddress(customer.customer_id, address.address_id);
        await refreshAddresses();
      } catch (error) {
        console.error('Error deleting address:', error);
        setSaveError('Failed to delete address. Please try again.');
      }
    }
  };

  const handleDeletePrimaryAddress = async (index: number, newPrimaryAddressId: number | string) => {
    const address = addresses[index];
    if (address.address_id === 'new') {
      // Shouldn't happen - new addresses can't be primary, but handle it
      const newAddresses = addresses.filter((_, i) => i !== index);
      setAddresses(newAddresses);
      return;
    }

    try {
      // Step 1: Make the selected address the new primary FIRST
      // This ensures a primary always exists
      await customerApi.makePrimaryAddress(customer.customer_id, newPrimaryAddressId);

      // Step 2: Now delete the old primary address
      await customerApi.deleteAddress(customer.customer_id, address.address_id);

      // Step 3: Refresh addresses to show updated state
      await refreshAddresses();
    } catch (error) {
      console.error('Error during primary address reassignment and delete:', error);
      setSaveError('Failed to complete the operation. Please try again.');
      // Refresh to show current state (new primary may have been set)
      await refreshAddresses();
      throw error; // Re-throw so ConfirmationModals knows it failed
    }
  };

  const handleCustomerDeactivated = () => {
    onClose(); // Close modal
    window.location.reload(); // Refresh the customer list
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={modalContentRef}
        className={`${PAGE_STYLES.panel.background} rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto modal-content`}
      >
        <div className={`sticky top-0 ${PAGE_STYLES.panel.background} border-b-2 ${PAGE_STYLES.panel.border} p-6 rounded-t-2xl`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-3xl font-bold ${PAGE_STYLES.panel.text}`}>Customer Details</h2>
            <div className="flex items-center space-x-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className={`${MODULE_COLORS.customers.base} ${MODULE_COLORS.customers.hover} text-white px-4 py-2 rounded-lg font-semibold transition-colors`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeactivateConfirmation({show: true, customer: formData})}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    Deactivate
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                disabled={isSaving}
                className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                ✕ Close
              </button>
            </div>
          </div>
          <h3 className={`text-xl ${MODULE_COLORS.customers.text} font-semibold mt-2`}>{formData.company_name || customer.company_name}</h3>

          {saveError && (
            <div className="mt-4 bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {saveError}
            </div>
          )}
        </div>

        <div className="p-6 space-y-8">
          <CustomerForm 
            formData={formData}
            isEditing={isEditing}
            ledTypes={ledTypes}
            powerSupplyTypes={powerSupplyTypes}
            onInputChange={handleInputChange}
          />

          <AddressManager
            customer={customer}
            addresses={addresses}
            setAddresses={setAddresses}
            showDeactivated={showDeactivated}
            setShowDeactivated={setShowDeactivated}
            isEditing={isEditing}
            setSaveError={setSaveError}
            onAddressDelete={confirmDeleteAddress}
          />

          {/* Contacts Section */}
          <div className="mt-8">
            <h4 className={`text-lg font-bold ${PAGE_STYLES.panel.text} mb-4 border-b ${PAGE_STYLES.panel.border} pb-2`}>Contacts</h4>
            <ContactsEditor customerId={customer.customer_id} />
          </div>

          {/* Accounting Emails Section */}
          <div className="mt-8">
            <h4 className={`text-lg font-bold ${PAGE_STYLES.panel.text} mb-4 border-b ${PAGE_STYLES.panel.border} pb-2`}>Accounting Emails</h4>
            <p className={`text-sm ${PAGE_STYLES.panel.textMuted} mb-3`}>Email addresses for sending invoices. Set type (To/CC/BCC) for each recipient.</p>
            <AccountingEmailsEditor customerId={customer.customer_id} />
          </div>
        </div>
      </div>
      
      <ConfirmationModals
        deleteConfirmation={deleteConfirmation}
        setDeleteConfirmation={setDeleteConfirmation}
        deactivateConfirmation={deactivateConfirmation}
        setDeactivateConfirmation={setDeactivateConfirmation}
        customer={customer}
        allAddresses={addresses}
        onAddressDeleted={handleAddressDeleted}
        onDeletePrimaryAddress={handleDeletePrimaryAddress}
        onCustomerDeactivated={handleCustomerDeactivated}
      />
    </div>
  );
}

export default CustomerDetailsModal;
