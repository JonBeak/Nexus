import React, { useState, useEffect } from 'react';
import { Search, Building, Loader2, X } from 'lucide-react';
import { customerApi } from '../../services/api';
import { PAGE_STYLES } from '../../constants/moduleColors';

export interface Customer {
  customer_id: number;
  company_name: string;
  contact_name: string;
}

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer) => void;
  onClearCustomer: () => void;
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  selectedCustomer,
  onSelectCustomer,
  onClearCustomer
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const response = await customerApi.getCustomers({
          limit: 1000,
          include_inactive: false
        });
        setCustomers(response.customers || []);
      } catch (error) {
        console.error('Error fetching customers:', error);
      } finally {
        setLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter(customer =>
    customer.company_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (customer.contact_name && customer.contact_name.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  return (
    <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-sm ${PAGE_STYLES.panel.border} border p-3`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center shrink-0">
          <Building className="w-5 h-5 text-green-600 mr-2" />
          <span className={`font-semibold ${PAGE_STYLES.panel.text}`}>Customer</span>
        </div>

        {selectedCustomer ? (
          <div className="flex items-center gap-3 flex-1">
            <div className="bg-green-100 rounded-lg px-4 py-2 border-2 border-green-400 flex items-center gap-3">
              <div>
                <span className="font-semibold text-green-900">{selectedCustomer.company_name}</span>
                {selectedCustomer.contact_name && (
                  <span className="text-sm text-green-700 ml-2">({selectedCustomer.contact_name})</span>
                )}
              </div>
              <button
                onClick={onClearCustomer}
                className="p-0.5 hover:bg-green-200 rounded-full transition-colors"
                title="Clear selection"
              >
                <X className="w-4 h-4 text-green-600" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 relative">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--theme-text-muted)]" />
              <input
                type="text"
                placeholder="Search customers..."
                className={`w-full max-w-md pl-10 pr-4 py-2 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder}`}
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
              />
            </div>

            {showDropdown && (
              <>
                {/* Click-away backdrop */}
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                <div className={`absolute top-full left-0 mt-1 w-full max-w-md z-20 ${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.border} border rounded-lg shadow-lg max-h-64 overflow-y-auto`}>
                  {loadingCustomers ? (
                    <div className={`text-center py-4 ${PAGE_STYLES.panel.textMuted} text-sm`}>
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" />
                      Loading...
                    </div>
                  ) : filteredCustomers.length === 0 ? (
                    <div className={`p-4 text-center ${PAGE_STYLES.panel.textMuted} text-sm`}>
                      No customers found
                    </div>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <div
                        key={customer.customer_id}
                        className={`p-3 cursor-pointer hover:bg-[var(--theme-hover-bg)] transition-all ${PAGE_STYLES.panel.border} border-b last:border-b-0`}
                        onClick={() => {
                          onSelectCustomer(customer);
                          setShowDropdown(false);
                          setCustomerSearch('');
                        }}
                      >
                        <div className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>{customer.company_name}</div>
                        <div className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>{customer.contact_name}</div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerSelector;
