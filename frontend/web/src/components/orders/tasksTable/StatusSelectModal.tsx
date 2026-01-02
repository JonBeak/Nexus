/**
 * StatusSelectModal Component
 * Modal for selecting order status with color-coded options
 */

import React from 'react';
import { OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../types/orders';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface Props {
  isOpen: boolean;
  currentStatus: OrderStatus;
  orderNumber: number;
  orderName: string;
  onSelect: (status: OrderStatus) => void;
  onClose: () => void;
}

// Order statuses in logical groupings
const STATUS_GROUPS = [
  {
    label: 'Pre-Production',
    statuses: [
      'job_details_setup',
      'pending_confirmation',
      'pending_production_files_creation',
      'pending_production_files_approval'
    ] as OrderStatus[]
  },
  {
    label: 'Production',
    statuses: [
      'production_queue',
      'in_production',
      'overdue',
      'qc_packing'
    ] as OrderStatus[]
  },
  {
    label: 'Post-Production',
    statuses: [
      'shipping',
      'pick_up',
      'awaiting_payment'
    ] as OrderStatus[]
  },
  {
    label: 'Final',
    statuses: [
      'completed',
      'cancelled'
    ] as OrderStatus[]
  },
  {
    label: 'On Hold',
    statuses: [
      'on_hold'
    ] as OrderStatus[]
  }
];

export const StatusSelectModal: React.FC<Props> = ({
  isOpen,
  currentStatus,
  orderNumber,
  orderName,
  onSelect,
  onClose
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden`}>
        {/* Header */}
        <div className={`px-4 py-3 border-b ${PAGE_STYLES.panel.border}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>Change Status</h3>
              <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>{orderNumber}: {orderName}</p>
            </div>
            <button
              onClick={onClose}
              className={`${PAGE_STYLES.panel.textMuted} hover:text-orange-600`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Status Options */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {STATUS_GROUPS.map((group) => (
            <div key={group.label} className="mb-4 last:mb-0">
              <h4 className={`text-xs font-semibold ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider mb-2`}>
                {group.label}
              </h4>
              <div className="space-y-1">
                {group.statuses.map((status) => {
                  const isSelected = status === currentStatus;
                  const colorClasses = ORDER_STATUS_COLORS[status];

                  return (
                    <button
                      key={status}
                      onClick={() => {
                        if (!isSelected) {
                          onSelect(status);
                        }
                      }}
                      disabled={isSelected}
                      className={`w-full text-left px-3 py-2 rounded-md transition-all ${
                        isSelected
                          ? `${colorClasses} ring-2 ring-offset-1 ring-gray-400 cursor-default`
                          : `${colorClasses} hover:ring-2 hover:ring-offset-1 hover:ring-gray-300`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {ORDER_STATUS_LABELS[status]}
                        </span>
                        {isSelected && (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={`px-4 py-3 border-t ${PAGE_STYLES.panel.border} ${PAGE_STYLES.page.background}`}>
          <button
            onClick={onClose}
            className={`w-full px-4 py-2 text-sm font-medium ${PAGE_STYLES.header.text} ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} rounded-md ${PAGE_STYLES.interactive.hover}`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusSelectModal;
