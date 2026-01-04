import React from 'react';
import { CustomerTableRow } from './CustomerTableRow';
import { Customer } from '../../../types';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';
import { Pagination } from '../../orders/table/Pagination';

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSearch: (e: React.FormEvent) => void;
  onClearSearch: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  setSearchTerm,
  onSearch,
  onClearSearch
}) => (
  <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow border ${PAGE_STYLES.panel.border} p-3 mb-4`}>
    <form onSubmit={onSearch} className="flex gap-2">
      <div className="flex-1">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search customers..."
          className={`w-full px-3 py-2 border ${PAGE_STYLES.input.border} rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder} text-sm focus:${MODULE_COLORS.customers.border}`}
        />
      </div>
      <button
        type="submit"
        className={`${MODULE_COLORS.customers.base} ${MODULE_COLORS.customers.hover} text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm`}
      >
        Search
      </button>
      {searchTerm && (
        <button
          type="button"
          onClick={onClearSearch}
          className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm"
        >
          Clear
        </button>
      )}
    </form>
  </div>
);

interface CustomerTableProps {
  customers: Customer[];
  loading: boolean;
  error: string;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSearch: (e: React.FormEvent) => void;
  onClearSearch: () => void;
  onCustomerDetails: (customer: Customer) => Promise<void>;
  onReactivateCustomer: (customerId: number) => Promise<void>;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  loading,
  error,
  searchTerm,
  setSearchTerm,
  onSearch,
  onClearSearch,
  onCustomerDetails,
  onReactivateCustomer,
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange
}) => {
  return (
    <main className="max-w-7xl mx-auto px-2 py-2">
      <SearchBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onSearch={onSearch}
        onClearSearch={onClearSearch}
      />

      {error && (
        <div className="bg-red-100 border-2 border-red-300 text-red-700 px-6 py-4 rounded-xl mb-8 text-lg font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className={`w-16 h-16 border-4 ${MODULE_COLORS.customers.border} border-t-transparent rounded-full animate-spin mx-auto mb-4`}></div>
          <p className={`text-xl ${PAGE_STYLES.panel.textSecondary} font-semibold`}>Loading customers...</p>
        </div>
      ) : (
        <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow border ${PAGE_STYLES.panel.border} overflow-hidden`}>
          <div className={`px-3 py-2 ${MODULE_COLORS.customers.base} border-b ${PAGE_STYLES.panel.border}`}>
            <h2 className="text-lg font-bold text-white">Customer Directory ({totalItems} customers)</h2>
          </div>

          {customers.length === 0 ? (
            <div className="p-12 text-center">
              <div className={`w-24 h-24 ${PAGE_STYLES.header.background} rounded-full flex items-center justify-center mx-auto mb-6`}>
                <span className="text-4xl text-[var(--theme-text-muted)]">👥</span>
              </div>
              <h3 className={`text-2xl font-bold ${PAGE_STYLES.panel.text} mb-2`}>No Customers Found</h3>
              <p className={`${PAGE_STYLES.panel.textSecondary} text-lg`}>
                {searchTerm ? 'Try adjusting your search terms.' : 'No customers are currently in the system.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${PAGE_STYLES.header.background} border-b ${PAGE_STYLES.panel.border}`}>
                  <tr className="align-bottom">
                    <th className={`px-2 py-1 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider align-bottom`}>
                      Company
                    </th>
                    <th className={`px-2 py-1 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider align-bottom`}>
                      Location
                    </th>
                    <th className={`px-1 py-1 text-center text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider align-bottom`}>
                      Cash
                    </th>
                    <th className={`px-2 py-1 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider align-bottom`}>
                      LEDs
                    </th>
                    <th className={`px-2 py-1 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider align-bottom`}>
                      Power<br/>Supply
                    </th>
                    <th className={`px-1 py-1 text-center text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider align-bottom`}>
                      UL
                    </th>
                    <th className={`px-1 py-1 text-center text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider align-bottom`}>
                      Drain<br/>Holes
                    </th>
                    <th className={`px-1 py-1 text-center text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider align-bottom`}>
                      Plug &<br/>Play
                    </th>
                    <th className={`px-2 py-1 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider align-bottom`}>
                      Instructions
                    </th>
                    <th className={`px-2 py-1 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider align-bottom`}>
                      Notes
                    </th>
                    <th className={`px-1 py-1 text-right text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider align-bottom`}>
                    </th>
                  </tr>
                </thead>
                <tbody className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.divider}`}>
                  {customers.map((customer) => (
                    <CustomerTableRow
                      key={customer.customer_id}
                      customer={customer}
                      onDetailsClick={onCustomerDetails}
                      onReactivateClick={onReactivateCustomer}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={`p-4 border-t ${PAGE_STYLES.panel.border}`}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={onPageChange}
              />
            </div>
          )}
        </div>
      )}
    </main>
  );
};
