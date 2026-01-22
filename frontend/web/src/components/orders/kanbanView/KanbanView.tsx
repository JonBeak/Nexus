/**
 * KanbanView - Main Kanban board component
 * Displays orders as cards in status columns with drag-and-drop
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { ordersApi, orderStatusApi, timeSchedulesApi } from '../../../services/api';
import { Order, OrderStatus } from '../../../types/orders';
import { useTasksSocket } from '../../../hooks/useTasksSocket';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { OrderQuickModal } from '../calendarView/OrderQuickModal';
import { CalendarOrder } from '../calendarView/types';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { MobileScrollbar } from './MobileScrollbar';
import {
  KanbanOrder,
  KANBAN_STATUS_ORDER,
  KANBAN_HIDDEN_STATUSES,
  KANBAN_STACKED_GROUPS,
  KANBAN_COLLAPSED_BY_DEFAULT,
  PAINTING_COLUMN_ID,
  PAINTING_ELIGIBLE_STATUSES,
  PAINTING_COLUMN_COLORS
} from './types';
import { PAGE_STYLES } from '../../../constants/moduleColors';

/**
 * Calculate work days between two dates (excludes weekends and holidays)
 * Returns positive for future dates, negative for past dates
 */
const calculateWorkDaysBetween = (fromDate: Date, toDate: Date, holidays: Set<string>): number => {
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);
  const to = new Date(toDate);
  to.setHours(0, 0, 0, 0);

  // Same day = 0
  if (from.getTime() === to.getTime()) return 0;

  const isPast = to < from;
  const start = isPast ? to : from;
  const end = isPast ? from : to;

  let count = 0;
  const current = new Date(start);
  current.setDate(current.getDate() + 1); // Start counting from next day

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return isPast ? -count : count;
};

/**
 * Transform Order to KanbanOrder with calculated fields
 */
const transformToKanbanOrder = (order: Order, holidays: Set<string>): KanbanOrder => {
  // Calculate work days left using simple day-based calculation
  let workDaysLeft: number | null = null;
  if (order.due_date) {
    const today = new Date();
    const dateOnly = order.due_date.split('T')[0];
    const dueDate = new Date(dateOnly + 'T00:00:00');
    workDaysLeft = calculateWorkDaysBetween(today, dueDate, holidays);
  }

  // Calculate progress
  const totalTasks = order.total_tasks || 0;
  const completedTasks = order.completed_tasks || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    ...order,
    work_days_left: workDaysLeft,
    progress_percent: progressPercent
  };
};

/**
 * Organize statuses into layout groups (stacked or single columns)
 * Returns array of status arrays - single status = single column, multiple = stacked
 */
const organizeColumnLayout = (): OrderStatus[][] => {
  const layout: OrderStatus[][] = [];
  const stackedStatuses = new Set<OrderStatus>();

  // Add stacked groups
  KANBAN_STACKED_GROUPS.forEach(group => {
    layout.push(group);
    group.forEach(status => stackedStatuses.add(status));
  });

  // Add remaining single columns
  KANBAN_STATUS_ORDER.forEach(status => {
    if (!stackedStatuses.has(status)) {
      layout.push([status]);
    }
  });

  return layout;
};

