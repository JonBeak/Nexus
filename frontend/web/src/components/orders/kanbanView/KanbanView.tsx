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
import { useDeviceType } from '../../../hooks/useDeviceType';
import { OrderQuickModal } from '../calendarView/OrderQuickModal';
import { CalendarOrder } from '../calendarView/types';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { KanbanDivider } from './KanbanDivider';
import { MobileScrollbar } from './MobileScrollbar';
import {
  KANBAN_STATUS_ORDER,
  KANBAN_HIDDEN_STATUSES,
  KANBAN_STACKED_GROUPS,
  KANBAN_COLLAPSED_BY_DEFAULT,
  KANBAN_DIVIDERS,
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
  // Track just-dropped order to scroll into view after refetch
  const [justDroppedOrderId, setJustDroppedOrderId] = useState<number | null>(null);

  // Device type detection and scroll container ref
  const { isPhone, isTablet, isTouchDevice, deviceType } = useDeviceType();
  const scrollContainerRef = useRef<HTMLDivElement>(null);


  // Touch scroll management
  // - Tablet (iPad): Allow all native scrolling, only block during active drag
  // - Phone: Block background scroll, use MobileScrollbar for horizontal
  // - Desktop: Native scroll, no intervention
  useEffect(() => {
    if (!isTouchDevice) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleTouchScroll = (e: TouchEvent) => {
      // During active drag: block all touch movement to prevent scroll interference
      if (activeId) {
        e.preventDefault();
        return;
      }

      // Tablet (iPad): Allow ALL native scrolling (horizontal + vertical, anywhere)
      // The 150ms drag delay handles distinguishing scroll from drag intent
      if (isTablet) {
        return; // Don't block anything
      }

      // Phone: Allow vertical scroll in card lists, block horizontal (use MobileScrollbar)
      if (isPhone) {
        const target = e.target as HTMLElement;
        const isInScrollArea = target.closest('[data-kanban-scroll]');
        if (isInScrollArea) {
          return; // Allow vertical scroll in card lists
        }
        e.preventDefault(); // Block horizontal scroll (MobileScrollbar handles it)
      }
    };

    container.addEventListener('touchmove', handleTouchScroll, { passive: false });
    return () => {
      container.removeEventListener('touchmove', handleTouchScroll);
    };
  }, [isTouchDevice, isPhone, isTablet, activeId]);

  // DnD sensors - PointerSensor works for both mouse and touch (Pointer Events API)
  // Touch devices: delay-based activation (hold to drag, immediate scroll)
  // Desktop: distance-based activation (8px movement to start drag)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isTouchDevice
        ? {
            // Touch: 150ms hold before drag activates
            // This gives users time to start scrolling before drag kicks in
            delay: 150,
            tolerance: 5 // Small movement allowed during hold
          }
        : {
            // Mouse/trackpad: 8px movement threshold
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

  // Scroll to just-dropped card after data refreshes
  useEffect(() => {
    if (justDroppedOrderId !== null) {
      const timer = setTimeout(() => {
        const cardElement = document.querySelector(`[data-order-id="${justDroppedOrderId}"]`);
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        setJustDroppedOrderId(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [ordersByStatus, justDroppedOrderId]);

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
      // Track dropped order for scroll-into-view after refetch
      setJustDroppedOrderId(order.order_id);
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
          isPhone
            ? 'overflow-x-scroll scrollbar-none'  // Phone: Hide native scrollbar, use MobileScrollbar
            : 'overflow-x-auto'  // Tablet/Desktop: Native scroll with momentum
        }`}
        style={isPhone ? {
          scrollbarWidth: 'none',  // Firefox
          msOverflowStyle: 'none'  // IE/Edge
        } as React.CSSProperties : isTablet ? {
          WebkitOverflowScrolling: 'touch',  // iOS momentum scrolling
          touchAction: 'pan-x pan-y'  // Allow both horizontal and vertical touch scroll
        } as React.CSSProperties : undefined}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full min-w-max">
            {/* Leading divider for first section */}
            <KanbanDivider label="Setup & Approval" isMobile={isPhone} />
            {COLUMN_LAYOUT.map((group, groupIdx) => {
              // Check if a divider should follow this group
              const divider = KANBAN_DIVIDERS.find(d =>
                d.afterStackedGroup
                  ? group.includes(d.afterStatus)
                  : group.length === 1 && group[0] === d.afterStatus
              );

              // Wrapper for desktop top margin (aligns columns below divider labels)
              const columnTopClass = isPhone ? 'h-full' : 'mt-5 h-[calc(100%-1.25rem)]';

              // Single column
              if (group.length === 1) {
                const status = group[0];
                const isCollapsible = KANBAN_COLLAPSED_BY_DEFAULT.includes(status);
                const elements: React.ReactNode[] = [
                  <div key={status} className={columnTopClass}>
                    <KanbanColumn
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
                      isTablet={isTablet}
                    />
                  </div>
                ];

                // Insert Painting column after 'in_production' if there are painting orders
                if (status === 'in_production' && paintingOrders.length > 0) {
                  elements.push(
                    <div key={PAINTING_COLUMN_ID} className={columnTopClass}>
                      <KanbanColumn
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
                        isTablet={isTablet}
                      />
                    </div>
                  );
                }

                // Add divider after this column if configured
                if (divider) {
                  elements.push(<KanbanDivider key={`divider-${divider.label}`} label={divider.label} isMobile={isPhone} />);
                }

                return elements;
              }

              // Stacked columns
              const stackedElements: React.ReactNode[] = [
                <div key={`group-${groupIdx}`} className={`flex flex-col gap-4 ${columnTopClass}`}>
                  {group.map(status => {
                    const isCollapsible = KANBAN_COLLAPSED_BY_DEFAULT.includes(status);
                    return (
                      <div key={status} className="flex-1 min-h-0">
                        <KanbanColumn
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
                          isTablet={isTablet}
                        />
                      </div>
                    );
                  })}
                </div>
              ];

              // Add divider after stacked group if configured
              if (divider) {
                stackedElements.push(<KanbanDivider key={`divider-${divider.label}`} label={divider.label} isMobile={isPhone} />);
              }

              return stackedElements;
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

      {/* Phone Custom Scrollbar - tablets use native scroll */}
      {isPhone && <MobileScrollbar scrollContainerRef={scrollContainerRef} />}

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
