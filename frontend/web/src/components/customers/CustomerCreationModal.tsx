import React, { useState, useEffect } from 'react';
import { X, Save, Loader } from 'lucide-react';
import { Customer, Address } from '../../types/index';
import { customerApi } from '../../services/api';
import { CustomerFormCreate } from './creation/CustomerFormCreate';
import { AddressManagerCreate } from './creation/AddressManagerCreate';
import { CustomerCreationValidation } from './creation/CustomerCreationValidation';
import { 
  CustomerCreationModalProps, 
  CustomerCreateData, 
  ProvinceState,
  DEFAULT_CUSTOMER_VALUES 
} from './creation/CustomerCreationTypes';

export const CustomerCreationModal: React.FC<CustomerCreationModalProps> = ({
  isOpen,
  onClose,
  onCustomerCreated,
  ledTypes,
  powerSupplyTypes,
  showNotification
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [provincesStates, setProvincesStates] = useState<ProvinceState[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const [addresses, setAddresses] = useState<Partial<Address>[]>([{
    address_line1: '',
    address_line2: '',
    city: '',
    province_state_short: '',
    postal_zip: '',
    is_primary: true,
    is_billing: false,
    is_shipping: false,
    is_jobsite: false,
    is_mailing: false
  }]);

  // CORRECTED: Use proper field names and defaults from CustomerCreationTypes
  const [formData, setFormData] = useState<CustomerCreateData>(DEFAULT_CUSTOMER_VALUES);

  // Load provinces/states on component mount
  useEffect(() => {
    if (isOpen) {
      loadProvincesStates();
      loadProductTypes();
    }
  }, [isOpen]);

  const loadProvincesStates = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://192.168.2.14:3001/api/customers/provinces-states', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProvincesStates(data);
      }
    } catch (error) {
      console.error('Error loading provinces/states:', error);
    }
  };

  const loadProductTypes = async () => {
    // Product types are already passed as props, but we could load more here if needed
  };


  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-fill QuickBooks name when company name changes
    if (field === 'company_name' && value && !formData.quickbooks_name) {
      setFormData(prev => ({ ...prev, quickbooks_name: value }));
    }
    
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Comprehensive validation using the new validation system
    const validation = CustomerCreationValidation.validateCustomerData(formData, addresses);
    
    if (!validation.isValid) {
      const errorMessages = validation.errors.map(error => error.message);
      setValidationErrors(errorMessages);
      showNotification('Please fix validation errors before submitting', 'error');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Prepare customer data with CORRECTED field names
      const customerData = {
        ...formData,
        quickbooks_name: formData.quickbooks_name || formData.company_name,
        discount: formData.discount || 0,
        wire_length: formData.wire_length,
        shipping_multiplier: formData.shipping_multiplier || 1.5,
        shipping_flat: formData.shipping_flat || 0, // CORRECTED: was flat_shipping_rate
        default_turnaround: formData.default_turnaround || 10,
        // Only include addresses that have required fields
        addresses: addresses.filter(addr => 
          addr.province_state_short?.trim() && addr.address_line1?.trim()
        )
      };

      const response = await customerApi.createCustomer(customerData);
      
      showNotification('Customer created successfully', 'success');
      onCustomerCreated(response.customer);
      onClose();
      
      // Reset form
      resetForm();
    } catch (error) {
      console.error('Error creating customer:', error);
      showNotification('Failed to create customer', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    // CORRECTED: Use proper defaults from CustomerCreationTypes
    setFormData(DEFAULT_CUSTOMER_VALUES);
    setAddresses([{
      address_line1: '',
      address_line2: '',
      city: '',
      province_state_short: '',
      postal_zip: '',
      is_primary: true,
      is_billing: false,
      is_shipping: false,
      is_jobsite: false,
      is_mailing: false
    }]);
    setValidationErrors([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Create New Customer</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-semibold text-red-800 mb-2">Please fix the following errors:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Form Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(95vh-140px)]">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Customer Form Component */}
              <CustomerFormCreate
                formData={formData}
                ledTypes={ledTypes}
                powerSupplyTypes={powerSupplyTypes}
                onInputChange={handleInputChange}
              />

              {/* Address Manager Component */}
              <AddressManagerCreate
                addresses={addresses}
                setAddresses={setAddresses}
                provincesStates={provincesStates}
              />
            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.company_name?.trim()}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
            >
              {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              <span>Create Customer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};