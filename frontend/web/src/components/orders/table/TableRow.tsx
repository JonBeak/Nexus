import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Order, OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../types/orders';

interface Props {
  order: Order & { progress_percent?: number };
  onStatusClick: (orderNumber: number, orderName: string, currentStatus: OrderStatus) => void;
}

export const TableRow: React.FC<Props> = ({ order, onStatusClick }) => {
  const navigate = useNavigate();

  const handleOrderClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(`/orders/${order.order_number}`);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
        {order.order_number}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
        <a
          href={`/orders/${order.order_number}`}
          onClick={handleOrderClick}
          className="text-gray-900 hover:text-blue-600 cursor-pointer"
        >
          {order.order_name}
        </a>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
        {order.customer_name || '-'}
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
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
        {formatDate(order.due_date)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
        {formatTime(order.hard_due_date_time)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2 w-32">
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