export const KanbanView: React.FC = () => {
  // State
  const [orders, setOrders] = useState<KanbanOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CalendarOrder | null>(null);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  // Track which columns are showing all (for completed/cancelled)
  const [showAllColumns, setShowAllColumns] = useState<Set<OrderStatus>>(new Set());
  // Track which columns are collapsed (cards hidden)
  const [collapsedColumns, setCollapsedColumns] = useState<Set<OrderStatus>>(
    () => new Set(KANBAN_COLLAPSED_BY_DEFAULT)
  );

  // Mobile detection and scroll container ref
  const isMobile = useIsMobile();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Prevent touch scrolling on mobile - only allow scroll via custom scrollbar
  // Also prevent page scroll while dragging a card
  useEffect(() => {
    if (!isMobile) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const preventTouchScroll = (e: TouchEvent) => {
      // Allow vertical scroll within column card lists (not during drag)
      const target = e.target as HTMLElement;
      const isInScrollArea = target.closest('[data-kanban-scroll]');
      if (isInScrollArea && !activeId) return; // Allow vertical scroll in card lists

      // Prevent scroll on background/headers and during drag
      e.preventDefault();
    };

    container.addEventListener('touchmove', preventTouchScroll, { passive: false });
    return () => {
      container.removeEventListener('touchmove', preventTouchScroll);
    };
  }, [isMobile, activeId]);

  // DnD sensors - different constraints for mobile vs desktop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile
        ? {
            // Mobile: require 80ms hold before drag activates
            delay: 80,
            tolerance: 5
          }
        : {
            // Desktop: 8px movement threshold
            distance: 8
          }
    })
  );

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
      } catch (err) {
        console.error('Error fetching holidays:', err);
        // Continue without holidays
      }
    };
    fetchHolidays();
  }, []);

  // Check awaiting payment orders on mount - auto-complete if fully paid
  useEffect(() => {
    ordersApi.checkAwaitingPayments().catch(error => {
      console.error('Error checking awaiting payment orders:', error);
    });
  }, []);

  // Fetch orders (silent - no loading spinner for smooth UX)
  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      // Fetch all orders - API returns array directly
      const fetchedOrders = await ordersApi.getOrders();
      const kanbanOrders = (fetchedOrders || []).map(order => transformToKanbanOrder(order, holidays));
      setOrders(kanbanOrders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders');
    }
  }, [holidays]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // WebSocket subscription for real-time updates
  useTasksSocket({
    onTasksUpdated: fetchOrders,
    onOrderStatus: fetchOrders,
    onOrderCreated: fetchOrders,
    onOrderUpdated: fetchOrders,
    onOrderDeleted: fetchOrders,
    onInvoiceUpdated: fetchOrders,
    onReconnect: fetchOrders
  });

  // Filter orders for completed/cancelled columns (due in last 2 weeks by default)
  const filterHiddenStatusOrders = (statusOrders: KanbanOrder[], status: OrderStatus): KanbanOrder[] => {
    if (!KANBAN_HIDDEN_STATUSES.includes(status)) return statusOrders;
    if (showAllColumns.has(status)) return statusOrders;

    // Filter to orders due in the last 2 weeks
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    twoWeeksAgo.setHours(0, 0, 0, 0);

    return statusOrders.filter(order => {
      if (!order.due_date) return true; // Show orders without due date
      const dateOnly = order.due_date.split('T')[0];
      const dueDate = new Date(dateOnly + 'T00:00:00');
      return dueDate >= twoWeeksAgo;
    });
  };

  // Group orders by status, sorted by due date (earliest first)
  const ordersByStatus = KANBAN_STATUS_ORDER.reduce((acc, status) => {
    const statusOrders = orders.filter(o => o.status === status);
    const filteredOrders = filterHiddenStatusOrders(statusOrders, status);
    // Sort by due date (earliest first), orders without due date go to end
    acc[status] = filteredOrders.sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
    return acc;
  }, {} as Record<OrderStatus, KanbanOrder[]>);

  // Filter orders for Painting column - orders with incomplete painting tasks
  // Only includes orders in eligible statuses (active production stages)
  const paintingOrders = orders
    .filter(o =>
      PAINTING_ELIGIBLE_STATUSES.includes(o.status) &&
      (o.incomplete_painting_tasks_count || 0) > 0
    )
    .sort((a, b) => {
      // Sort by due date (earliest first), orders without due date go to end
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

  // Get total count for completed/cancelled (for "show all" button)
  const getTotalCount = (status: OrderStatus): number => {
    return orders.filter(o => o.status === status).length;
  };

  // Toggle show all for a column
  const handleToggleShowAll = (status: OrderStatus) => {
    setShowAllColumns(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  // Toggle collapsed state for a column
  const handleToggleCollapsed = (status: OrderStatus) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  // Toggle expanded cards (called from progress bar click)
  const handleToggleExpanded = () => {
    setExpandedCards(prev => !prev);
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Ignore drops onto the Painting column (it's a read-only view)
    if (over.id === PAINTING_COLUMN_ID) return;

    const orderId = active.id as string;
    const newStatus = over.id as OrderStatus;

    // Find the order
    const order = orders.find(o => `order-${o.order_id}` === orderId);
    if (!order || order.status === newStatus) return;

    // Optimistic update
    setOrders(prev => prev.map(o =>
      o.order_id === order.order_id ? { ...o, status: newStatus } : o
    ));

    try {
      await orderStatusApi.updateOrderStatus(order.order_number, newStatus);
    } catch (err) {
      console.error('Error updating order status:', err);
      // Revert on error
      setOrders(prev => prev.map(o =>
        o.order_id === order.order_id ? { ...o, status: order.status } : o
      ));
    }
  };

  // Handle card click
  const handleCardClick = (order: KanbanOrder) => {
    // Convert to CalendarOrder format for the modal
    const calendarOrder: CalendarOrder = {
      ...order,
      work_days_left: order.work_days_left,
      progress_percent: order.progress_percent
    };
    setSelectedOrder(calendarOrder);
  };

  // Get active order for drag overlay
  const activeOrder = activeId
    ? orders.find(o => `order-${o.order_id}` === activeId)
    : null;

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const columnLayout = organizeColumnLayout();

  return (
    <div className="h-full flex flex-col">
      {/* Kanban Board - No toolbar */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-hidden p-4 ${
          isMobile
            ? 'overflow-x-scroll scrollbar-none'  // Hide native scrollbar, JS handler controls touch
            : 'overflow-x-auto'
        }`}
        style={isMobile ? {
          scrollbarWidth: 'none',  // Firefox
          msOverflowStyle: 'none'  // IE/Edge
        } as React.CSSProperties : undefined}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full min-w-max">
            {columnLayout.map((group, groupIdx) => {
              // Single column
              if (group.length === 1) {
                const status = group[0];
                const isCollapsible = KANBAN_COLLAPSED_BY_DEFAULT.includes(status);
                const elements = [
                  <KanbanColumn
                    key={status}
                    status={status}
                    orders={ordersByStatus[status] || []}
                    onCardClick={handleCardClick}
                    onOrderUpdated={fetchOrders}
                    expanded={expandedCards}
                    onToggleExpanded={handleToggleExpanded}
                    isHiddenStatus={KANBAN_HIDDEN_STATUSES.includes(status)}
                    showingAll={showAllColumns.has(status)}
                    totalCount={getTotalCount(status)}
                    onToggleShowAll={() => handleToggleShowAll(status)}
                    isCollapsible={isCollapsible}
                    isCollapsed={collapsedColumns.has(status)}
                    onToggleCollapsed={() => handleToggleCollapsed(status)}
                  />
                ];

                // Insert Painting column after 'in_production' if there are painting orders
                if (status === 'in_production' && paintingOrders.length > 0) {
                  elements.push(
                    <KanbanColumn
                      key={PAINTING_COLUMN_ID}
                      status={'in_production' as OrderStatus}
                      columnId={PAINTING_COLUMN_ID}
                      columnLabel="Painting"
                      columnColors={PAINTING_COLUMN_COLORS}
                      orders={paintingOrders}
                      onCardClick={handleCardClick}
                      onOrderUpdated={fetchOrders}
                      expanded={expandedCards}
                      onToggleExpanded={handleToggleExpanded}
                      disableDrop={true}
                      cardsDisableDrag={true}
                      cardsShowPaintingBadge={true}
                    />
                  );
                }

                return elements;
              }

              // Stacked columns
              return (
                <div key={`group-${groupIdx}`} className="flex flex-col gap-4 h-full">
                  {group.map(status => {
                    const isCollapsible = KANBAN_COLLAPSED_BY_DEFAULT.includes(status);
                    return (
                      <div key={status} className="flex-1 min-h-0">
                        <KanbanColumn
                          key={status}
                          status={status}
                          orders={ordersByStatus[status] || []}
                          onCardClick={handleCardClick}
                          onOrderUpdated={fetchOrders}
                          expanded={expandedCards}
                          onToggleExpanded={handleToggleExpanded}
                          isHiddenStatus={KANBAN_HIDDEN_STATUSES.includes(status)}
                          showingAll={showAllColumns.has(status)}
                          totalCount={getTotalCount(status)}
                          onToggleShowAll={() => handleToggleShowAll(status)}
                          isCollapsible={isCollapsible}
                          isCollapsed={collapsedColumns.has(status)}
                          onToggleCollapsed={() => handleToggleCollapsed(status)}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeOrder && (
              <KanbanCard
                order={activeOrder}
                onClick={() => {}}
                onOrderUpdated={() => {}}
                onToggleExpanded={() => {}}
                isDragOverlay
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Mobile Custom Scrollbar */}
      {isMobile && <MobileScrollbar scrollContainerRef={scrollContainerRef} />}

      {/* Order Quick Modal */}
      {selectedOrder && (
        <OrderQuickModal
          isOpen={!!selectedOrder}
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={fetchOrders}
        />
      )}
    </div>
  );
};

export default KanbanView;
