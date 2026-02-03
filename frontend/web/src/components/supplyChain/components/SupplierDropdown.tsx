/**
 * SupplierDropdown Component
 *
 * Searchable supplier selection dropdown for inline use in tables.
 * Fetches suppliers from API and provides filtered selection.
 * Renders dropdown via portal to avoid table overflow clipping.
 * Input box serves as both display and search field (combobox pattern).
 *
 * Features:
 * - Type to search/filter suppliers by name
 * - Shows only active suppliers by default
 * - Special options: "In Stock" (ID: -1) and "In House" (ID: -2)
 * - Integrates with InlineEditableCell pattern
 * - Auto-save on selection
 * - Portal rendering to escape table overflow
 *
 * Special Supplier IDs:
 * - SUPPLIER_IN_STOCK (-1): Material sourced from existing inventory
 * - SUPPLIER_IN_HOUSE (-2): Product produced in-house (e.g., digital prints)
 */

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Package, Printer } from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import { suppliersApi, Supplier } from '../../../services/api/suppliersApi';

// Special "supplier" IDs for internal sourcing options
export const SUPPLIER_IN_STOCK = -1;
export const SUPPLIER_IN_HOUSE = -2;

interface SpecialOption {
  id: number;
  name: string;
  description: string;
  icon: 'package' | 'printer';
  color: string;
}

const SPECIAL_OPTIONS: SpecialOption[] = [
  { id: SUPPLIER_IN_STOCK, name: 'In Stock', description: 'Source from existing inventory', icon: 'package', color: 'text-green-600' },
  { id: SUPPLIER_IN_HOUSE, name: 'In House', description: 'Produced in-house (e.g., digital prints)', icon: 'printer', color: 'text-purple-600' },
];

