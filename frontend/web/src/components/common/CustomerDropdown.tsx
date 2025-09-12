import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { AutofillComboBox } from './AutofillComboBox';

interface Customer {
  customer_id: number;
  company_name: string;
  quickbooks_name?: string;
}

interface CustomerDropdownProps {
  value?: number;
  onChange: (customerId: number | null, customer: Customer | null) => void;
  customers: Customer[];
  loading?: boolean;
  required?: boolean;
  className?: string;
  onAddCustomer?: () => void;
}

export const CustomerDropdown: React.FC<CustomerDropdownProps> = ({
  value,
  onChange,
  customers,
  loading = false,
  required = false,
  className = '',
  onAddCustomer
}) => {
  const [searchValue, setSearchValue] = useState('');

  // Find selected customer and set display value
  const selectedCustomer = customers.find(c => c.customer_id === value);
  const displayValue = selectedCustomer ? selectedCustomer.company_name : searchValue;

  // Create suggestions from customer names
  const suggestions = customers.map(customer => customer.company_name);

  // Update search value when external value changes
  useEffect(() => {
    if (selectedCustomer) {
      setSearchValue(selectedCustomer.company_name);
    } else if (value === null || value === undefined) {
      setSearchValue('');
    }
  }, [value, selectedCustomer]);

  const handleValueChange = (newValue: string) => {
    setSearchValue(newValue);
    
    // Find customer by company name
    const matchedCustomer = customers.find(c => 
      c.company_name.toLowerCase() === newValue.toLowerCase()
    );
    
    if (matchedCustomer) {
      onChange(matchedCustomer.customer_id, matchedCustomer);
    } else if (newValue === '') {
      onChange(null, null);
    }
    // If partial match, don't trigger onChange yet
  };

  const handleTabComplete = () => {
    // On tab, try to auto-complete with first matching customer
    const searchLower = searchValue.toLowerCase();
    const matchedCustomer = customers.find(c => 
      c.company_name.toLowerCase().includes(searchLower) && c.company_name.toLowerCase() !== searchLower
    );
    
    if (matchedCustomer) {
      setSearchValue(matchedCustomer.company_name);
      onChange(matchedCustomer.customer_id, matchedCustomer);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-end space-x-2">
        <div className="flex-1">
          <AutofillComboBox
            label="Customer"
            value={displayValue}
            onChange={handleValueChange}
            suggestions={suggestions}
            placeholder="Type to search customers..."
            required={required}
            loading={loading}
            onTab={handleTabComplete}
          />
        </div>
        
        {onAddCustomer && (
          <button
            type="button"
            onClick={onAddCustomer}
            className="flex items-center space-x-1 bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 whitespace-nowrap text-sm"
            title="Add new customer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        )}
      </div>
      
      {searchValue && !selectedCustomer && searchValue.trim().length > 0 && (
        <div className="mt-1 text-sm text-amber-600">
          Type exact customer name or select from suggestions
        </div>
      )}
    </div>
  );
};