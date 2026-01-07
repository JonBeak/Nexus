import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Order, OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../types/orders';
import { calculateWorkDaysLeft } from '../calendarView/utils';

interface Props {
  order: Order & { progress_percent?: number };
  onStatusClick: (orderNumber: number, orderName: string, currentStatus: OrderStatus) => void;
  holidays: Set<string>;  // Set of 'YYYY-MM-DD' strings
}

export const TableRow: React.FC<Props> = ({ order, onStatusClick, holidays }) => {
  const navigate = useNavigate();

  const handleOrderClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(`/orders/${order.order_number}`);
  };

  const formatDate = (dateString?: string, includeWeekday = false) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (includeWeekday) {
      return `${weekdays[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    }
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '-';
    // Handle HH:MM:SS format
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const progressPercent = order.progress_percent || 0;
  const workDaysLeft = calculateWorkDaysLeft(order.due_date, order.hard_due_date_time, holidays);

  // Color coding for work days left
  const getWorkDaysColor = (days: number | null): string => {
    if (days === null) return 'text-gray-400';
    if (days < 0) return 'text-red-600 font-semibold';  // Overdue
    if (days < 1) return 'text-red-600 font-medium';     // Less than 1 day
    if (days < 2) return 'text-amber-600 font-medium';   // 1-2 days
    return 'text-gray-600';                              // > 2 days
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
        {order.order_number}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 max-w-[320px]">
        <a
          href={`/orders/${order.order_number}`}
          onClick={handleOrderClick}
          className="font-semibold text-gray-900 hover:text-blue-400 cursor-pointer block truncate"
          title={order.order_name}
        >
          {order.order_name}
        </a>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 max-w-[176px]">
        <span className="block truncate" title={order.customer_name || undefined}>
          {order.customer_name || '-'}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <button
          onClick={() => onStatusClick(order.order_number, order.order_name, order.status)}
          className={`inline-block px-2 py-1 text-xs font-medium rounded cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-400 transition-all ${ORDER_STATUS_COLORS[order.status]}`}
          title="Click to change status"
        >
          {ORDER_STATUS_LABELS[order.status]}
        </button>
      </td>
      <td className={`px-4 py-3 whitespace-nowrap text-sm ${order.hard_due_date_time ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
        {formatDate(order.due_date, true)}
      </td>
      <td className={`px-4 py-3 whitespace-nowrap text-sm ${order.hard_due_date_time ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
        {formatTime(order.hard_due_date_time)}
      </td>
      <td className={`px-4 py-3 whitespace-nowrap text-sm ${getWorkDaysColor(workDaysLeft)}`}>
        {workDaysLeft !== null ? workDaysLeft.toFixed(1) : '-'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2 w-44">
            <div
              className="bg-indigo-600 h-2 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">{progressPercent}%</span>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
        {formatDate(order.created_at)}
      </td>
    </tr>
  );
};

export default TableRow;
