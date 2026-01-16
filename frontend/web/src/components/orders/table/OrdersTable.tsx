import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Order, OrderFilters, OrderStatus } from '../../../types/orders';
import { ordersApi, orderStatusApi, timeSchedulesApi } from '../../../services/api';
import { useTasksSocket } from '../../../hooks/useTasksSocket';
import { calculateWorkDaysLeft } from '../calendarView/utils';
import TableHeader from './TableHeader';
import TableRow from './TableRow';
import TableFilters, { DEFAULT_ORDER_STATUSES } from './TableFilters';
import Pagination from './Pagination';
import StatusSelectModal from '../tasksTable/StatusSelectModal';
import { PAGE_STYLES } from '../../../constants/moduleColors';

type SortField = 'order_number' | 'order_name' | 'customer_name' | 'status' | 'due_date' | 'created_at' | 'progress_percent' | 'work_days_left';
type SortDirection = 'asc' | 'desc';

interface OrderWithProgress extends Order {
  progress_percent: number;
  work_days_left: number | null;
}

export const OrdersTable: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Holidays for work days calculation
  const [holidays, setHolidays] = useState<Set<string>>(new Set());

  // Status modal state
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    orderNumber: number;
    orderName: string;
    currentStatus: OrderStatus;
  } | null>(null);

  // Filters
  const [filters, setFilters] = useState<OrderFilters>({
    statuses: [],  // Empty means use defaults (all except completed/cancelled)
    search: ''
  });

  // Sorting - default by days left (most urgent first)
  const [sortField, setSortField] = useState<SortField>('work_days_left');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Fetch holidays on mount (for work days calculation)
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const response = await timeSchedulesApi.getHolidays();
        const holidayDates = new Set<string>(
          (response.data || []).map((h: { holiday_date: string }) =>
            h.holiday_date.split('T')[0]  // Extract YYYY-MM-DD
          )
        );
        setHolidays(holidayDates);
      } catch (err) {
        console.error('Error fetching holidays:', err);
        // Continue without holidays - work days will just exclude weekends
      }
    };
    fetchHolidays();
  }, []);

  // Fetch orders (status filtering is done client-side)
  const fetchOrders = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      // Fetch all orders, filter by status client-side
      const data = await ordersApi.getOrders({ search: filters.search });
      setOrders(data);
      if (!silent) setCurrentPage(1);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      console.error('Error fetching orders:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters.search]);

  // Silent refetch for WebSocket updates
  const refetchSilent = useCallback(() => {
    fetchOrders(true);
  }, [fetchOrders]);

  // Initial fetch and refetch when search changes
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // WebSocket subscription for real-time updates
  useTasksSocket({
    onTasksUpdated: refetchSilent,
    onOrderStatus: refetchSilent,
    onOrderCreated: refetchSilent,
    onOrderUpdated: refetchSilent,
    onOrderDeleted: refetchSilent,
    onInvoiceUpdated: refetchSilent,
    onReconnect: refetchSilent
  });

  // Apply client-side status filtering
  const filteredOrders = useMemo(() => {
    const activeStatuses = filters.statuses.length > 0 ? filters.statuses : DEFAULT_ORDER_STATUSES;
    return orders.filter(order => activeStatuses.includes(order.status));
  }, [orders, filters.statuses]);

  // Enhance orders with progress_percent and work_days_left for sorting
  const ordersWithProgress = useMemo((): OrderWithProgress[] => {
    return filteredOrders.map(order => ({
      ...order,
      progress_percent: order.total_tasks && order.total_tasks > 0
        ? Math.round(((order.completed_tasks || 0) / order.total_tasks) * 100)
        : 0,
      work_days_left: calculateWorkDaysLeft(order.due_date, order.hard_due_date_time, holidays)
    }));
  }, [filteredOrders, holidays]);

  // Sort orders
  const sortedOrders = useMemo(() => {
    const sorted = [...ordersWithProgress].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle work_days_left (null values go to end)
      if (sortField === 'work_days_left') {
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;  // nulls at end
        if (bValue === null) return -1;
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

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
    <div className={`h-full flex flex-col ${PAGE_STYLES.page.background}`}>
      {/* Filters */}
      <div className={`border-b ${PAGE_STYLES.panel.border} px-6 py-4`}>
        <div className="w-fit mx-auto">
          <TableFilters filters={filters} onFiltersChange={setFilters} />
        </div>
      </div>

      {/* Table */}
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
          </div>
        ) : (
          <>
            <div className={`${PAGE_STYLES.composites.panelContainer} overflow-hidden w-fit mx-auto`}>
              <div className="overflow-x-auto">
                <table className={`${PAGE_STYLES.composites.tableBody} table-fixed`}>
                  <TableHeader
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <tbody className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.composites.tableBody}`}>
                    {paginatedOrders.map((order) => (
                      <TableRow
                        key={order.order_id}
                        order={order}
                        onStatusClick={handleStatusClick}
                        holidays={holidays}
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
