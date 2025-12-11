import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Order, OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../types/orders';

interface Props {
  order: Order & { progress_percent?: number };
  onStatusClick: (orderNumber: number, orderName: string, currentStatus: OrderStatus) => void;
  holidays: Set<string>;  // Set of 'YYYY-MM-DD' strings
}

// Work day calculation constants
const WORK_START = 7.5;  // 7:30am as decimal hours
const WORK_END = 16;     // 4pm as decimal hours
const WORK_HOURS_PER_DAY = 8.5;

/**
 * Calculate work days remaining until due date/time
 * Returns negative values for overdue orders
 */
function calculateWorkDaysLeft(
  dueDate: string | null | undefined,
  dueTime: string | null | undefined,
  holidays: Set<string>
): number | null {
  if (!dueDate) return null;

  const now = new Date();
  const dueDateTime = new Date(dueDate);

  // Set due time (default 4pm if not specified)
  if (dueTime) {
    const [h, m] = dueTime.split(':').map(Number);
    dueDateTime.setHours(h, m, 0, 0);
  } else {
    dueDateTime.setHours(16, 0, 0, 0);  // 4pm default
  }

  // Determine if past due and set start/end times accordingly
  const isPastDue = now >= dueDateTime;
  const startTime = isPastDue ? new Date(dueDateTime) : new Date(now);
  const endTime = isPastDue ? new Date(now) : new Date(dueDateTime);

  let workHours = 0;
  const current = new Date(startTime);
  current.setHours(0, 0, 0, 0);  // Start at beginning of day

  while (current <= endTime) {
    const dateStr = current.toISOString().split('T')[0];
    const dayOfWeek = current.getDay();

    // Skip weekends (0 = Sunday, 6 = Saturday) and holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateStr)) {
      const isFirstDay = current.toDateString() === startTime.toDateString();
      const isLastDay = current.toDateString() === endTime.toDateString();

      let dayStart = WORK_START;
      let dayEnd = WORK_END;

      if (isFirstDay) {
        const startHour = startTime.getHours() + startTime.getMinutes() / 60;
        dayStart = Math.max(startHour, WORK_START);
        // If start time is after work end, no hours this day
        if (dayStart >= WORK_END) dayStart = WORK_END;
      }

      if (isLastDay) {
        const endHour = endTime.getHours() + endTime.getMinutes() / 60;
        dayEnd = Math.min(endHour, WORK_END);
        // If end time is before work start, no hours this day
        if (dayEnd <= WORK_START) dayEnd = WORK_START;
      }

      if (dayEnd > dayStart) {
        workHours += dayEnd - dayStart;
      }
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  const workDays = workHours / WORK_HOURS_PER_DAY;
  const result = Math.round(workDays * 10) / 10;

  return isPastDue ? -result : result;
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
