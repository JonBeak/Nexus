/**
 * EditableInput Component
 * Extracted from DualTableLayout.tsx (Phase 1)
 *
 * Single-line input with blur-to-save functionality
 * Used for quantity and unit_price fields
 */

import React, { useState, useEffect } from 'react';
import { getValidInputClass, EMPTY_FIELD_BG_CLASS } from '@/utils/highlightStyles';

interface EditableInputProps {
  partId: number;
  field: 'quantity' | 'unit_price';
  currentValue: number | null;
  onSave: (partId: number, field: string, value: string) => Promise<void>;
  placeholder: string;
  hasValue: boolean;
  align?: 'left' | 'right';
  applyGrayBackground?: boolean;
}

export const EditableInput = React.memo<EditableInputProps>(({
  partId,
  field,
  currentValue,
  onSave,
  placeholder,
  hasValue,
  align = 'left',
  applyGrayBackground = false
}) => {
  const [localValue, setLocalValue] = useState(currentValue?.toString() ?? '');
  const [isSaving, setIsSaving] = useState(false);

  // Update local value when currentValue changes from parent
  useEffect(() => {
    setLocalValue(currentValue?.toString() ?? '');
  }, [currentValue]);

  const handleBlur = async () => {
    // Only save if value changed
    if (localValue !== (currentValue?.toString() ?? '') && !isSaving) {
      setIsSaving(true);
      try {
        await onSave(partId, field, localValue);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const baseClass = `w-full px-1.5 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${align === 'right' ? 'text-right' : ''} ${applyGrayBackground ? EMPTY_FIELD_BG_CLASS : ''}`;

  return (
    <div className="py-1">
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        className={getValidInputClass(hasValue, baseClass)}
        placeholder={placeholder}
        disabled={isSaving}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return prevProps.currentValue === nextProps.currentValue &&
         prevProps.hasValue === nextProps.hasValue &&
         prevProps.partId === nextProps.partId &&
         prevProps.applyGrayBackground === nextProps.applyGrayBackground;
});

EditableInput.displayName = 'EditableInput';
