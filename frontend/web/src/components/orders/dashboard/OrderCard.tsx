import React from 'react';
import { Order } from '../../../types/orders';
import { useNavigate } from 'react-router-dom';
import { Calendar, User, Package, ChevronRight } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

interface Props {
  order: Order;
  onUpdated: () => void;
}

export const OrderCard: React.FC<Props> = ({ order, onUpdated }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/orders/${order.order_number}`);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Calculate progress percent from task counts
  const progressPercent = order.total_tasks && order.total_tasks > 0
    ? Math.round(((order.completed_tasks || 0) / order.total_tasks) * 100)
    : 0;

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer p-5 border border-gray-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Order #{order.order_number}
            </h3>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-gray-600 mt-1">{order.order_name}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <User className="w-4 h-4 mr-2 text-gray-400" />
          <span className="truncate">{order.customer_name || 'Unknown'}</span>
        </div>

        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
          <span>Due: {formatDate(order.due_date)}</span>
        </div>

        {order.customer_po && (
          <div className="flex items-center text-sm text-gray-600">
            <Package className="w-4 h-4 mr-2 text-gray-400" />
            <span className="truncate">PO: {order.customer_po}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {order.total_tasks !== undefined && (
          <div className="text-xs text-gray-500 mt-1">
            {order.completed_tasks || 0} of {order.total_tasks} tasks complete
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderCard;
