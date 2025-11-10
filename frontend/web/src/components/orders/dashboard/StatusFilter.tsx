import React from 'react';
import { OrderStatus, ORDER_STATUS_LABELS } from '../../../types/orders';

interface Props {
  selectedStatus: OrderStatus | 'all';
  onStatusChange: (status: OrderStatus | 'all') => void;
}

const STATUS_OPTIONS: Array<{ value: OrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Orders' },
  { value: 'job_details_setup', label: ORDER_STATUS_LABELS.job_details_setup },
  { value: 'pending_confirmation', label: ORDER_STATUS_LABELS.pending_confirmation },
  { value: 'pending_production_files_creation', label: ORDER_STATUS_LABELS.pending_production_files_creation },
  { value: 'pending_production_files_approval', label: ORDER_STATUS_LABELS.pending_production_files_approval },
  { value: 'production_queue', label: ORDER_STATUS_LABELS.production_queue },
  { value: 'in_production', label: ORDER_STATUS_LABELS.in_production },
  { value: 'on_hold', label: ORDER_STATUS_LABELS.on_hold },
  { value: 'overdue', label: ORDER_STATUS_LABELS.overdue },
  { value: 'qc_packing', label: ORDER_STATUS_LABELS.qc_packing },
  { value: 'shipping', label: ORDER_STATUS_LABELS.shipping },
  { value: 'pick_up', label: ORDER_STATUS_LABELS.pick_up },
  { value: 'awaiting_payment', label: ORDER_STATUS_LABELS.awaiting_payment },
  { value: 'completed', label: ORDER_STATUS_LABELS.completed },
  { value: 'cancelled', label: ORDER_STATUS_LABELS.cancelled }
];

export const StatusFilter: React.FC<Props> = ({ selectedStatus, onStatusChange }) => {
  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
        Status:
      </label>
      <select
        id="status-filter"
        value={selectedStatus}
        onChange={(e) => onStatusChange(e.target.value as OrderStatus | 'all')}
        className="block w-64 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default StatusFilter;
