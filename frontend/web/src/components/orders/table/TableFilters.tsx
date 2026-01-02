import React, { useState, useRef } from 'react';
import { OrderFilters, OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../types/orders';
import { Search, ChevronDown } from 'lucide-react';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

interface Props {
  filters: OrderFilters;
  onFiltersChange: (filters: OrderFilters) => void;
}

// All statuses available for filtering
const ALL_STATUSES: OrderStatus[] = [
  'job_details_setup',
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

// Default statuses (all except completed and cancelled)
export const DEFAULT_ORDER_STATUSES: OrderStatus[] = ALL_STATUSES.filter(
  s => s !== 'completed' && s !== 'cancelled'
);

export const TableFilters: React.FC<Props> = ({ filters, onFiltersChange }) => {
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const statusButtonRef = useRef<HTMLButtonElement>(null);

  // Get display statuses (use defaults if empty)
  const displayStatuses = filters.statuses.length > 0 ? filters.statuses : DEFAULT_ORDER_STATUSES;

  const handleStatusToggle = (status: OrderStatus) => {
    const currentStatuses = filters.statuses.length > 0 ? filters.statuses : [...DEFAULT_ORDER_STATUSES];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const handleSearchChange = (search: string) => {
    onFiltersChange({ ...filters, search });
  };

  const handleResetToDefaults = () => {
    onFiltersChange({ ...filters, statuses: [] });
    setStatusDropdownOpen(false);
  };

  return (
    <div className="flex items-center space-x-4">
      {/* Status Multi-Select Filter */}
      <div>
        <button
          ref={statusButtonRef}
          onClick={() => {
            if (!statusDropdownOpen && statusButtonRef.current) {
              const rect = statusButtonRef.current.getBoundingClientRect();
              setDropdownPosition({
                top: rect.bottom + 4,
                left: rect.left
              });
            }
            setStatusDropdownOpen(!statusDropdownOpen);
          }}
          className={`flex items-center space-x-2 px-3 py-2 border ${PAGE_STYLES.panel.border} rounded-lg text-sm ${PAGE_STYLES.panel.background} ${PAGE_STYLES.interactive.hover} focus:outline-none focus:ring-2 focus:ring-orange-500`}
        >
          <span className={PAGE_STYLES.header.text}>
            Status ({displayStatuses.length})
          </span>
          <ChevronDown className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted} transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {statusDropdownOpen && (
          <>
            {/* Backdrop to close dropdown */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setStatusDropdownOpen(false)}
            />
            {/* Dropdown panel - fixed positioning to escape overflow */}
            <div
              className={`fixed w-72 ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto`}
              style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
            >
              <div className={`p-2 border-b ${PAGE_STYLES.panel.border}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase`}>Filter by Status</span>
                  <button
                    onClick={handleResetToDefaults}
                    className={`text-xs ${MODULE_COLORS.orders.text} hover:text-orange-600`}
                  >
                    Reset to defaults
                  </button>
                </div>
              </div>
              <div className="p-2 space-y-1">
                {ALL_STATUSES.map(status => (
                  <label
                    key={status}
                    className={`flex items-center space-x-2 px-2 py-1.5 rounded ${PAGE_STYLES.interactive.hover} cursor-pointer`}
                  >
                    <input
                      type="checkbox"
                      checked={displayStatuses.includes(status)}
                      onChange={() => handleStatusToggle(status)}
                      className={`h-4 w-4 text-orange-500 focus:ring-orange-500 ${PAGE_STYLES.panel.border} rounded`}
                    />
                    <span className={`text-xs px-2 py-0.5 rounded ${ORDER_STATUS_COLORS[status]}`}>
                      {ORDER_STATUS_LABELS[status]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className={`h-5 w-5 ${PAGE_STYLES.panel.textMuted}`} />
          </div>
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search orders, customers..."
            className={`block w-full pl-10 pr-3 py-2 border ${PAGE_STYLES.panel.border} rounded-md leading-5 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.placeholder} focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 sm:text-sm`}
          />
        </div>
      </div>
    </div>
  );
};

export default TableFilters;
