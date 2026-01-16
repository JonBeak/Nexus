/**
 * OrderCard Component
 * Displays a single order in the calendar view as a clickable card
 */

import React from 'react';
import { CalendarOrder, ProgressColor } from './types';
import { getProgressColor } from './utils';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface OrderCardProps {
  order: CalendarOrder;
  showDaysLate?: boolean;
  onCardClick: (order: CalendarOrder) => void;
}

const colorClasses: Record<ProgressColor, { border: string; bg: string; progress: string }> = {
  red: {
    border: 'border-l-red-500',
    bg: 'bg-red-100',
    progress: 'bg-red-500'
  },
  yellow: {
    border: 'border-l-orange-500',
    bg: 'bg-orange-50',
    progress: 'bg-orange-500'
  },
  green: {
    border: 'border-l-blue-500',
    bg: 'bg-white',
    progress: 'bg-blue-500'
  }
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, showDaysLate = false, onCardClick }) => {
  const progressColor = getProgressColor(order.work_days_left, order.progress_percent);
  const colors = colorClasses[progressColor];

  const handleClick = () => {
    onCardClick(order);
  };

  // Format days late display
  const daysLateDisplay = order.work_days_left !== null && order.work_days_left < 0
    ? `${Math.abs(order.work_days_left).toFixed(1)}d late`
    : null;

  return (
    <div
      className={`
        p-2 md:p-1.5 mb-1.5 md:mb-1 rounded shadow-sm cursor-pointer
        hover:shadow-md active:bg-gray-100 transition-shadow
        border-l-4 ${colors.border} ${colors.bg}
        min-h-[48px] md:min-h-0
      `}
      onClick={handleClick}
      title={`Order #${order.order_number} - ${order.customer_name || 'Unknown'}`}
    >
      {/* Order Name - Primary */}
      <div className={`text-sm font-bold ${PAGE_STYLES.panel.text} break-words`}>
        {order.order_name}
      </div>

      {/* Customer Name + Shipping/Pickup Label */}
      <div className="flex items-center gap-1">
        <span className={`text-xs ${PAGE_STYLES.header.text} truncate flex-1`}>
          {order.customer_name || '-'}
        </span>
        <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${
          order.shipping_required
            ? 'bg-blue-100 text-blue-700'
            : 'bg-yellow-100 text-yellow-700'
        }`}>
          {order.shipping_required ? 'Ship' : 'Pickup'}
        </span>
      </div>

      {/* Order Number */}
      <div className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>
        #{order.order_number}
      </div>

      {/* Progress Bar */}
      <div className="mt-1 flex items-center space-x-1">
        <div className={`flex-1 ${PAGE_STYLES.header.background} rounded-full h-1`}>
          <div
            className={`h-1 rounded-full ${colors.progress}`}
            style={{ width: `${order.progress_percent}%` }}
          />
        </div>
        <span className={`text-xs ${PAGE_STYLES.panel.textMuted} w-7 text-right`}>
          {order.progress_percent}%
        </span>
      </div>

      {/* Days late (for overdue column) */}
      {showDaysLate && daysLateDisplay && (
        <div className="text-xs text-red-600 font-medium">
          {daysLateDisplay}
        </div>
      )}
    </div>
  );
};

export default OrderCard;
