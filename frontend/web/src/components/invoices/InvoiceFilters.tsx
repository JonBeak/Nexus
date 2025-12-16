import React from 'react';
import { Search, X } from 'lucide-react';
import { InvoiceFilters as IInvoiceFilters } from '../../services/api/invoicesApi';

interface Props {
  filters: IInvoiceFilters;
  onFiltersChange: (filters: IInvoiceFilters) => void;
}

export const InvoiceFilters: React.FC<Props> = ({ filters, onFiltersChange }) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value, page: 1 });
  };

  const handleFilterChange = (key: keyof IInvoiceFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value, page: 1 });
  };

  const clearFilters = () => {
    onFiltersChange({
      page: 1,
      limit: 50,
      sortBy: 'order_number',
      sortOrder: 'desc'
    });
  };

  const hasActiveFilters = filters.search ||
    (filters.invoiceStatus && filters.invoiceStatus !== 'all') ||
    (filters.balanceStatus && filters.balanceStatus !== 'all') ||
    (filters.sentStatus && filters.sentStatus !== 'all') ||
    (filters.depositStatus && filters.depositStatus !== 'all');

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={filters.search || ''}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Invoice Status */}
        <select
          value={filters.invoiceStatus || 'all'}
          onChange={(e) => handleFilterChange('invoiceStatus', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="all">All Invoice Status</option>
          <option value="invoiced">Invoiced</option>
          <option value="not_invoiced">Not Invoiced</option>
        </select>

        {/* Balance Status */}
        <select
          value={filters.balanceStatus || 'all'}
          onChange={(e) => handleFilterChange('balanceStatus', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="all">All Balance Status</option>
          <option value="open">Open Balance</option>
          <option value="paid">Paid</option>
        </select>

        {/* Sent Status */}
        <select
          value={filters.sentStatus || 'all'}
          onChange={(e) => handleFilterChange('sentStatus', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="all">All Sent Status</option>
          <option value="sent">Sent</option>
          <option value="not_sent">Not Sent</option>
        </select>

        {/* Deposit Status */}
        <select
          value={filters.depositStatus || 'all'}
          onChange={(e) => handleFilterChange('depositStatus', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="all">All Deposit Status</option>
          <option value="required">Deposit Required</option>
          <option value="paid">Deposit Paid</option>
          <option value="not_required">No Deposit</option>
        </select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default InvoiceFilters;
