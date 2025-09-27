import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

interface VinylCombination {
  brand: string;
  series: string;
  colour_number: string;
  colour_name: string;
  display_colour?: string;
  default_width?: number;
  suppliers?: string;
}

interface CombinedVinylDropdownProps {
  label: string;
  value: {
    brand: string;
    series: string;
    colour_number: string;
    colour_name: string;
  };
  onChange: (value: {
    brand: string;
    series: string;
    colour_number: string;
    colour_name: string;
  }) => void;
  combinations: VinylCombination[];
  placeholder?: string;
  required?: boolean;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  onTab?: () => void;
  onSuggestionsNeeded?: () => void;
}

export const CombinedVinylDropdown: React.FC<CombinedVinylDropdownProps> = ({
  label,
  value,
  onChange,
  combinations,
  placeholder = 'Search vinyl products...',
  required = false,
  loading = false,
  disabled = false,
  className = '',
  name,
  onTab,
  onSuggestionsNeeded
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  // Format combination into display string: "{Brand} {Series}-{Code} {Name}"
  const formatCombination = useCallback((combo: VinylCombination): string => {
    const brandSeries = `${combo.brand} ${combo.series}`;
    const codeNamePart = combo.colour_number && combo.colour_name ? 
      `${combo.colour_number} ${combo.colour_name}` : 
      (combo.colour_number || combo.colour_name || '');
    
    return codeNamePart ? `${brandSeries}-${codeNamePart}` : brandSeries;
  }, []);

  // Parse display string back into components
  const parseCombination = useCallback((displayString: string): { brand: string; series: string; colour_number: string; colour_name: string } => {
    // Find the combination that matches this display string
    const matchingCombo = combinations.find(combo => formatCombination(combo) === displayString);
    
    if (matchingCombo) {
      return {
        brand: matchingCombo.brand,
        series: matchingCombo.series,
        colour_number: matchingCombo.colour_number,
        colour_name: matchingCombo.colour_name
      };
    }
    
    // Fallback parsing if no exact match found
    return { brand: '', series: '', colour_number: '', colour_name: '' };
  }, [combinations, formatCombination]);

  // Get current display value
  const getCurrentDisplayValue = useCallback((): string => {
    if (!value.brand && !value.series && !value.colour_number && !value.colour_name) {
      return '';
    }
    return formatCombination(value as VinylCombination);
  }, [value, formatCombination]);

  // Filter combinations based on search term
  useEffect(() => {
    const searchValue = searchTerm.toLowerCase();
    const formatted = combinations
      .map(formatCombination)
      .filter(formatted => 
        formatted.toLowerCase().includes(searchValue)
      )
      .sort();
    
    setFilteredOptions(formatted);
    setHighlightedIndex(-1);
  }, [searchTerm, combinations, formatCombination]);

  // Calculate dropdown position relative to viewport
  const updateDropdownPosition = () => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    setDropdownPosition({
      top: rect.bottom + scrollTop + 4,
      left: rect.left + scrollLeft,
      width: rect.width
    });
  };

  // Update position when dropdown opens or on scroll/resize
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      
      const handleScroll = () => updateDropdownPosition();
      const handleResize = () => updateDropdownPosition();
      
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onSuggestionsNeeded?.();

    const trimmed = newValue.trim();
    const hasSelection = value.brand || value.series || value.colour_number || value.colour_name;

    if (!trimmed && hasSelection) {
      onChange({ brand: '', series: '', colour_number: '', colour_name: '' });
      justSelectedRef.current = false;
    }
    
    if (!isOpen && newValue) {
      setIsOpen(true);
    }
  };

  const handleInputBlur = () => {
    const trimmed = searchTerm.trim();
    const hasSelection = value.brand || value.series || value.colour_number || value.colour_name;

    if (!trimmed && hasSelection) {
      onChange({ brand: '', series: '', colour_number: '', colour_name: '' });
      setSearchTerm('');
      justSelectedRef.current = false;
    }
  };

  const handleInputFocus = () => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    
    const currentValue = getCurrentDisplayValue();
    setSearchTerm(currentValue);
    onSuggestionsNeeded?.();
    
    if (combinations.length > 0) {
      setIsOpen(true);
    }
  };

  const handleOptionSelect = (option: string) => {
    const parsed = parseCombination(option);
    onChange(parsed);
    setSearchTerm(option);
    setIsOpen(false);
    justSelectedRef.current = true;
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && filteredOptions.length > 0) {
        onSuggestionsNeeded?.();
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleOptionSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        setHighlightedIndex(-1);
        
        if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          e.preventDefault();
          handleOptionSelect(filteredOptions[highlightedIndex]);
          setTimeout(() => {
            if (onTab) onTab();
          }, 0);
        } else if (isOpen && filteredOptions.length > 0) {
          e.preventDefault();
          handleOptionSelect(filteredOptions[0]);
          setTimeout(() => {
            if (onTab) onTab();
          }, 0);
        } else if (onTab) {
          e.preventDefault();
          setTimeout(onTab, 0);
        }
        break;
    }
  };

  // Initialize search term with current value when component mounts or value changes
  useEffect(() => {
    setSearchTerm(prev => {
      if (prev) {
        return prev;
      }
      return getCurrentDisplayValue();
    });
  }, [value, getCurrentDisplayValue]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          name={name}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
        
        <div
          onClick={() => {
            if (disabled) return;
            if (isOpen) {
              setIsOpen(false);
            } else {
              const currentValue = getCurrentDisplayValue();
              setSearchTerm(currentValue);
              onSuggestionsNeeded?.();
              setIsOpen(combinations.length > 0);
            }
          }}
          className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-lg"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            maxHeight: '320px',
            overflowY: 'auto'
          }}
        >
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-500">Loading vinyl products...</div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {!combinations || combinations.length === 0
                ? 'Type to search products...'
                : searchTerm
                  ? 'No matching products found'
                  : 'Type to search products'}
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={option}
                onClick={() => handleOptionSelect(option)}
                className={`px-3 py-2 cursor-pointer text-sm flex items-center justify-between ${
                  index === highlightedIndex 
                    ? 'bg-purple-50 text-purple-600' 
                    : 'text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span>{option}</span>
                {option === getCurrentDisplayValue() && (
                  <Check className="h-4 w-4 text-purple-600" />
                )}
              </div>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
