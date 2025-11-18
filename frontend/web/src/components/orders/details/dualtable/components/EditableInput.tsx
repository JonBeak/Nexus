/**
 * EditableInput Component
 * Extracted from DualTableLayout.tsx (Phase 1)
 *
 * Single-line input with blur-to-save functionality
 * Used for quantity and unit_price fields
 */

import React, { useState, useEffect } from 'react';
import { getValidInputClass } from '@/utils/highlightStyles';
import { INPUT_STYLES } from '@/utils/inputStyles';

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

  const baseClass = INPUT_STYLES.textInput({ align, applyGrayBackground });

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
