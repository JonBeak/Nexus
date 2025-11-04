import React, { useState } from 'react';
import { OrderStatus, ORDER_STATUS_LABELS } from '../../../types/orders';

interface Props {
  selectedCount: number;
  onStatusUpdate: (status: OrderStatus) => void;
  onClear: () => void;
}

export const BatchActions: React.FC<Props> = ({
  selectedCount,
  onStatusUpdate,
  onClear
}) => {
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const handleStatusUpdate = (status: OrderStatus) => {
    if (confirm(`Update ${selectedCount} orders to status: ${ORDER_STATUS_LABELS[status]}?`)) {
      onStatusUpdate(status);
      setShowStatusMenu(false);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <span className="text-sm font-medium text-gray-700">
        {selectedCount} selected
      </span>

      <div className="relative">
        <button
          onClick={() => setShowStatusMenu(!showStatusMenu)}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
        >
          Update Status
        </button>

        {showStatusMenu && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-10">
            <div className="py-1 max-h-96 overflow-y-auto">
              {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => (
                <button
                  key={status}
                  onClick={() => handleStatusUpdate(status as OrderStatus)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onClear}
        className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
      >
        Clear Selection
      </button>
    </div>
  );
};

export default BatchActions;
