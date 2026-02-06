/**
 * CompactOrderRow Component
 * Compact table row for displaying orders in dashboard panels
 *
 * Created: 2025-12-17
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertCircle, Clock, Truck, Package, Mail, CheckCircle, FileCheck } from 'lucide-react';
import { PanelOrderRow, PanelFilters, PanelActionType } from '../../../types/dashboardPanel';
import { OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../types/orders';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';
import { formatRelativeDate } from '../../../utils/dateUtils';

interface Props {
  order: PanelOrderRow;
  filters?: PanelFilters;
  onAction?: (order: PanelOrderRow, action: PanelActionType) => void;
}

export const CompactOrderRow: React.FC<Props> = ({ order, filters, onAction }) => {
  const navigate = useNavigate();

  const handleOpenOrder = () => {
    navigate(`/orders/${order.order_number}`);
  };

  const handleActionClick = (action: PanelActionType) => {
    if (onAction) {
      onAction(order, action);
    }
  };

  const showDaysInStatus = filters?.showDaysInStatus && order.days_in_status !== undefined;
  const showDaysOverdue = filters?.dueDateRange === 'overdue' && order.days_overdue !== undefined;
  const hideStatus = filters?.hideStatus;
  const actions = filters?.actions || [];

  const isOverdue = () => {
    if (!order.due_date) return false;
    const dueDate = new Date(order.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  // Get invoice status indicator
  const getInvoiceIndicator = () => {
    switch (order.invoice_status) {
      case 'no_invoice':
        return (
          <span title="No Invoice" className={PAGE_STYLES.panel.textMuted}>
            <FileText className="w-4 h-4" />
          </span>
        );
      case 'open_balance':
        return (
          <span title="Open Balance" className="text-orange-500">
            <FileText className="w-4 h-4" />
          </span>
        );
      case 'deposit_required_not_paid':
        return (
          <span title="Deposit Required" className="text-amber-500">
            <AlertCircle className="w-4 h-4" />
          </span>
        );
      case 'fully_paid':
        return (
          <span title="Fully Paid" className="text-green-500">
            <FileText className="w-4 h-4" />
          </span>
        );
      default:
        return null;
    }
  };

  const statusLabel = ORDER_STATUS_LABELS[order.status as OrderStatus] || order.status;
  const statusColor = ORDER_STATUS_COLORS[order.status as OrderStatus] || 'bg-gray-100 text-gray-800';

  return (
    <tr className={`${PAGE_STYLES.interactive.hover} transition-colors border-b ${PAGE_STYLES.panel.border} last:border-b-0`}>
      {/* Order Number */}
      <td className="py-2 px-3">
        <span className={`font-medium ${PAGE_STYLES.header.text}`}>#{order.order_number}</span>
      </td>

      {/* Customer */}
      <td className="py-2 px-3">
        <span className={`${PAGE_STYLES.header.text} truncate block max-w-[150px]`} title={order.customer_name}>
          {order.customer_name}
        </span>
      </td>

      {/* Order Name - Clickable Button */}
      <td className="py-2 px-3">
        <button
          onClick={handleOpenOrder}
          className={`${MODULE_COLORS.orders.text} hover:text-orange-600 hover:underline truncate block max-w-[200px] text-left font-medium`}
          title={`Open ${order.order_name}`}
        >
          {order.order_name}
        </button>
      </td>

      {/* Due Date */}
      <td className="py-2 px-3">
        <div className="flex items-center space-x-1">
          {order.hard_due_date_time && (
            <Clock className="w-3 h-3 text-purple-500" title={`Hard due: ${order.hard_due_date_time}`} />
          )}
          <span className={`text-sm ${isOverdue() ? 'text-red-600 font-medium' : PAGE_STYLES.panel.textMuted}`}>
            {formatRelativeDate(order.due_date)}
          </span>
        </div>
      </td>

      {/* Days Overdue (if enabled) */}
      {showDaysOverdue && (
        <td className="py-2 px-3">
          <span className={`text-sm font-medium ${
            order.days_overdue! > 7 ? 'text-red-600' :
            order.days_overdue! > 3 ? 'text-orange-600' :
            'text-amber-600'
          }`}>
            {order.days_overdue} {order.days_overdue === 1 ? 'day' : 'days'}
          </span>
        </td>
      )}

      {/* Status (hidden when hideStatus is true) */}
      {!hideStatus && (
        <td className="py-2 px-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </td>
      )}

      {/* Days in Status (if enabled) */}
      {showDaysInStatus && (
        <td className="py-2 px-3">
          <span className={`text-sm font-medium ${
            order.days_in_status! > 7 ? 'text-red-600' :
            order.days_in_status! > 3 ? 'text-amber-600' :
            PAGE_STYLES.panel.textMuted
          }`}>
            {order.days_in_status} {order.days_in_status === 1 ? 'day' : 'days'}
          </span>
        </td>
      )}

      {/* Indicators */}
      <td className="py-2 px-3">
        <div className="flex items-center space-x-2">
          {getInvoiceIndicator()}
          {order.shipping_required ? (
            <span title="Shipping" className="text-cyan-500">
              <Truck className="w-4 h-4" />
            </span>
          ) : (
            <span title="Pickup" className="text-teal-500">
              <Package className="w-4 h-4" />
            </span>
          )}
        </div>
      </td>

      {/* Action Buttons (if actions are defined) */}
      {actions.length > 0 && (
        <td className="py-2 px-3">
          <div className="flex items-center space-x-1">
            {actions.includes('send_reminder') && (
              <button
                onClick={() => handleActionClick('send_reminder')}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Send Reminder Email"
              >
                <Mail className="w-4 h-4" />
              </button>
            )}
            {actions.includes('mark_approved') && (
              <button
                onClick={() => handleActionClick('mark_approved')}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Mark as Approved by Customer"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            )}
            {actions.includes('approve_files') && (
              <button
                onClick={() => handleActionClick('approve_files')}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                title="Approve Production Files"
              >
                <FileCheck className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
};

export default CompactOrderRow;
