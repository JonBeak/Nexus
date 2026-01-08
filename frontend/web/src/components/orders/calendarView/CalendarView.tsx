/**
 * CalendarView Component
 * Main component for the Calendar View tab - horizontal timeline of orders by due date
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ordersApi, timeSchedulesApi } from '../../../services/api';
import { Order } from '../../../types/orders';
import { CalendarOrder, DateColumn, CALENDAR_DEFAULT_STATUSES } from './types';
import {
  generateDateColumns,
  calculateWorkDaysLeft,
  groupOrdersByDate,
  navigateWeek,
  calculateProgress,
  formatDateKey,
  getEffectiveToday
} from './utils';
import CalendarColumn from './CalendarColumn';
import CalendarNavigation from './CalendarNavigation';
import OrderQuickModal from './OrderQuickModal';
import { PAGE_STYLES } from '../../../constants/moduleColors';

const TOTAL_DAYS_TO_SCAN = 90;
// When overdue column is shown: 8 date columns + overdue = 9 total
// When overdue column is hidden (future view): 9 date columns
const VISIBLE_BUSINESS_DAYS_WITH_OVERDUE = 8;
const VISIBLE_BUSINESS_DAYS_WITHOUT_OVERDUE = 9;

export const CalendarView: React.FC = () => {
  // Data state
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [holidaysLoaded, setHolidaysLoaded] = useState(false);

  // View state
  const [viewStartDate, setViewStartDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  // Filter state
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [selectedOrder, setSelectedOrder] = useState<CalendarOrder | null>(null);

  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track if initial view has been set (to avoid overriding user navigation)
  const initialViewSetRef = useRef(false);

  // Fetch holidays on mount
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const response = await timeSchedulesApi.getHolidays();
        const holidayDates = new Set<string>(
          (response.data || []).map((h: { holiday_date: string }) =>
            h.holiday_date.split('T')[0]
          )
        );
        setHolidays(holidayDates);
        setHolidaysLoaded(true);
      } catch (err) {
        console.error('Error fetching holidays:', err);
        // Continue without holidays
        setHolidaysLoaded(true);
      }
    };
    fetchHolidays();
  }, []);

  // Fetch orders (silent - no loading spinner for smooth UX)
  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const data = await ordersApi.getOrders({ search: searchTerm || undefined });
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      console.error('Error fetching orders:', err);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Filter orders by status
  const filteredOrders = useMemo(() => {
    if (showAllOrders) {
      return orders;
    }
    return orders.filter(order => CALENDAR_DEFAULT_STATUSES.includes(order.status));
  }, [orders, showAllOrders]);

  // Enhance orders with calculated fields
  const ordersWithProgress: CalendarOrder[] = useMemo(() => {
    return filteredOrders.map(order => ({
      ...order,
      work_days_left: calculateWorkDaysLeft(order.due_date, order.hard_due_date_time, holidays),
      progress_percent: calculateProgress(order.total_tasks, order.completed_tasks)
    }));
  }, [filteredOrders, holidays]);

  // Compute "effective today" - shifts to next business day when past work hours (4 PM)
  // This ensures jobs due today appear only in Overdue after business hours
  const effectiveToday = useMemo(() => {
    return getEffectiveToday(holidays);
  }, [holidays]);

  // Sync initial viewStartDate to effectiveToday once holidays are loaded
  useEffect(() => {
    if (!initialViewSetRef.current && holidaysLoaded) {
      initialViewSetRef.current = true;
      const effectiveTodayDate = getEffectiveToday(holidays);
      setViewStartDate(effectiveTodayDate);
    }
  }, [holidays, holidaysLoaded]);

  // Determine if we should show the overdue column
  // Show it when viewStartDate is on or before effective today
  // Hide it when viewStartDate is in the future (past effective today)
  const showOverdueColumn = useMemo(() => {
    const viewStart = new Date(viewStartDate);
    viewStart.setHours(0, 0, 0, 0);
    const effectiveTodayNormalized = new Date(effectiveToday);
    effectiveTodayNormalized.setHours(0, 0, 0, 0);
    return viewStart <= effectiveTodayNormalized;
  }, [viewStartDate, effectiveToday]);

  // Separate overdue orders (work_days_left < 0)
  const overdueOrders = useMemo(() => {
    return ordersWithProgress
      .filter(order => order.work_days_left !== null && order.work_days_left < 0)
      .sort((a, b) => {
        // Most overdue first (most negative number)
        return (a.work_days_left ?? 0) - (b.work_days_left ?? 0);
      });
  }, [ordersWithProgress]);

  // Get future orders (not overdue, has due date)
  // Overdue orders (work_days_left < 0) are excluded - they go to the Overdue column only
  const futureOrders = useMemo(() => {
    const effectiveTodayKey = formatDateKey(effectiveToday);

    return ordersWithProgress.filter(order => {
      // Exclude overdue orders - they belong in the Overdue column only
      if (order.work_days_left !== null && order.work_days_left < 0) return false;
      if (!order.due_date) return false;
      const orderDateKey = order.due_date.split('T')[0];
      // Include if due date is on or after effective today
      return orderDateKey >= effectiveTodayKey;
    });
  }, [ordersWithProgress, effectiveToday]);

  // Group future orders by date
  const ordersByDate = useMemo(() => {
    return groupOrdersByDate(futureOrders);
  }, [futureOrders]);

  // Generate visible date columns
  // Show 7 date columns when overdue is visible, 8 when it's not (to always have 8 total)
  const visibleBusinessDays = showOverdueColumn
    ? VISIBLE_BUSINESS_DAYS_WITH_OVERDUE
    : VISIBLE_BUSINESS_DAYS_WITHOUT_OVERDUE;

  const dateColumns: DateColumn[] = useMemo(() => {
    return generateDateColumns(
      viewStartDate,
      TOTAL_DAYS_TO_SCAN,
      visibleBusinessDays,
      holidays,
      ordersByDate,
      effectiveToday
    );
  }, [viewStartDate, holidays, ordersByDate, visibleBusinessDays, effectiveToday]);

  // Handle navigation
  const handleNavigate = useCallback((direction: 'prev' | 'next' | 'today') => {
    const newDate = navigateWeek(viewStartDate, direction, holidays);
    setViewStartDate(newDate);
  }, [viewStartDate, holidays]);

  // Handle search with debounce
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  // Handle order card click - open modal
  const handleOrderClick = useCallback((order: CalendarOrder) => {
    setSelectedOrder(order);
  }, []);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setSelectedOrder(null);
  }, []);

  // Handle order updated from modal
  const handleOrderUpdated = useCallback(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className={`min-h-full h-full flex flex-col ${PAGE_STYLES.page.background}`}>
      {/* Filters Bar */}
      <div className={`${PAGE_STYLES.panel.background} border-b ${PAGE_STYLES.panel.border} px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={handleSearchChange}
                className={`pl-3 pr-10 py-2 border ${PAGE_STYLES.panel.border} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent w-64`}
              />
            </div>

            {/* Show All Orders Toggle */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAllOrders}
                onChange={(e) => setShowAllOrders(e.target.checked)}
                className={`h-4 w-4 text-orange-500 focus:ring-orange-500 ${PAGE_STYLES.panel.border} rounded`}
              />
              <span className={`text-sm ${PAGE_STYLES.header.text}`}>Show all orders</span>
            </label>

            {/* Order count */}
            <span className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
              {overdueOrders.length} overdue, {futureOrders.length} upcoming
            </span>
          </div>

          {/* Navigation */}
          <CalendarNavigation
            viewStartDate={viewStartDate}
            onNavigate={handleNavigate}
          />
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={`flex-1 overflow-hidden px-6 py-4 ${PAGE_STYLES.page.background}`}>
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchOrders}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className={`${PAGE_STYLES.panel.background} rounded-lg border ${PAGE_STYLES.panel.border} h-full overflow-hidden`}>
            <div
              ref={scrollContainerRef}
              className="flex h-full"
            >
              {/* OVERDUE Column - Only shown when viewing current/past dates */}
              {showOverdueColumn && (
                <div
                  className="bg-red-50 border-r-2 border-red-300 flex-shrink-0"
                  style={{ width: 'calc(100% / 9)' }}
                >
                  <CalendarColumn
                    headerLabel="OVERDUE"
                    orders={overdueOrders}
                    isOverdue={true}
                    showDaysLate={true}
                    onCardClick={handleOrderClick}
                  />
                </div>
              )}

              {/* Date Columns - each takes equal width to fill the page */}
              {dateColumns.map(column => (
                <div
                  key={column.dateKey}
                  className={`border-r ${PAGE_STYLES.panel.border} flex-shrink-0 last:border-r-0`}
                  style={{ width: 'calc(100% / 9)' }}
                >
                  <CalendarColumn
                    headerLabel={column.displayLabel}
                    subLabel={column.dayOfWeek}
                    isToday={column.isToday}
                    orders={column.orders}
                    onCardClick={handleOrderClick}
                  />
                </div>
              ))}

              {/* Empty state if no columns */}
              {dateColumns.length === 0 && !showOverdueColumn && (
                <div className={`flex-1 flex items-center justify-center ${PAGE_STYLES.panel.textMuted}`}>
                  No upcoming dates with orders
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Order Quick Action Modal */}
      {selectedOrder && (
        <OrderQuickModal
          isOpen={!!selectedOrder}
          order={selectedOrder}
          onClose={handleModalClose}
          onOrderUpdated={handleOrderUpdated}
        />
      )}
    </div>
  );
};

export default CalendarView;
