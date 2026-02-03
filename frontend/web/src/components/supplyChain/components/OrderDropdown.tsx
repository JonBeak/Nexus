/**
 * OrderDropdown Component
 *
 * Searchable order selection dropdown for inline use in tables.
 * Orders are passed as a prop from the parent component.
 *
 * Features:
 * - Search/filter orders by number, name, or customer
 * - Integrates with material requirements inline editing
 * - Auto-save on selection
 */

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import type { OrderDropdownOption } from '../../../types/materialRequirements';

export interface OrderDropdownProps {
  value: number | null;
  onChange: (orderId: number | null) => void;
  orders: OrderDropdownOption[];  // Orders passed from parent
  loading?: boolean;              // Loading state from parent
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showClear?: boolean;
  includeStockOption?: boolean;   // Show "Stock" as first option
  isStockSelected?: boolean;      // Whether stock is currently selected
  onStockSelect?: () => void;     // Callback when stock is selected
}

export const OrderDropdown: React.FC<OrderDropdownProps> = ({
  value,
  onChange,
  orders,
  loading = false,
  disabled = false,
  placeholder = 'Select order...',
  className = '',
  showClear = true,
  includeStockOption = false,
  isStockSelected = false,
  onStockSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Calculate dropdown position relative to viewport
  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 256), // min-width 256px (w-64)
    });
  }, []);

  // Update position when dropdown opens and on scroll/resize
  useLayoutEffect(() => {
    if (!isOpen) {
      setDropdownPosition(null);
      return;
    }

    updateDropdownPosition();

    const handleScroll = () => updateDropdownPosition();
    const handleResize = () => updateDropdownPosition();

    window.addEventListener('scroll', handleScroll, true); // Capture phase for nested scrollers
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, updateDropdownPosition]);

  // Handle outside clicks including portal
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedOrder = orders.find(o => o.order_id === value);

  const filteredOrders = orders.filter(o => {
    const term = searchTerm.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(term) ||
      o.order_name.toLowerCase().includes(term) ||
      o.customer_name.toLowerCase().includes(term)
    );
  });

  // Check if "Stock" matches search term
  const stockMatchesSearch = includeStockOption && 'stock'.includes(searchTerm.toLowerCase());

  const handleSelect = useCallback((orderId: number | null) => {
    onChange(orderId);
    setIsOpen(false);
    setSearchTerm('');
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  }, []);

  // Format display text for selected order
  const getDisplayText = (order: OrderDropdownOption) => {
    return order.order_name || `#${order.order_number}`;
  };

  // Format option text in dropdown
  const getOptionText = (order: OrderDropdownOption) => {
    return `#${order.order_number} - ${order.order_name}`;
  };

  // Disabled state rendering
  if (disabled) {
    return (
      <span className={`${PAGE_STYLES.panel.textMuted} text-xs px-1`}>
        {isStockSelected ? 'Stock' : selectedOrder ? getDisplayText(selectedOrder) : '-'}
      </span>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-1.5 py-1.5 text-xs border rounded-none flex items-center justify-between gap-1
          ${PAGE_STYLES.input.text} bg-white border-gray-300 hover:border-gray-400
          focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
      >
        <span className={selectedOrder || isStockSelected ? '' : PAGE_STYLES.input.placeholder}>
          {isStockSelected ? 'Stock' : selectedOrder ? getDisplayText(selectedOrder) : placeholder}
        </span>
        <div className="flex items-center gap-0.5">
          {showClear && value && (
            <X
              className="w-3 h-3 text-gray-400 hover:text-gray-600"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
            />
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown panel - rendered via portal to escape table overflow */}
      {isOpen && dropdownPosition && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-white border border-gray-200 rounded-md shadow-lg"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
          }}
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search orders..."
                className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded
                  focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-2 text-xs text-gray-500">Loading...</div>
            ) : (filteredOrders.length === 0 && !stockMatchesSearch) ? (
              <div className="px-3 py-2 text-xs text-gray-500">
                {searchTerm ? 'No matches' : 'No orders available'}
              </div>
            ) : (
              <>
                {/* Stock option (if enabled and matches search) */}
                {includeStockOption && stockMatchesSearch && onStockSelect && (
                  <button
                    type="button"
                    onClick={() => {
                      onStockSelect();
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`w-full px-3 py-1.5 text-xs text-left font-medium hover:bg-purple-50
                      ${isStockSelected ? 'bg-purple-100 text-purple-700' : 'text-purple-600'}`}
                  >
                    Stock
                  </button>
                )}
                {/* Separator between Stock and Orders */}
                {includeStockOption && stockMatchesSearch && filteredOrders.length > 0 && (
                  <div className="border-t border-gray-200 my-1" />
                )}
                {/* Clear option */}
                {showClear && value && !isStockSelected && (
                  <button
                    type="button"
                    onClick={() => handleSelect(null)}
                    className="w-full px-3 py-1.5 text-xs text-left text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                  >
                    Clear selection
                  </button>
                )}
                {filteredOrders.map((order) => (
                  <button
                    key={order.order_id}
                    type="button"
                    onClick={() => handleSelect(order.order_id)}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-blue-50
                      ${order.order_id === value ? 'bg-blue-100 text-blue-700' : ''}`}
                  >
                    <div className="font-medium">{getOptionText(order)}</div>
                    <div className="text-gray-500 truncate">{order.customer_name}</div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default OrderDropdown;
