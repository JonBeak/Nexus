import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderFilters, OrderStatus } from '../../../types/orders';
import { ordersApi, orderStatusApi } from '../../../services/api';
import TableHeader from './TableHeader';
import TableRow from './TableRow';
import TableFilters from './TableFilters';
import Pagination from './Pagination';
import StatusSelectModal from '../tasksTable/StatusSelectModal';

type SortField = 'order_number' | 'order_name' | 'customer_name' | 'status' | 'due_date' | 'created_at' | 'progress_percent';
type SortDirection = 'asc' | 'desc';

interface OrderWithProgress extends Order {
  progress_percent: number;
}

export const OrdersTable: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status modal state
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    orderNumber: number;
    orderName: string;
    currentStatus: OrderStatus;
  } | null>(null);

  // Filters
  const [filters, setFilters] = useState<OrderFilters>({
    status: 'all',
    search: ''
  });

  // Sorting
  const [sortField, setSortField] = useState<SortField>('order_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

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
      setCurrentPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Enhance orders with progress_percent for sorting
  const ordersWithProgress = useMemo((): OrderWithProgress[] => {
    return orders.map(order => ({
      ...order,
      progress_percent: order.total_tasks && order.total_tasks > 0
        ? Math.round(((order.completed_tasks || 0) / order.total_tasks) * 100)
        : 0
    }));
  }, [orders]);

  // Sort orders
  const sortedOrders = useMemo(() => {
    const sorted = [...ordersWithProgress].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle dates
      if (sortField === 'due_date' || sortField === 'created_at') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle strings
      const aStr = String(aValue || '').toLowerCase();
      const bStr = String(bValue || '').toLowerCase();

      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

    return sorted;
  }, [ordersWithProgress, sortField, sortDirection]);

  // Paginate orders
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedOrders, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle status click - open modal
  const handleStatusClick = (orderNumber: number, orderName: string, currentStatus: OrderStatus) => {
    setStatusModal({
      isOpen: true,
      orderNumber,
      orderName,
      currentStatus
    });
  };

  // Handle status change from modal
  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!statusModal) return;

    try {
      // Optimistic update
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.order_number === statusModal.orderNumber
            ? { ...order, status: newStatus }
            : order
        )
      );

      // Close modal
      setStatusModal(null);

      // Call API
      await orderStatusApi.updateOrderStatus(statusModal.orderNumber, newStatus);

      // Refetch to ensure consistency
      fetchOrders();
    } catch (err) {
      console.error('Error updating status:', err);
      // Revert on error
      fetchOrders();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <TableFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Table */}
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
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <TableHeader
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedOrders.map((order) => (
                      <TableRow
                        key={order.order_id}
                        order={order}
                        onStatusClick={handleStatusClick}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedOrders.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* Status Select Modal */}
      {statusModal && (
        <StatusSelectModal
          isOpen={statusModal.isOpen}
          currentStatus={statusModal.currentStatus}
          orderNumber={statusModal.orderNumber}
          orderName={statusModal.orderName}
          onSelect={handleStatusChange}
          onClose={() => setStatusModal(null)}
        />
      )}
    </div>
  );
};

export default OrdersTable;
