import React, { useState, useEffect } from 'react';
import { Order, OrderFilters, OrderStatus } from '../../../types/orders';
import { ordersApi } from '../../../services/api';
import OrderList from './OrderList';
import StatusFilter from './StatusFilter';
import SearchBar from './SearchBar';
import OrderStats from './OrderStats';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

export const OrderDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({
    status: 'all',
    search: ''
  });

  // Fetch orders
  useEffect(() => {
    fetchOrders();
  }, [filters]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ordersApi.getOrders(filters);
      // Ensure data is an array
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      setOrders([]); // Reset to empty array on error
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (status: OrderStatus | 'all') => {
    setFilters(prev => ({ ...prev, status }));
  };

  const handleSearchChange = (search: string) => {
    setFilters(prev => ({ ...prev, search }));
  };

  const handleOrderUpdated = () => {
    fetchOrders();
  };

  return (
    <div className={`h-full flex flex-col ${PAGE_STYLES.page.background}`}>
      {/* Filters & Search */}
      <div className={`${PAGE_STYLES.panel.background} border-b ${PAGE_STYLES.panel.border} px-6 py-4`}>
        <div className="flex items-center justify-between space-x-4">
          <StatusFilter
            selectedStatus={filters.status || 'all'}
            onStatusChange={handleStatusChange}
          />
          <SearchBar
            value={filters.search || ''}
            onChange={handleSearchChange}
            placeholder="Search by order number, name, or customer..."
          />
        </div>
      </div>

      {/* Stats */}
      <OrderStats orders={orders} />

      {/* Order List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className={PAGE_STYLES.page.text}>Loading orders...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchOrders}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className={`${PAGE_STYLES.composites.panelContainer} p-8 text-center`}>
            <p className={PAGE_STYLES.panel.textMuted}>No orders found</p>
            {filters.status !== 'all' || filters.search ? (
              <button
                onClick={() => setFilters({ status: 'all', search: '' })}
                className={`mt-4 text-sm ${MODULE_COLORS.orders.text} hover:text-orange-600`}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <OrderList orders={orders} onOrderUpdated={handleOrderUpdated} />
        )}
      </div>
    </div>
  );
};

export default OrderDashboard;
