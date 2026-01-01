import React, { useState, useEffect, useCallback } from 'react';
import { Search, Building } from 'lucide-react';
import { customerApi } from '../../services/api';
import { PAGE_STYLES } from '../../constants/moduleColors';

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
    <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-sm border ${PAGE_STYLES.border} p-6 h-full`}>
      {/* Header */}
      <div className="flex items-center mb-4">
        <Building className="w-5 h-5 text-emerald-600 mr-2" />
        <h2 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>
          {selectedCustomer ? `Customer: ${selectedCustomer.company_name}` : 'All Customers'}
        </h2>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className={`absolute left-3 top-3 h-4 w-4 ${PAGE_STYLES.panel.textMuted}`} />
        <input
          type="text"
          placeholder="Search customers..."
          className={`w-full pl-10 pr-4 py-2 ${PAGE_STYLES.input.background} border ${PAGE_STYLES.border} rounded-lg text-sm ${PAGE_STYLES.input.placeholder}`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Customer List */}
      {loading ? (
        <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted} text-sm`}>
          Loading customers...
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <div className={`max-h-[calc(100vh-300px)] overflow-y-auto border ${PAGE_STYLES.border}`}>
            {/* All Customers Option */}
            <div
              className={`py-2 px-3 cursor-pointer ${PAGE_STYLES.interactive.hover} transition-all ${
                selectedCustomerId === null ? `bg-emerald-100 ring-2 ring-inset ring-emerald-500 border-b ${PAGE_STYLES.border}` : `border-b ${PAGE_STYLES.border}`
              }`}
              onClick={() => onCustomerSelected(null)}
            >
              <div className={`font-medium ${PAGE_STYLES.panel.textSecondary} ${selectedCustomerId === null ? 'font-semibold' : ''}`}>All Customers</div>
              <div className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>Show jobs from all customers</div>
            </div>

            {/* Individual Customers */}
            {filteredCustomers.map((customer) => (
              <div
                key={customer.customer_id}
                className={`py-2 px-3 cursor-pointer ${PAGE_STYLES.interactive.hover} transition-all ${
                  selectedCustomerId === customer.customer_id ? `bg-emerald-100 ring-2 ring-inset ring-emerald-500 border-b ${PAGE_STYLES.border}` : `border-b ${PAGE_STYLES.border} last:border-b-0`
                }`}
                onClick={() => handleCustomerSelect(customer.customer_id)}
              >
                <div className={`text-sm ${selectedCustomerId === customer.customer_id ? 'font-semibold' : 'font-medium'}`}>{customer.company_name}</div>
                <div className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>{customer.contact_name}</div>
              </div>
            ))}

            {filteredCustomers.length === 0 && (
              <div className={`p-6 text-center ${PAGE_STYLES.panel.textMuted} text-sm`}>
                No customers found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
