import React, { useState, useEffect } from 'react';
import { Order, OrderFilters, OrderStatus } from '../../../types/orders';
import { ordersApi } from '../../../services/api';
import OrderList from './OrderList';
import StatusFilter from './StatusFilter';
import SearchBar from './SearchBar';
import OrderStats from './OrderStats';

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
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
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
    <div className="h-full flex flex-col bg-gray-50">
      {/* Filters & Search */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
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
            <div className="text-gray-500">Loading orders...</div>
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
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No orders found</p>
            {filters.status !== 'all' || filters.search ? (
              <button
                onClick={() => setFilters({ status: 'all', search: '' })}
                className="mt-4 text-sm text-indigo-600 hover:text-indigo-800"
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
