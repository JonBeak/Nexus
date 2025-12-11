/**
 * CalendarColumn Component
 * Single date column in the calendar view with header and order cards
 */

import React from 'react';
import { CalendarOrder } from './types';
import OrderCard from './OrderCard';

interface CalendarColumnProps {
  headerLabel: string;
  subLabel?: string;
  isToday?: boolean;
  isOverdue?: boolean;
  orders: CalendarOrder[];
  showDaysLate?: boolean;
  onCardClick: (order: CalendarOrder) => void;
}

export const CalendarColumn: React.FC<CalendarColumnProps> = ({
  headerLabel,
  subLabel,
  isToday = false,
  isOverdue = false,
  orders,
  showDaysLate = false,
  onCardClick
}) => {
  // Header styling based on column type
  const headerClasses = isOverdue
    ? 'bg-red-600 text-white'
    : isToday
      ? 'bg-indigo-600 text-white'
      : 'bg-gray-100 text-gray-700';

  return (
    <div className="flex flex-col h-full flex-1" style={{ minWidth: '140px' }}>
      {/* Header */}
      <div className={`px-1 py-1.5 text-center border-b border-gray-200 ${headerClasses}`}>
        <div className="font-semibold text-sm">{headerLabel}</div>
        {subLabel && (
          <div className={`text-xs ${isOverdue || isToday ? 'text-white/80' : 'text-gray-500'}`}>
            {subLabel}
          </div>
        )}
        {isOverdue && (
          <div className="text-xs text-white/70">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Orders list */}
      <div className="flex-1 px-1 py-1 overflow-y-auto bg-gray-50">
        {orders.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-2">
            No orders
          </div>
        ) : (
          orders.map(order => (
            <OrderCard
              key={order.order_id}
              order={order}
              showDaysLate={showDaysLate}
              onCardClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default CalendarColumn;
