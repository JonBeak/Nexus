/**
 * QBItemDropdown
 *
 * Searchable dropdown for selecting QuickBooks items.
 * Used in the Estimate Preparation Table for assigning QB items to line items.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../services/apiClient';

interface QBItem {
  id: number;
  name: string;
  description: string | null;
  qbItemId: string;
}

interface QBItemDropdownProps {
  value: string | null;
  displayValue: string | null;
  onChange: (qbItemId: string | null, qbItemName: string | null) => void;
  disabled?: boolean;
}

export const QBItemDropdown: React.FC<QBItemDropdownProps> = ({
  value,
  displayValue,
  onChange,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [qbItems, setQbItems] = useState<QBItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load QB items when dropdown opens
  const loadQBItems = useCallback(async () => {
    if (qbItems.length > 0) return; // Already loaded

    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/quickbooks/items');
      if (response.data.success) {
        setQbItems(response.data.items || []);
      } else {
        setError('Failed to load QB items');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load QB items');
    } finally {
      setLoading(false);
    }
  }, [qbItems.length]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update dropdown position when open
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 256) // min 256px width
      });
    }
  }, [isOpen]);

  // Load items when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadQBItems();
    }
  }, [isOpen, loadQBItems]);

  // Filter items by search (item_name only)
  const filteredItems = qbItems.filter(item =>
    (item.name?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const handleSelect = (item: QBItem) => {
    onChange(item.qbItemId, item.name);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, null);
  };

  if (disabled) {
    return (
      <span className="text-xs text-gray-600 px-1 truncate block max-w-[120px]" title={displayValue || ''}>
        {displayValue || <span className="text-gray-600">Not set</span>}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* Display / Trigger */}
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between px-1 py-0.5 text-xs border-2 rounded cursor-pointer flex-1
          ${value ? 'border-green-500 bg-green-50' : 'border-yellow-400 bg-yellow-50'}
          hover:border-green-600`}
      >
        <span className="truncate max-w-[100px]" title={displayValue || 'Select QB Item'}>
          {displayValue || <span className="text-gray-400">Select...</span>}
        </span>
        <span className="text-gray-400 ml-1">▼</span>
      </div>

      {/* Clear button outside dropdown */}
      {value && (
        <button
          onClick={handleClear}
          className="text-gray-400 hover:text-red-500 text-lg font-bold"
          title="Clear"
        >
          ×
        </button>
      )}

      {/* Dropdown - rendered via portal to escape overflow containers */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-white border border-gray-300 rounded-lg shadow-lg z-[9999]"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width
          }}
        >
          {/* Search input */}
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search QB items..."
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Items list */}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="p-2 text-xs text-gray-500 text-center">Loading...</div>
            ) : error ? (
              <div className="p-2 text-xs text-red-500 text-center">{error}</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-2 text-xs text-gray-500 text-center">
                {search ? 'No matching items' : 'No QB items available'}
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`px-2 py-1.5 text-xs cursor-pointer hover:bg-blue-50
                    ${item.qbItemId === value ? 'bg-blue-100' : ''}`}
                >
                  <div className="font-medium truncate">{item.name}</div>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
