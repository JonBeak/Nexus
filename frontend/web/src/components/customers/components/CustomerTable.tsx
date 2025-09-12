import React from 'react';
import { CustomerTableRow } from './CustomerTableRow';

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
  <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6 mb-8">
    <form onSubmit={onSearch} className="flex gap-4">
      <div className="flex-1">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search customers by company name, contact, email, or phone..."
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-red focus:ring-opacity-20 focus:border-primary-red transition-all duration-200 bg-gray-50 focus:bg-white text-lg"
        />
      </div>
      <button
        type="submit"
        className="bg-primary-red hover:bg-primary-red-dark text-white px-8 py-3 rounded-xl font-semibold transition-colors shadow-lg"
      >
        Search
      </button>
      {searchTerm && (
        <button
          type="button"
          onClick={onClearSearch}
          className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          Clear
        </button>
      )}
    </form>
  </div>
);

interface CustomerTableProps {
  customers: any[];
  loading: boolean;
  error: string;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSearch: (e: React.FormEvent) => void;
  onClearSearch: () => void;
  onCustomerDetails: (customer: any) => Promise<void>;
  onReactivateCustomer: (customerId: number) => Promise<void>;
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
  onReactivateCustomer
}) => {
  return (
    <main className="max-w-full mx-auto px-2 py-4 md:py-8">
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
          <div className="w-16 h-16 border-4 border-primary-red border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl text-gray-600 font-semibold">Loading customers...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden">
          <div className="p-6 bg-primary-blue border-b-2 border-gray-200">
            <h2 className="text-2xl font-bold text-white">Customer Directory ({customers.length} customers)</h2>
          </div>

          {customers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl text-gray-400">👥</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">No Customers Found</h3>
              <p className="text-gray-600 text-lg">
                {searchTerm ? 'Try adjusting your search terms.' : 'No customers are currently in the system.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                      Company
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      Invoice Email
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Invoice Instructions
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Location
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      Cash
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      LEDs
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Power Supply
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      UL
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Drain Holes
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Plug & Play
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Special Instructions
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Notes
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
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
        </div>
      )}
    </main>
  );
};