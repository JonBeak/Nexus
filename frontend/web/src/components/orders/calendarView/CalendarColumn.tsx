/**
 * CalendarColumn Component
 * Single date column in the calendar view with header and order cards
 */

import React from 'react';
import { CalendarOrder } from './types';
import OrderCard from './OrderCard';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

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
      ? `${MODULE_COLORS.orders.base} text-white`
      : `${PAGE_STYLES.header.background} ${PAGE_STYLES.header.text}`;

  return (
    <div className="flex flex-col h-full flex-1" style={{ minWidth: '140px' }}>
      {/* Header */}
      <div className={`px-1 py-1.5 text-center border-b ${PAGE_STYLES.panel.border} ${headerClasses}`}>
        <div className="font-semibold text-sm">{headerLabel}</div>
        {subLabel && (
          <div className={`text-xs ${isOverdue || isToday ? 'text-white/80' : PAGE_STYLES.panel.textMuted}`}>
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
      <div className={`flex-1 px-1 py-1 overflow-y-auto ${PAGE_STYLES.panel.background}`}>
        {orders.length === 0 ? (
          <div className={`text-xs ${PAGE_STYLES.panel.textMuted} text-center py-2`}>
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
