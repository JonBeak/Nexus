import React from 'react';
import { Order } from '../../../types/orders';
import { useNavigate } from 'react-router-dom';
import { Calendar, User, Package, ChevronRight } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

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
      className={`${PAGE_STYLES.composites.panelContainer} hover:shadow-md transition-shadow cursor-pointer p-5`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h3 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>
              Order #{order.order_number}
            </h3>
            <StatusBadge status={order.status} />
          </div>
          <p className={`${PAGE_STYLES.panel.textMuted} mt-1`}>{order.order_name}</p>
        </div>
        <ChevronRight className={`w-5 h-5 ${PAGE_STYLES.panel.textMuted} flex-shrink-0`} />
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className={`flex items-center text-sm ${PAGE_STYLES.panel.textMuted}`}>
          <User className={`w-4 h-4 mr-2 ${PAGE_STYLES.panel.textMuted}`} />
          <span className="truncate">{order.customer_name || 'Unknown'}</span>
        </div>

        <div className={`flex items-center text-sm ${PAGE_STYLES.panel.textMuted}`}>
          <Calendar className={`w-4 h-4 mr-2 ${PAGE_STYLES.panel.textMuted}`} />
          <span>Due: {formatDate(order.due_date)}</span>
        </div>

        {order.customer_po && (
          <div className={`flex items-center text-sm ${PAGE_STYLES.panel.textMuted}`}>
            <Package className={`w-4 h-4 mr-2 ${PAGE_STYLES.panel.textMuted}`} />
            <span className="truncate">PO: {order.customer_po}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div>
        <div className={`flex items-center justify-between text-xs ${PAGE_STYLES.panel.textMuted} mb-1`}>
          <span>Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className={`w-full ${PAGE_STYLES.header.background} rounded-full h-2`}>
          <div
            className={`${MODULE_COLORS.orders.base} h-2 rounded-full transition-all duration-300`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {order.total_tasks !== undefined && (
          <div className={`text-xs ${PAGE_STYLES.panel.textMuted} mt-1`}>
            {order.completed_tasks || 0} of {order.total_tasks} tasks complete
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderCard;
