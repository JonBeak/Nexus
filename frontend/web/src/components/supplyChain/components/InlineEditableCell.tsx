/**
 * InlineEditableCell Component
 *
 * Reusable inline-editable cell for table-based editing in supply chain tables.
 * Extended from EditableCell pattern with additional support for:
 * - Select dropdowns
 * - Date pickers
 * - Toggle/radio for boolean values
 *
 * Features:
 * - Local state for smooth editing experience
 * - Dirty state indicator (blue border when modified)
 * - Auto-save on blur
 * - Escape to revert, Enter to commit (for non-textarea)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';

export type CellType = 'text' | 'number' | 'textarea' | 'select' | 'date' | 'toggle';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface InlineEditableCellProps {
  value: string | number | boolean | null;
  onChange: (value: string | number | boolean) => void;
  type?: CellType;
  options?: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultToToday?: boolean;
}

export const InlineEditableCell: React.FC<InlineEditableCellProps> = ({
  value,
  onChange,
  type = 'text',
  options = [],
  disabled = false,
  placeholder,
  className = '',
  min,
  max,
  step = 1,
  defaultToToday = false,
}) => {
  const [localValue, setLocalValue] = useState<string>(formatValue(value, type));
  const [isDirty, setIsDirty] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  // Format value for display
  function formatValue(val: string | number | boolean | null, cellType: CellType): string {
    if (val === null || val === undefined) return '';
    if (cellType === 'toggle') return String(val);
    if (cellType === 'date' && val) {
      // Format date for input
      const dateStr = String(val);
      if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }
      return dateStr;
    }
    return String(val);
  }

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(formatValue(value, type));
    setIsDirty(false);
  }, [value, type]);

  // Textarea auto-resize effect
  useEffect(() => {
    if (type === 'textarea' && inputRef.current) {
      const textarea = inputRef.current as HTMLTextAreaElement;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [localValue, type]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    setIsDirty(newValue !== formatValue(value, type));
  }, [value, type]);

  const handleBlur = useCallback(() => {
    if (isDirty) {
      let outputValue: string | number | boolean = localValue;

      // Convert to appropriate type
      if (type === 'number') {
        outputValue = localValue === '' ? 0 : parseFloat(localValue);
      } else if (type === 'toggle') {
        outputValue = localValue === 'true';
      }

      onChange(outputValue);
      setIsDirty(false);
    }
  }, [isDirty, localValue, onChange, type]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setLocalValue(formatValue(value, type));
      setIsDirty(false);
      (e.target as HTMLElement).blur();
    }
    if (e.key === 'Enter' && type !== 'textarea') {
      (e.target as HTMLElement).blur();
    }
  }, [value, type]);

  const adjustHeight = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  // Disabled state rendering
  if (disabled) {
    if (type === 'textarea' && value) {
      return (
        <div className={`${PAGE_STYLES.panel.textMuted} text-xs px-1`}>
          {String(value).split('\n').map((line, i) => (
            <div key={i} className="leading-tight">
              {line || '\u00A0'}
            </div>
          ))}
        </div>
      );
    }

    if (type === 'toggle') {
      return (
        <span className={`${PAGE_STYLES.panel.textMuted} text-xs px-1`}>
          {value ? 'Yes' : 'No'}
        </span>
      );
    }

    if (type === 'select') {
      const selectedOption = options.find(opt => String(opt.value) === String(value));
      return (
        <span className={`${PAGE_STYLES.panel.textMuted} text-xs px-1`}>
          {selectedOption?.label || value || '-'}
        </span>
      );
    }

    if (type === 'date' && value) {
      const dateStr = String(value);
      const displayDate = new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return (
        <span className={`${PAGE_STYLES.panel.textMuted} text-xs px-1`}>
          {displayDate}
        </span>
      );
    }

    return (
      <span className={`${PAGE_STYLES.panel.textMuted} text-xs px-1`}>
        {value || ''}
      </span>
    );
  }

  const baseInputClasses = `w-full px-1.5 py-1.5 text-xs border rounded-none ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder}
    ${isDirty ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'}
    focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`;

  // Toggle (boolean) rendering
  if (type === 'toggle') {
    return (
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name={`toggle-${Math.random()}`}
            checked={localValue === 'true'}
            onChange={() => {
              setLocalValue('true');
              setIsDirty(true);
              onChange(true);
            }}
            className="w-3 h-3"
          />
          <span className="text-xs">Yes</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name={`toggle-${Math.random()}`}
            checked={localValue === 'false' || localValue === ''}
            onChange={() => {
              setLocalValue('false');
              setIsDirty(true);
              onChange(false);
            }}
            className="w-3 h-3"
          />
          <span className="text-xs">No</span>
        </label>
      </div>
    );
  }

  // Select dropdown rendering
  if (type === 'select') {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={localValue}
        onChange={(e) => {
          handleChange(e);
          // For selects, trigger save immediately on change
          const newValue = e.target.value;
          if (newValue !== formatValue(value, type)) {
            onChange(newValue);
            setIsDirty(false);
          }
        }}
        onKeyDown={handleKeyDown}
        className={`${baseInputClasses} ${className}`}
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  // Date input rendering - show formatted date, click to edit
  // Wrapped in fixed-width container to prevent native date picker from changing cell size
  if (type === 'date') {
    // Format date for display (Jan 3, 2026)
    const getFormattedDate = () => {
      if (!localValue) return placeholder || '-';
      const date = new Date(localValue + 'T00:00:00'); // Avoid timezone issues
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const handleClearDate = (e: React.MouseEvent) => {
      e.stopPropagation();
      setLocalValue('');
      onChange('');
    };

    return (
      <div className="relative group w-full">
        {/* Button always rendered to maintain consistent size */}
        <button
          type="button"
          onClick={() => {
            if (!localValue && defaultToToday) {
              const now = new Date();
              const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              setLocalValue(today);
              setIsDirty(true);
            }
            setIsEditingDate(true);
          }}
          className={`w-full h-[30px] pl-1 pr-4 text-xs text-left border rounded-none ${PAGE_STYLES.input.text}
            border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50
            focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}
            ${isEditingDate ? 'invisible' : ''}`}
        >
          {getFormattedDate()}
        </button>
        {localValue && !isEditingDate && (
          <button
            type="button"
            onClick={handleClearDate}
            className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Clear date"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {/* Date input overlaid when editing */}
        {isEditingDate && (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="date"
            value={localValue}
            onChange={handleChange}
            onBlur={() => {
              handleBlur();
              setIsEditingDate(false);
            }}
            onKeyDown={(e) => {
              handleKeyDown(e);
              if (e.key === 'Escape') setIsEditingDate(false);
            }}
            className={`absolute inset-0 w-full h-full px-0.5 text-xs border rounded-none ${PAGE_STYLES.input.text}
              ${isDirty ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}
              focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
            min={min ? String(min) : undefined}
            max={max ? String(max) : undefined}
            autoFocus
          />
        )}
      </div>
    );
  }

  // Textarea rendering
  if (type === 'textarea') {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={localValue}
        onChange={(e) => {
          handleChange(e);
          adjustHeight(e.target);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        rows={1}
        className={`w-full px-1.5 py-1.5 text-xs border rounded-none resize-none overflow-hidden ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder}
          ${isDirty ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'}
          focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
        placeholder={placeholder}
        style={{ minHeight: '28px' }}
        onFocus={(e) => adjustHeight(e.target)}
      />
    );
  }

  // Text and Number input rendering
  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={type === 'number' ? 'number' : 'text'}
      step={type === 'number' ? step : undefined}
      min={type === 'number' ? min : undefined}
      max={type === 'number' ? max : undefined}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`${baseInputClasses} ${className}`}
      placeholder={placeholder}
    />
  );
};

export default InlineEditableCell;
