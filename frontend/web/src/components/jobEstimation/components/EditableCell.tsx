/**
 * EditableCell Component
 *
 * Reusable inline-editable cell for table-based editing.
 * Supports text, number, currency, and textarea types.
 *
 * Features:
 * - Local state for smooth editing experience
 * - Dirty state indicator (blue border when modified)
 * - Auto-save on blur
 * - Escape to revert, Enter to commit (for non-textarea)
 * - Auto-resize for textarea type
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PAGE_STYLES } from '../../../constants/moduleColors';

export interface EditableCellProps {
  value: string | number | null;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'currency' | 'textarea';
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const EditableCell: React.FC<EditableCellProps> = ({
  value,
  onChange,
  type = 'text',
  disabled = false,
  placeholder,
  className = ''
}) => {
  const [localValue, setLocalValue] = useState(String(value ?? ''));
  const [isDirty, setIsDirty] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(String(value ?? ''));
    setIsDirty(false);
  }, [value]);

  // Textarea auto-resize effect
  const textareaRef = inputRef as React.RefObject<HTMLTextAreaElement>;
  useEffect(() => {
    if (type === 'textarea' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [localValue, type]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
    setIsDirty(e.target.value !== String(value ?? ''));
  }, [value]);

  const handleBlur = useCallback(() => {
    if (isDirty) {
      onChange(localValue);
      setIsDirty(false);
    }
  }, [isDirty, localValue, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setLocalValue(String(value ?? ''));
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
    // For textarea type, preserve newlines in read-only mode
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

    return (
      <span className={`${PAGE_STYLES.panel.textMuted} text-xs px-1`}>
        {type === 'currency' ? (value ? `$${value}` : '') : value || ''}
      </span>
    );
  }

  const baseClasses = `w-full px-1 py-0.5 text-xs border-2 rounded ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder}
    ${isDirty ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50 hover:border-green-600'}
    focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-500`;

  if (type === 'textarea') {
    return (
      <textarea
        ref={textareaRef}
        value={localValue}
        onChange={(e) => {
          handleChange(e);
          adjustHeight(e.target);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        rows={1}
        className={`w-full px-2 py-1.5 text-xs border-2 rounded resize-none overflow-hidden ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder}
          ${isDirty ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50 hover:border-green-600'}
          focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-500 ${className}`}
        placeholder={placeholder}
        style={{ minHeight: '32px' }}
        onFocus={(e) => adjustHeight(e.target)}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={type === 'number' || type === 'currency' ? 'number' : 'text'}
      step={type === 'currency' ? '0.01' : type === 'number' ? '0.01' : undefined}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`${baseClasses} ${className}`}
      placeholder={placeholder}
    />
  );
};

export default EditableCell;
