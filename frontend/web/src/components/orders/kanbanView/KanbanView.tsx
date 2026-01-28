/**
 * KanbanView - Main Kanban board component
 * Displays orders as cards in status columns with drag-and-drop
 *
 * Performance optimized: 2025-01-28
 * - Uses optimized /orders/kanban endpoint (backend does grouping/sorting)
 * - Components wrapped with React.memo
 * - Handlers memoized with useCallback
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { ordersApi, orderStatusApi } from '../../../services/api';
import { OrderStatus, KanbanOrder } from '../../../types/orders';
import { useTasksSocket } from '../../../hooks/useTasksSocket';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { OrderQuickModal } from '../calendarView/OrderQuickModal';
import { CalendarOrder } from '../calendarView/types';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { MobileScrollbar } from './MobileScrollbar';
import {
  KANBAN_STATUS_ORDER,
  KANBAN_HIDDEN_STATUSES,
  KANBAN_STACKED_GROUPS,
  KANBAN_COLLAPSED_BY_DEFAULT,
  PAINTING_COLUMN_ID,
  PAINTING_COLUMN_COLORS
} from './types';

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

// Memoize column layout since it's static
const COLUMN_LAYOUT = organizeColumnLayout();

export const KanbanView: React.FC = () => {
  // State - optimized data structure from backend
  const [ordersByStatus, setOrdersByStatus] = useState<Record<OrderStatus, KanbanOrder[]>>({} as Record<OrderStatus, KanbanOrder[]>);
  const [paintingOrders, setPaintingOrders] = useState<KanbanOrder[]>([]);
  const [totalCounts, setTotalCounts] = useState<{ completed: number; cancelled: number }>({ completed: 0, cancelled: 0 });
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CalendarOrder | null>(null);
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

  // Check awaiting payment orders on mount - auto-complete if fully paid
  useEffect(() => {
    ordersApi.checkAwaitingPayments().catch(error => {
      console.error('Error checking awaiting payment orders:', error);
    });
  }, []);

  // Fetch orders using optimized Kanban endpoint
  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const data = await ordersApi.getKanbanOrders({
        showAllCompleted: showAllColumns.has('completed'),
        showAllCancelled: showAllColumns.has('cancelled')
      });

      setOrdersByStatus(data.columns);
      setPaintingOrders(data.painting);
      setTotalCounts(data.totalCounts);
    } catch (err) {
      console.error('Error fetching Kanban orders:', err);
      setError('Failed to load orders');
    }
  }, [showAllColumns]);

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

  // Memoized toggle handlers to prevent child re-renders
  const handleToggleShowAll = useCallback((status: OrderStatus) => {
    setShowAllColumns(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const handleToggleCollapsed = useCallback((status: OrderStatus) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  // Toggle expanded cards (called from progress bar click)
  const handleToggleExpanded = useCallback(() => {
    setExpandedCards(prev => !prev);
  }, []);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Handle card click - memoized
  const handleCardClick = useCallback((order: KanbanOrder) => {
    // Convert to CalendarOrder format for the modal
    const calendarOrder: CalendarOrder = {
      ...order,
      work_days_left: order.work_days_left,
      progress_percent: order.progress_percent
    };
    setSelectedOrder(calendarOrder);
  }, []);

  // Close modal handler - memoized
  const handleCloseModal = useCallback(() => {
    setSelectedOrder(null);
  }, []);

  // Handle drag end - needs access to current orders state
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Ignore drops onto the Painting column (it's a read-only view)
    if (over.id === PAINTING_COLUMN_ID) return;

    const orderIdStr = active.id as string;
    const newStatus = over.id as OrderStatus;

    // Find the order across all columns
    let order: KanbanOrder | undefined;
    for (const status of KANBAN_STATUS_ORDER) {
      order = ordersByStatus[status]?.find(o => `order-${o.order_id}` === orderIdStr);
      if (order) break;
    }

    if (!order || order.status === newStatus) return;

    // Optimistic update - move order between columns
    setOrdersByStatus(prev => {
      const updated = { ...prev };
      // Remove from old column
      updated[order!.status] = (prev[order!.status] || []).filter(o => o.order_id !== order!.order_id);
      // Add to new column
      const updatedOrder = { ...order!, status: newStatus };
      updated[newStatus] = [...(prev[newStatus] || []), updatedOrder];
      return updated;
    });

    try {
      await orderStatusApi.updateOrderStatus(order.order_number, newStatus);
      // Refetch to get proper sorting
      fetchOrders();
    } catch (err) {
      console.error('Error updating order status:', err);
      // Revert on error - refetch from server
      fetchOrders();
    }
  }, [ordersByStatus, fetchOrders]);

  // Get active order for drag overlay - search all columns
  const activeOrder = useMemo(() => {
    if (!activeId) return null;
    for (const status of KANBAN_STATUS_ORDER) {
      const order = ordersByStatus[status]?.find(o => `order-${o.order_id}` === activeId);
      if (order) return order;
    }
    return null;
  }, [activeId, ordersByStatus]);

  // Memoize getTotalCount function per status
  const getTotalCount = useCallback((status: OrderStatus): number => {
    if (status === 'completed') return totalCounts.completed;
    if (status === 'cancelled') return totalCounts.cancelled;
    return ordersByStatus[status]?.length || 0;
  }, [ordersByStatus, totalCounts]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

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
            {COLUMN_LAYOUT.map((group, groupIdx) => {
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
          onClose={handleCloseModal}
          onOrderUpdated={fetchOrders}
        />
      )}
    </div>
  );
};

export default KanbanView;
