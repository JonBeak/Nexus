import React, { useState } from 'react';
import { OrderStatus, ORDER_STATUS_LABELS } from '../../../types/orders';
import { ordersApi } from '../../../services/api';

interface Props {
  orderNumber: number;
  currentStatus?: OrderStatus;
  onStatusUpdated: () => void;
}

const STATUS_OPTIONS: OrderStatus[] = [
  'initiated',
  'pending_confirmation',
  'pending_production_files_creation',
  'pending_production_files_approval',
  'production_queue',
  'in_production',
  'on_hold',
  'overdue',
  'qc_packing',
  'shipping',
  'pick_up',
  'awaiting_payment',
  'completed',
  'cancelled'
];

export const StatusDropdown: React.FC<Props> = ({
  orderNumber,
  currentStatus,
  onStatusUpdated
}) => {
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (newStatus === currentStatus) return;

    try {
      setUpdating(true);
      await ordersApi.updateOrderStatus(orderNumber, newStatus);
      onStatusUpdated();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <label className="text-sm font-medium text-gray-700">
        Update Status:
      </label>
      <select
        value={currentStatus || ''}
        onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
        disabled={updating}
        className="block w-64 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {ORDER_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  );
};

export default StatusDropdown;
