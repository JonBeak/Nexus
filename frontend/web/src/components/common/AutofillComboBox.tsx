import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

interface AutofillComboBoxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  onTab?: () => void;
}

export const AutofillComboBox: React.FC<AutofillComboBoxProps> = ({
  label,
  value,
  onChange,
  suggestions,
  placeholder = '',
  required = false,
  loading = false,
  disabled = false,
  className = '',
  name,
  onTab
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    // Filter suggestions based on current input - show suggestions that CONTAIN the typed text
    const searchValue = (value || '').toLowerCase();
    const filtered = suggestions.filter(suggestion =>
      suggestion === '---' || // Always include the clear filter option
      (suggestion && suggestion.toLowerCase().includes(searchValue))
    );
    setFilteredSuggestions(filtered);
    setHighlightedIndex(-1);
  }, [value, suggestions]);

  // Calculate dropdown position relative to viewport
  const updateDropdownPosition = () => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    setDropdownPosition({
      top: rect.bottom + scrollTop + 4, // 4px gap like mt-1
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
      
      window.addEventListener('scroll', handleScroll, true); // Capture phase for nested scrollers
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

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
    onChange(newValue);
    if (!isOpen && newValue) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    // Don't reopen immediately after a selection
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    
    // Always show suggestions when focusing if we have any suggestions available
    // This ensures suggestions reappear when user clicks back into the field
    if (suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setIsOpen(false);
    justSelectedRef.current = true;
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
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
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
          handleSuggestionClick(filteredSuggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        // Always close dropdown first
        setIsOpen(false);
        setHighlightedIndex(-1);
        
        // If dropdown is open and we have suggestions, select one
        if (isOpen && highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
          e.preventDefault();
          handleSuggestionClick(filteredSuggestions[highlightedIndex]);
          // Use custom onTab handler if provided, otherwise use default behavior
          setTimeout(() => {
            if (onTab) {
              onTab();
            } else {
              // Default form navigation
              const form = inputRef.current?.form;
              if (form) {
                const elements = Array.from(form.elements).filter((el: any) => 
                  el.type !== 'hidden' && !el.disabled && el.tabIndex >= 0
                ) as HTMLElement[];
                const currentIndex = elements.indexOf(inputRef.current as HTMLElement);
                const nextElement = elements[currentIndex + 1] as HTMLInputElement;
                if (nextElement && nextElement.focus) {
                  nextElement.focus();
                }
              }
            }
          }, 0);
        } else if (isOpen && filteredSuggestions.length > 0) {
          e.preventDefault();
          handleSuggestionClick(filteredSuggestions[0]);
          // Use custom onTab handler if provided
          setTimeout(() => {
            if (onTab) {
              onTab();
            } else {
              // Default form navigation
              const form = inputRef.current?.form;
              if (form) {
                const elements = Array.from(form.elements).filter((el: any) => 
                  el.type !== 'hidden' && !el.disabled && el.tabIndex >= 0
                ) as HTMLElement[];
                const currentIndex = elements.indexOf(inputRef.current as HTMLElement);
                const nextElement = elements[currentIndex + 1] as HTMLInputElement;
                if (nextElement && nextElement.focus) {
                  nextElement.focus();
                }
              }
            }
          }, 0);
        } else if (onTab) {
          // If no dropdown interaction but custom onTab provided, use it
          e.preventDefault();
          setTimeout(onTab, 0);
        }
        // Otherwise let tab behave normally (don't preventDefault)
        break;
    }
  };

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
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
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
              // When opening dropdown, show all available suggestions
              setIsOpen(suggestions.length > 0 || value.trim().length > 0);
            }
          }}
          className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (filteredSuggestions.length > 0 || loading) && createPortal(
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
            <div className="px-3 py-2 text-sm text-gray-500">Loading suggestions...</div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No suggestions found</div>
          ) : (
            filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className={`px-3 py-2 cursor-pointer text-sm flex items-center justify-between ${
                  index === highlightedIndex 
                    ? 'bg-purple-50 text-purple-600' 
                    : 'text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span>{suggestion}</span>
                {suggestion === value && (
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