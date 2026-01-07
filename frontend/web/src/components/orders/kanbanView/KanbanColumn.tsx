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
  onToggleShowAll
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: status
  });

  const colors = KANBAN_COLUMN_COLORS[status];

  return (
    <div
      ref={setNodeRef}
      className={`
        w-72 h-full flex-shrink-0 flex flex-col rounded-lg border
        ${PAGE_STYLES.panel.background}
        ${isOver ? 'ring-2 ring-orange-400' : ''}
        ${colors.border}
      `}
    >
      {/* Column Header */}
      <div className={`px-3 py-2 rounded-t-lg ${colors.header} border-b ${colors.border}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm text-gray-800">
            {ORDER_STATUS_LABELS[status]}
          </h3>
          {/* Current filter state for completed/cancelled - clickable to toggle */}
          {isHiddenStatus && onToggleShowAll && (
            <button
              onClick={onToggleShowAll}
              className="text-xs text-gray-600 hover:text-gray-900 hover:underline transition-colors"
            >
              {showingAll ? `All (${totalCount})` : 'Recent'}
            </button>
          )}
        </div>
      </div>

      {/* Cards Container */}
      <div className={`
        flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]
        ${isOver && orders.length === 0 ? 'bg-orange-50' : ''}
      `}>
        {orders.map(order => (
          <KanbanCard
            key={order.order_id}
            order={order}
            onClick={() => onCardClick(order)}
            onOrderUpdated={onOrderUpdated}
            onToggleExpanded={onToggleExpanded}
            expanded={expanded}
          />
        ))}
      </div>
    </div>
  );
};

export default KanbanColumn;
