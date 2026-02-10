/**
 * ProductTypeDropdown Component
 *
 * Searchable product type (archetype) selection dropdown for inline use in tables.
 * Fetches archetypes from API and provides filtered selection grouped by category.
 * Renders dropdown via portal to avoid table overflow clipping.
 * Input box serves as both display and search field (combobox pattern).
 *
 * Features:
 * - Type to search/filter archetypes by name
 * - Archetypes grouped by category
 * - Special "Vinyl" option (archetype_id = 131)
 * - Integrates with InlineEditableCell pattern
 * - Auto-save on selection
 * - Portal rendering to escape table overflow
 *
 * Special Archetype IDs:
 * - ARCHETYPE_VINYL (131): Vinyl product selection
 * - ARCHETYPE_DIGITAL_PRINT (132): Digital print media selection
 */

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Layers, Printer } from 'lucide-react';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';
import { archetypesApi } from '../../../services/api';
import type { ProductArchetype } from '../../../types/materialRequirements';

/** Vinyl archetype ID - real archetype in database */
export const ARCHETYPE_VINYL = 131;
/** Digital Print archetype ID - real archetype in database */
export const ARCHETYPE_DIGITAL_PRINT = 132;

export interface ProductTypeDropdownProps {
  value: number | null;
  onChange: (archetypeId: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showClear?: boolean;
  /** Pre-loaded archetypes (optional - loads internally if not provided) */
  archetypes?: ProductArchetype[];
}

export const ProductTypeDropdown: React.FC<ProductTypeDropdownProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select product type...',
  className = '',
  showClear = true,
  archetypes: externalArchetypes,
}) => {
  const [internalArchetypes, setInternalArchetypes] = useState<ProductArchetype[]>([]);
  const archetypes = externalArchetypes ?? internalArchetypes;
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load archetypes on mount (skip if provided externally)
  useEffect(() => {
    if (externalArchetypes) {
      setLoading(false);
      return;
    }

    const loadArchetypes = async () => {
      try {
        setLoading(true);
        const data = await archetypesApi.getArchetypes({ active_only: true });
        setInternalArchetypes(data);
      } catch (error) {
        console.error('Failed to load archetypes:', error);
      } finally {
        setLoading(false);
      }
    };
    void loadArchetypes();
  }, [externalArchetypes]);

  const selectedArchetype = archetypes.find(a => a.archetype_id === value);
  const isVinylSelected = value === ARCHETYPE_VINYL;
  const isDigitalPrintSelected = value === ARCHETYPE_DIGITAL_PRINT;

  // Get display name for current value
  const getSelectedDisplayName = useCallback((): string => {
    if (isVinylSelected) return 'Vinyl';
    if (isDigitalPrintSelected) return 'Digital Print';
    if (selectedArchetype) return selectedArchetype.name;
    // Fallback: show loading or ID if archetype not found yet
    if (value !== null && value > 0) {
      return loading ? 'Loading...' : `Type #${value}`;
    }
    return '';
  }, [isVinylSelected, isDigitalPrintSelected, selectedArchetype, value, loading]);

  const getDisplayColor = () => {
    if (isVinylSelected) return MODULE_COLORS.vinyls.text;
    if (isDigitalPrintSelected) return 'text-cyan-600';
    return '';
  };

  // Sync input value with selected archetype when not open
  // Wait for archetypes to load before syncing to prevent race condition
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
      width: Math.max(rect.width, 220),
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

    window.addEventListener('scroll', handleScroll, true);
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

  // Group archetypes by category_name
  const groupedArchetypes = useMemo(() => {
    const groups: Record<string, ProductArchetype[]> = {};
    const words = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);

    archetypes
      .filter(a => a.archetype_id !== ARCHETYPE_VINYL && a.archetype_id !== ARCHETYPE_DIGITAL_PRINT)
      .filter(a => {
        if (words.length === 0) return true;
        const name = a.name.toLowerCase();
        const category = a.category_name.toLowerCase();
        return words.every(w => name.includes(w) || category.includes(w));
      })
      .forEach(archetype => {
        const categoryKey = archetype.category_name;
        if (!groups[categoryKey]) {
          groups[categoryKey] = [];
        }
        groups[categoryKey].push(archetype);
      });

    return groups;
  }, [archetypes, searchTerm]);

  // Check if special options match search term
  const showVinylOption = useMemo(() => {
    if (!searchTerm) return true;
    const words = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    return words.every(w => 'vinyl'.includes(w));
  }, [searchTerm]);

  const showDigitalPrintOption = useMemo(() => {
    if (!searchTerm) return true;
    const words = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    return words.every(w => 'digital print'.includes(w));
  }, [searchTerm]);

  const handleSelect = useCallback((archetypeId: number | null) => {
    onChange(archetypeId);
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

  const categoryCount = Object.keys(groupedArchetypes).length;
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
            ${displayColor && !isOpen ? `${displayColor} font-semibold` : PAGE_STYLES.input.text}
            bg-white border-gray-300 hover:border-gray-400
            focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
        />
        <div className="absolute right-1 flex items-center gap-0.5">
          {showClear && value !== null && (
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

      {/* Dropdown panel - rendered via portal */}
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
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-2 text-xs text-gray-500">Loading...</div>
            ) : (categoryCount === 0 && !showVinylOption && !showDigitalPrintOption) ? (
              <div className="px-3 py-2 text-xs text-gray-500">
                {searchTerm ? 'No matches' : 'No product types available'}
              </div>
            ) : (
              <>
                {/* Clear option */}
                {showClear && value !== null && (
                  <button
                    type="button"
                    onClick={() => handleSelect(null)}
                    className="w-full px-3 py-1.5 text-xs text-left text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                  >
                    Clear selection
                  </button>
                )}

                {/* Special pinned options (Vinyl, Digital Print) */}
                {showVinylOption && (
                  <button
                    type="button"
                    onClick={() => handleSelect(ARCHETYPE_VINYL)}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-purple-50 flex items-center gap-2
                      ${isVinylSelected ? MODULE_COLORS.vinyls.light : ''}`}
                  >
                    <Layers className={`w-3 h-3 ${MODULE_COLORS.vinyls.text}`} />
                    <div>
                      <span className={`font-medium ${MODULE_COLORS.vinyls.text}`}>Vinyl</span>
                      <span className="text-gray-400 ml-1">- Sign vinyl products</span>
                    </div>
                  </button>
                )}
                {showDigitalPrintOption && (
                  <button
                    type="button"
                    onClick={() => handleSelect(ARCHETYPE_DIGITAL_PRINT)}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-cyan-50 flex items-center gap-2
                      ${isDigitalPrintSelected ? 'bg-cyan-100' : ''}`}
                  >
                    <Printer className="w-3 h-3 text-cyan-600" />
                    <div>
                      <span className="font-medium text-cyan-600">Digital Print</span>
                      <span className="text-gray-400 ml-1">- Digital print substrates</span>
                    </div>
                  </button>
                )}
                {(showVinylOption || showDigitalPrintOption) && categoryCount > 0 && (
                  <div className="border-t border-gray-100 my-1" />
                )}

                {/* Archetypes grouped by category */}
                {Object.entries(groupedArchetypes).map(([category, items]) => (
                  <div key={category}>
                    {/* Category header */}
                    <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">
                      {category}
                    </div>
                    {/* Category items */}
                    {items.map((archetype) => (
                      <button
                        key={archetype.archetype_id}
                        type="button"
                        onClick={() => handleSelect(archetype.archetype_id)}
                        className={`w-full px-3 py-1.5 text-xs text-left hover:bg-blue-50
                          ${archetype.archetype_id === value ? 'bg-blue-100 text-blue-700' : ''}`}
                      >
                        <span>{archetype.name}</span>
                        {archetype.subcategory && (
                          <span className="text-gray-400 ml-1">({archetype.subcategory})</span>
                        )}
                      </button>
                    ))}
                  </div>
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

export default ProductTypeDropdown;
