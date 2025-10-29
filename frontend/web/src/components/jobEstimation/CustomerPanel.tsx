import React, { useState, useEffect, useCallback } from 'react';
import { Search, Building } from 'lucide-react';
import { customerApi } from '../../services/api';

interface CustomerPanelProps {
  selectedCustomerId: number | null;
  onCustomerSelected: (customerId: number | null, customerName?: string) => void;
}

interface Customer {
  customer_id: number;
  company_name: string;
  contact_name: string;
}

export const CustomerPanel: React.FC<CustomerPanelProps> = ({
  selectedCustomerId,
  onCustomerSelected
}) => {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Load all customers once on mount (cached for frontend filtering)
  useEffect(() => {
    const fetchAllCustomers = async () => {
      setLoading(true);
      try {
        const response = await customerApi.getCustomers({
          limit: 1000,
          include_inactive: false
        });
        setAllCustomers(response.customers || []);
      } catch (error) {
        console.error('Error fetching customers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllCustomers();
  }, []); // Empty deps - load only once

  // Frontend-only filtering (no API calls on search)
  const filteredCustomers = allCustomers.filter(customer =>
    customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.contact_name && customer.contact_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCustomerSelect = (customerId: number) => {
    if (selectedCustomerId === customerId) {
      // Allow deselecting the current customer
      onCustomerSelected(null);
    } else {
      const customer = allCustomers.find(c => c.customer_id === customerId);
      onCustomerSelected(customerId, customer?.company_name);
    }
  };

  const selectedCustomer = allCustomers.find(c => c.customer_id === selectedCustomerId);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full">
      {/* Header */}
      <div className="flex items-center mb-4">
        <Building className="w-5 h-5 text-purple-600 mr-2" />
        <h2 className="text-lg font-semibold">
          {selectedCustomer ? `Customer: ${selectedCustomer.company_name}` : 'All Customers'}
        </h2>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search customers..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Customer List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          Loading customers...
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto border">
            {/* All Customers Option */}
            <div
              className={`p-3 cursor-pointer hover:bg-gray-50 transition-all ${
                selectedCustomerId === null ? 'bg-purple-100 border-2 border-purple-500' : 'border-b'
              }`}
              onClick={() => onCustomerSelected(null)}
            >
              <div className={`font-medium text-gray-700 ${selectedCustomerId === null ? 'font-semibold' : ''}`}>All Customers</div>
              <div className="text-xs text-gray-500">Show jobs from all customers</div>
            </div>

            {/* Individual Customers */}
            {filteredCustomers.map((customer) => (
              <div
                key={customer.customer_id}
                className={`p-3 cursor-pointer hover:bg-gray-50 transition-all ${
                  selectedCustomerId === customer.customer_id ? 'bg-purple-100 border-2 border-purple-500' : 'border-b last:border-b-0'
                }`}
                onClick={() => handleCustomerSelect(customer.customer_id)}
              >
                <div className={`text-sm ${selectedCustomerId === customer.customer_id ? 'font-semibold' : 'font-medium'}`}>{customer.company_name}</div>
                <div className="text-xs text-gray-500">{customer.contact_name}</div>
              </div>
            ))}
            
            {filteredCustomers.length === 0 && (
              <div className="p-6 text-center text-gray-500 text-sm">
                No customers found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
