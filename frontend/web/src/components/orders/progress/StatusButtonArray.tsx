import React, { useState, useRef, useEffect } from 'react';
import { OrderStatus, ORDER_STATUS_LABELS } from '../../../types/orders';
import { ordersApi } from '../../../services/api';
import { useAlert } from '../../../contexts/AlertContext';

interface Props {
  orderNumber: number;
  currentStatus?: OrderStatus;
  onStatusUpdated: () => void;
}

// Organized into rows
const STATUS_ROWS: OrderStatus[][] = [
  // Row 1: Initial setup and approval stages
  [
    'job_details_setup',
    'pending_confirmation',
    'pending_production_files_creation',
    'pending_production_files_approval'
  ],
  // Row 2: Production stages and shipping
  [
    'production_queue',
    'in_production',
    'overdue',
    'qc_packing',
    'shipping',
    'pick_up'
  ],
  // Row 3: Final stages
  [
    'awaiting_payment',
    'completed',
    'on_hold',
    'cancelled'
  ]
];

// Color configurations for each status
const STATUS_COLORS: Record<OrderStatus, { active: string; inactive: string }> = {
  job_details_setup: { active: 'bg-amber-500 text-white', inactive: 'bg-gray-200 text-gray-500' },
  pending_confirmation: { active: 'bg-yellow-500 text-white', inactive: 'bg-gray-200 text-gray-500' },
  pending_production_files_creation: { active: 'bg-orange-500 text-white', inactive: 'bg-gray-200 text-gray-500' },
  pending_production_files_approval: { active: 'bg-orange-600 text-white', inactive: 'bg-gray-200 text-gray-500' },
  production_queue: { active: 'bg-blue-500 text-white', inactive: 'bg-gray-200 text-gray-500' },
  in_production: { active: 'bg-indigo-600 text-white', inactive: 'bg-gray-200 text-gray-500' },
  on_hold: { active: 'bg-red-500 text-white', inactive: 'bg-gray-200 text-gray-500' },
  overdue: { active: 'bg-red-700 text-white', inactive: 'bg-gray-200 text-gray-500' },
  qc_packing: { active: 'bg-purple-500 text-white', inactive: 'bg-gray-200 text-gray-500' },
  shipping: { active: 'bg-blue-500 text-white', inactive: 'bg-gray-200 text-gray-500' },
  pick_up: { active: 'bg-blue-500 text-white', inactive: 'bg-gray-200 text-gray-500' },
  awaiting_payment: { active: 'bg-green-500 text-white', inactive: 'bg-gray-200 text-gray-500' },
  completed: { active: 'bg-green-600 text-white', inactive: 'bg-gray-200 text-gray-500' },
  cancelled: { active: 'bg-gray-600 text-white', inactive: 'bg-gray-200 text-gray-500' }
};

export const StatusButtonArray: React.FC<Props> = ({
  orderNumber,
  currentStatus,
  onStatusUpdated
}) => {
  const { showError } = useAlert();
  const [holdingStatus, setHoldingStatus] = useState<OrderStatus | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [updating, setUpdating] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const handleMouseDown = (status: OrderStatus) => {
    if (status === currentStatus || updating) return;

    setHoldingStatus(status);
    setHoldProgress(0);

    // Update progress every 50ms for smooth animation
    progressIntervalRef.current = setInterval(() => {
      setHoldProgress((prev) => Math.min(prev + 5, 100));
    }, 50);

    // Trigger status change after 1 second
    holdTimerRef.current = setTimeout(() => {
      handleStatusChange(status);
    }, 1000);
  };

  const handleMouseUp = () => {
    // Cancel the hold
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setHoldingStatus(null);
    setHoldProgress(0);
  };

  const handleMouseLeave = () => {
    handleMouseUp();
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    try {
      setUpdating(true);
      await ordersApi.updateOrderStatus(orderNumber, newStatus);
      onStatusUpdated();
    } catch (error) {
      console.error('Error updating status:', error);
      showError('Failed to update status. Please try again.');
    } finally {
      setUpdating(false);
      setHoldingStatus(null);
      setHoldProgress(0);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-lg font-semibold text-gray-700">Update Status</label>
        {holdingStatus && (
          <p className="text-sm text-gray-600 italic">Hold to confirm status change...</p>
        )}
      </div>
      <div className="space-y-3">
        {STATUS_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-3">
            {row.map((status) => {
              const isActive = status === currentStatus;
              const isHolding = status === holdingStatus;
              const colors = STATUS_COLORS[status];

              return (
                <button
                  key={status}
                  onMouseDown={() => handleMouseDown(status)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={() => handleMouseDown(status)}
                  onTouchEnd={handleMouseUp}
                  disabled={updating}
                  className={`
                    relative px-5 py-2.5 rounded-md text-base font-semibold transition-all overflow-hidden
                    ${isActive ? colors.active : colors.inactive}
                    ${!isActive && !updating ? 'hover:bg-gray-300 cursor-pointer' : ''}
                    ${isActive ? 'cursor-default shadow-md' : ''}
                    ${updating ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {/* Hold progress indicator */}
                  {isHolding && (
                    <div
                      className="absolute inset-0 bg-white opacity-30 transition-all"
                      style={{
                        width: `${holdProgress}%`,
                        transition: 'width 50ms linear'
                      }}
                    />
                  )}
                  <span className="relative z-10">{ORDER_STATUS_LABELS[status]}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatusButtonArray;