export interface SupplierDropdownProps {
  value: number | null;
  onChange: (supplierId: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showClear?: boolean;
  /** Pre-loaded suppliers (optional - loads internally if not provided) */
  suppliers?: Supplier[];
}

export const SupplierDropdown: React.FC<SupplierDropdownProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select vendor...',
  className = '',
  showClear = true,
  suppliers: externalSuppliers,
}) => {
  const [internalSuppliers, setInternalSuppliers] = useState<Supplier[]>([]);
  const suppliers = externalSuppliers ?? internalSuppliers;
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load suppliers on mount (skip if provided externally)
  useEffect(() => {
    if (externalSuppliers) {
      setLoading(false);
      return;
    }

    const loadSuppliers = async () => {
      try {
        setLoading(true);
        const data = await suppliersApi.getSuppliers({ active_only: true });
        setInternalSuppliers(data);
      } catch (error) {
        console.error('Failed to load suppliers:', error);
      } finally {
        setLoading(false);
      }
    };
    void loadSuppliers();
  }, [externalSuppliers]);

  const selectedSupplier = suppliers.find(s => s.supplier_id === value);
  const selectedSpecialOption = SPECIAL_OPTIONS.find(o => o.id === value);

  // Get display name for current value
  const getSelectedDisplayName = useCallback((): string => {
    if (selectedSpecialOption) return selectedSpecialOption.name;
    if (selectedSupplier) return selectedSupplier.name;
    // Fallback: show loading or ID if supplier not found yet
    if (value !== null && value > 0) {
      return loading ? 'Loading...' : `Supplier #${value}`;
    }
    return '';
  }, [selectedSpecialOption, selectedSupplier, value, loading]);

  const getDisplayColor = () => {
    if (selectedSpecialOption) return selectedSpecialOption.color;
    return '';
  };

  // Sync input value with selected supplier when not open
  // Wait for suppliers to load before syncing to prevent race condition
  useEffect(() => {
    if (!isOpen && !loading) {
      setInputValue(getSelectedDisplayName());
    }
  }, [isOpen, loading, getSelectedDisplayName]);

  // Calculate dropdown position relative to viewport
  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, 192), // min-width 192px (w-48)
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
        setInputValue(getSelectedDisplayName());
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, getSelectedDisplayName]);

  // Filter term is the input value when dropdown is open
  const searchTerm = isOpen ? inputValue : '';

  // Filter suppliers and special options based on search term
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSpecialOptions = useMemo(() => {
    if (!searchTerm) return SPECIAL_OPTIONS;
    const term = searchTerm.toLowerCase();
    return SPECIAL_OPTIONS.filter(o =>
      o.name.toLowerCase().includes(term) ||
      o.description.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const handleSelect = useCallback((supplierId: number | null) => {
    onChange(supplierId);
    setIsOpen(false);
  }, [onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setInputValue('');
    setIsOpen(false);
  }, [onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    // Select all text for easy replacement
    inputRef.current?.select();
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setInputValue(getSelectedDisplayName());
      inputRef.current?.blur();
    }
  }, [getSelectedDisplayName]);

  // Disabled state rendering
  if (disabled) {
    const displayName = getSelectedDisplayName();
    const displayColor = getDisplayColor();
    return (
      <span className={`text-xs px-1 ${displayColor || PAGE_STYLES.panel.textMuted}`}>
        {displayName || '-'}
      </span>
    );
  }

  const displayColor = getDisplayColor();

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input box - serves as both display and search */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Loading...' : placeholder}
          className={`w-full px-1.5 py-1.5 pr-8 text-xs border rounded-none
            ${displayColor && !isOpen ? displayColor : PAGE_STYLES.input.text}
            bg-white border-gray-300 hover:border-gray-400
            focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
        />
        <div className="absolute right-1 flex items-center gap-0.5">
          {showClear && value && (
            <X
              className="w-3 h-3 text-gray-400 hover:text-gray-600 cursor-pointer"
              onClick={handleClear}
            />
          )}
          <ChevronDown
            className={`w-3 h-3 text-gray-400 cursor-pointer transition-transform ${isOpen ? 'rotate-180' : ''}`}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                setInputValue(getSelectedDisplayName());
              } else {
                setIsOpen(true);
                inputRef.current?.focus();
              }
            }}
          />
        </div>
      </div>

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
        >
          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-2 text-xs text-gray-500">Loading...</div>
            ) : (filteredSuppliers.length === 0 && filteredSpecialOptions.length === 0) ? (
              <div className="px-3 py-2 text-xs text-gray-500">
                {searchTerm ? 'No matches' : 'No vendors available'}
              </div>
            ) : (
              <>
                {/* Clear option */}
                {showClear && value && (
                  <button
                    type="button"
                    onClick={() => handleSelect(null)}
                    className="w-full px-3 py-1.5 text-xs text-left text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                  >
                    Clear selection
                  </button>
                )}

                {/* Special options (In Stock, In House) */}
                {filteredSpecialOptions.length > 0 && (
                  <>
                    {filteredSpecialOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSelect(option.id)}
                        className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 flex items-center gap-2
                          ${option.id === value ? 'bg-gray-100' : ''}`}
                      >
                        {option.icon === 'package' ? (
                          <Package className={`w-3 h-3 ${option.color}`} />
                        ) : (
                          <Printer className={`w-3 h-3 ${option.color}`} />
                        )}
                        <div>
                          <span className={`font-medium ${option.color}`}>{option.name}</span>
                          <span className="text-gray-400 ml-1">- {option.description}</span>
                        </div>
                      </button>
                    ))}
                    {filteredSuppliers.length > 0 && (
                      <div className="border-t border-gray-100 my-1" />
                    )}
                  </>
                )}

                {/* Regular suppliers */}
                {filteredSuppliers.map((supplier) => (
                  <button
                    key={supplier.supplier_id}
                    type="button"
                    onClick={() => handleSelect(supplier.supplier_id)}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-blue-50
                      ${supplier.supplier_id === value ? 'bg-blue-100 text-blue-700' : ''}`}
                  >
                    {supplier.name}
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

export default SupplierDropdown;
