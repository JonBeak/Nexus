/**
 * KanbanColumn - A single status column in the Kanban board
 * Uses useDroppable from dnd-kit for drag-and-drop support
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ORDER_STATUS_LABELS } from '../../../types/orders';
import { KanbanCard } from './KanbanCard';
import { KanbanColumnProps, KANBAN_COLUMN_COLORS, areKanbanOrdersEqual } from './types';
import { PAGE_STYLES } from '../../../constants/moduleColors';

const KanbanColumnComponent: React.FC<KanbanColumnProps> = ({
  status,
  orders,
  onCardClick,
  onOrderUpdated,
  expanded = false,
  onToggleExpanded,
  isHiddenStatus = false,
  showingAll = false,
  totalCount = 0,
  onToggleShowAll,
  isCollapsible = false,
  isCollapsed = false,
  onToggleCollapsed,
  // Custom column support
  columnId,
  columnLabel,
  columnColors,
  disableDrop = false,
  cardsDisableDrag = false,
  cardsShowPaintingBadge = false,
  // Touch device support
  isTablet = false
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: columnId || status,
    disabled: disableDrop
  });

  const colors = columnColors || KANBAN_COLUMN_COLORS[status];
  const label = columnLabel || ORDER_STATUS_LABELS[status];

  // Shipping and Pick Up columns are wider to accommodate extra padding
  const isWideColumn = status === 'shipping' || status === 'pick_up';

  return (
    <div
      ref={setNodeRef}
      className={`
        ${isWideColumn ? 'w-80' : 'w-72'} h-full flex-shrink-0 flex flex-col rounded-lg border overflow-hidden
        ${colors.background || PAGE_STYLES.panel.background}
        ${isOver ? 'ring-2 ring-orange-400' : ''}
        ${colors.border}
      `}
    >
      {/* Column Header */}
      <div className={`px-3 py-2 rounded-t-lg ${colors.header} border-b ${colors.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm text-gray-800">
              {label}
            </h3>
            {/* Collapse toggle for collapsible columns */}
            {isCollapsible && onToggleCollapsed && (
              <button
                onClick={onToggleCollapsed}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                title={isCollapsed ? 'Show cards' : 'Hide cards'}
              >
                {isCollapsed ? `[Show ${totalCount}]` : '[Hide]'}
              </button>
            )}
          </div>
          {/* Current filter state for completed/cancelled - show when expanded */}
          {isHiddenStatus && !isCollapsed && onToggleShowAll && (
            <button
              onClick={onToggleShowAll}
              className="text-xs text-gray-600 hover:text-gray-900 hover:underline transition-colors"
            >
              {showingAll ? `All (${totalCount})` : 'Recent'}
            </button>
          )}
        </div>
      </div>

      {/* Cards Container - hidden when collapsed */}
      {!isCollapsed && (
        <div
          data-kanban-scroll
          className={`
            flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-2 min-h-[200px] overscroll-y-contain
            ${isTablet ? '' : 'touch-pan-y'}
            ${status === 'shipping' || status === 'pick_up' ? 'px-5' : 'pl-2 pr-0.5'}
            ${isOver && orders.length === 0 ? 'bg-orange-50' : colors.background || ''}
          `}
          style={{
            scrollbarGutter: 'stable',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--theme-border, #a8a29e) var(--theme-panel-bg, #f5f5f4)',
            // Tablet: allow both horizontal (board scroll) and vertical (card list scroll)
            // Phone/Desktop: vertical only (pan-y class handles this)
            ...(isTablet ? { touchAction: 'pan-x pan-y' } : {})
          } as React.CSSProperties}
        >
          {orders.map(order => (
            <KanbanCard
              key={order.order_id}
              order={order}
              onClick={() => onCardClick(order)}
              onOrderUpdated={onOrderUpdated}
              onToggleExpanded={onToggleExpanded}
              expanded={expanded}
              disableDrag={cardsDisableDrag}
              showPaintingBadge={cardsShowPaintingBadge}
            />
          ))}
        </div>
      )}

      {/* Collapsed placeholder - maintains drag target */}
      {isCollapsed && (
        <div className={`
          flex-1 flex items-center justify-center p-4 text-gray-400 text-sm
          ${isOver ? 'bg-orange-50' : colors.background || ''}
        `}>
          {totalCount} card{totalCount !== 1 ? 's' : ''} hidden
        </div>
      )}
    </div>
  );
};

/**
 * Memoized KanbanColumn - only re-renders when props change
 * Compares orders array by length and order IDs (not deep equality)
 */
export const KanbanColumn = React.memo(KanbanColumnComponent, (prevProps, nextProps) => {
  // Compare status and basic props
  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.expanded !== nextProps.expanded) return false;
  if (prevProps.isCollapsed !== nextProps.isCollapsed) return false;
  if (prevProps.showingAll !== nextProps.showingAll) return false;
  if (prevProps.totalCount !== nextProps.totalCount) return false;
  if (prevProps.isHiddenStatus !== nextProps.isHiddenStatus) return false;
  if (prevProps.isCollapsible !== nextProps.isCollapsible) return false;
  if (prevProps.columnId !== nextProps.columnId) return false;
  if (prevProps.columnLabel !== nextProps.columnLabel) return false;
  if (prevProps.disableDrop !== nextProps.disableDrop) return false;
  if (prevProps.cardsDisableDrag !== nextProps.cardsDisableDrag) return false;
  if (prevProps.cardsShowPaintingBadge !== nextProps.cardsShowPaintingBadge) return false;
  if (prevProps.isTablet !== nextProps.isTablet) return false;

  // Compare orders array using shared helper
  if (!areKanbanOrdersEqual(prevProps.orders, nextProps.orders)) return false;

  // Props are equal, skip re-render
  return true;
});

KanbanColumn.displayName = 'KanbanColumn';

export default KanbanColumn;
