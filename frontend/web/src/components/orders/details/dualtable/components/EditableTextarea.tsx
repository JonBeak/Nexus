/**
 * EditableTextarea Component
 * Extracted from DualTableLayout.tsx (Phase 1)
 *
 * Auto-resizing textarea with blur-to-save functionality
 * Used for invoice_description and qb_description fields
 */

import React, { useState, useEffect, useRef } from 'react';
import { getValidInputClass } from '@/utils/highlightStyles';

interface EditableTextareaProps {
  partId: number;
  field: 'invoice_description' | 'qb_description';
  currentValue: string;
  onSave: (partId: number, field: string, value: string) => Promise<void>;
  placeholder: string;
  hasValue: boolean;
}

export const EditableTextarea = React.memo<EditableTextareaProps>(({
  partId,
  field,
  currentValue,
  onSave,
  placeholder,
  hasValue
}) => {
  const [localValue, setLocalValue] = useState(currentValue ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Update local value when currentValue changes from parent
  useEffect(() => {
    setLocalValue(currentValue ?? '');
  }, [currentValue]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [localValue]);

  const handleBlur = async () => {
    // Only save if value changed
    if (localValue !== currentValue && !isSaving) {
      setIsSaving(true);
      try {
        await onSave(partId, field, localValue);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const baseClass = field === 'invoice_description'
    ? 'w-full px-1.5 py-1 text-sm text-gray-600 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none overflow-hidden bg-gray-50'
    : 'w-full px-1.5 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none overflow-hidden';

  const className = field === 'qb_description'
    ? getValidInputClass(hasValue, baseClass)
    : baseClass;

  return (
    <div className="py-1 w-full">
      <textarea
        ref={textareaRef}
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          // Auto-resize on input
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
          }
        }}
        onBlur={handleBlur}
        className={className}
        placeholder={placeholder}
        rows={1}
        style={{ minHeight: '26px' }}
        disabled={isSaving}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return prevProps.currentValue === nextProps.currentValue &&
         prevProps.hasValue === nextProps.hasValue &&
         prevProps.partId === nextProps.partId;
});

EditableTextarea.displayName = 'EditableTextarea';
