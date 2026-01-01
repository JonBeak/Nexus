import React, { useState, useEffect, useCallback } from 'react';
import { invoicesApi, InvoiceFilters, InvoiceListingOrder, InvoiceAnalytics } from '../../services/api/invoicesApi';
import InvoiceAnalyticsCards from './InvoiceAnalyticsCards';
import InvoiceFiltersComponent from './InvoiceFilters';
import InvoiceTable from './InvoiceTable';
import { PAGE_STYLES } from '../../constants/moduleColors';

export const InvoicesOverview: React.FC = () => {
  const [orders, setOrders] = useState<InvoiceListingOrder[]>([]);
  const [analytics, setAnalytics] = useState<InvoiceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [filters, setFilters] = useState<InvoiceFilters>({
    page: 1,
    limit: 50,
    sortBy: 'order_number',
    sortOrder: 'desc'
  });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await invoicesApi.getListing(filters);
      setOrders(response.orders);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (error) {
      console.error('Failed to fetch invoice listing:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await invoicesApi.getAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleFiltersChange = (newFilters: InvoiceFilters) => {
    setFilters(newFilters);
  };

  const handleRefresh = () => {
    fetchOrders();
    fetchAnalytics();
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Analytics Cards */}
      <InvoiceAnalyticsCards analytics={analytics} loading={analyticsLoading} />

      {/* Filters */}
      <InvoiceFiltersComponent filters={filters} onFiltersChange={handleFiltersChange} />

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <InvoiceTable
          orders={orders}
          loading={loading}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onRefresh={handleRefresh}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>
              Showing {((filters.page || 1) - 1) * (filters.limit || 50) + 1} to{' '}
              {Math.min((filters.page || 1) * (filters.limit || 50), total)} of {total} orders
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange((filters.page || 1) - 1)}
                disabled={(filters.page || 1) <= 1}
                className={`px-3 py-1.5 text-sm ${PAGE_STYLES.panel.border} border ${PAGE_STYLES.header.background} rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed ${PAGE_STYLES.panel.text}`}
              >
                Previous
              </button>
              <span className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                Page {filters.page || 1} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange((filters.page || 1) + 1)}
                disabled={(filters.page || 1) >= totalPages}
                className={`px-3 py-1.5 text-sm ${PAGE_STYLES.panel.border} border ${PAGE_STYLES.header.background} rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed ${PAGE_STYLES.panel.text}`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoicesOverview;
