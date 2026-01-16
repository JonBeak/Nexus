/**
 * KanbanColumn - A single status column in the Kanban board
 * Uses useDroppable from dnd-kit for drag-and-drop support
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ORDER_STATUS_LABELS } from '../../../types/orders';
import { KanbanCard } from './KanbanCard';
import { KanbanColumnProps, KANBAN_COLUMN_COLORS } from './types';
import { PAGE_STYLES } from '../../../constants/moduleColors';

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
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
  cardsShowPaintingBadge = false
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: columnId || status,
    disabled: disableDrop
  });

  const colors = columnColors || KANBAN_COLUMN_COLORS[status];
  const label = columnLabel || ORDER_STATUS_LABELS[status];

  return (
    <div
      ref={setNodeRef}
      className={`
        w-72 h-full flex-shrink-0 flex flex-col rounded-lg border
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
            flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px] touch-pan-y overscroll-contain
            ${isOver && orders.length === 0 ? 'bg-orange-50' : colors.background || ''}
          `}
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

export default KanbanColumn;
