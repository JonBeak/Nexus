import React, { useState, useEffect } from 'react';
import { customerApi } from '../../services/api';
import CustomerForm from './CustomerForm';
import AddressManager from './AddressManager';
import ConfirmationModals from './ConfirmationModals';
import { Address, Customer, LedType, PowerSupplyType } from '../../types';

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
  customer: Customer;
  onClose: () => void;
}

function CustomerDetailsModal({ customer, onClose }: CustomerDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Customer>({} as Customer);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>({show: false, address: null, index: -1});
  const [ledTypes, setLedTypes] = useState<LedType[]>([]);
  const [powerSupplyTypes, setPowerSupplyTypes] = useState<PowerSupplyType[]>([]);
  const [deactivateConfirmation, setDeactivateConfirmation] = useState<DeactivateConfirmation>({show: false, customer: null});

  // Helper function to refresh customer details
  const refreshCustomerDetails = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://192.168.2.14:3001/api/customers/${customer.customer_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const updatedCustomer = await response.json();
        setFormData({ ...updatedCustomer });
        // Don't automatically set addresses here - let the toggle logic handle it
        // setAddresses(updatedCustomer.addresses || []);
      }
    } catch (error) {
      console.error('Error refreshing customer details:', error);
    }
  };

  useEffect(() => {
    if (customer) {
      setFormData({ ...customer });
      // Initialize addresses based on current toggle state
      if (showDeactivated) {
        fetchDeactivatedAddresses();
      } else {
        setAddresses(customer.addresses || []);
      }
    }
  }, [customer]);

  // Fetch LED and Power Supply types on component mount
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const [ledTypesData, powerSupplyTypesData] = await Promise.all([
          customerApi.getLedTypes(),
          customerApi.getPowerSupplyTypes()
        ]);
        
        setLedTypes(ledTypesData);
        setPowerSupplyTypes(powerSupplyTypesData);
      } catch (error) {
        console.error('Error fetching types:', error);
      }
    };

    fetchTypes();
  }, []);

  // Refetch addresses when showDeactivated toggle changes
  useEffect(() => {
    if (customer) {
      refreshAddresses();
    }
  }, [showDeactivated]);

  if (!customer) return null;

  const handleCancel = () => {
    setFormData({ ...customer });
    setIsEditing(false);
    setSaveError('');
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: Customer) => ({ ...prev, [field]: value }));
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
      setSaveError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const refreshAddresses = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (showDeactivated) {
        const response = await fetch(`http://192.168.2.14:3001/api/customers/${customer.customer_id}/addresses?include_inactive=true`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setAddresses(data.addresses || []);
        }
      } else {
        const response = await fetch(`http://192.168.2.14:3001/api/customers/${customer.customer_id}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (response.ok) {
          const data = await response.json();
          setAddresses(data.addresses || []);
        }
      }
    } catch (error) {
      console.error('Error refreshing addresses:', error);
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

  const handleCustomerDeactivated = () => {
    onClose(); // Close modal
    window.location.reload(); // Refresh the customer list
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto modal-content">
        <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-gray-800">Customer Details</h2>
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
                    className="bg-primary-blue hover:bg-primary-blue-dark text-white px-4 py-2 rounded-lg font-semibold transition-colors"
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
          <h3 className="text-xl text-primary-blue font-semibold mt-2">{formData.company_name || customer.company_name}</h3>
          
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
        </div>
      </div>
      
      <ConfirmationModals 
        deleteConfirmation={deleteConfirmation}
        setDeleteConfirmation={setDeleteConfirmation}
        deactivateConfirmation={deactivateConfirmation}
        setDeactivateConfirmation={setDeactivateConfirmation}
        customer={customer}
        onAddressDeleted={handleAddressDeleted}
        onCustomerDeactivated={handleCustomerDeactivated}
      />
    </div>
  );
}

export default CustomerDetailsModal;