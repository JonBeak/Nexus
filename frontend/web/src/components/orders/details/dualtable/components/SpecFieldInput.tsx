/**
 * SpecFieldInput Component
 * Extracted from DualTableLayout.tsx (Phase 1)
 *
 * Dynamic input for specification fields (dropdown, combobox, boolean, textbox)
 * Renders different input types based on field configuration
 */

import React, { useState, useEffect } from 'react';
import { getValidSpecFieldClass, EMPTY_FIELD_BG_CLASS } from '@/utils/highlightStyles';
import type { SpecificationField } from '@/config/orderProductTemplates';

interface SpecFieldInputProps {
  partId: number;
  rowNum: number;
  field: SpecificationField;
  specKey: string;
  currentValue: any;
  onSave: (partId: number, specKey: string, value: string) => Promise<void>;
  hasValue: boolean;
  isEmpty?: boolean;
}

export const SpecFieldInput = React.memo<SpecFieldInputProps>(({
  partId,
  rowNum,
  field,
  specKey,
  currentValue,
  onSave,
  hasValue,
  isEmpty = false
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [localValue, setLocalValue] = useState(currentValue);

  // Update local value when prop changes (from server)
  useEffect(() => {
    setLocalValue(currentValue);
  }, [currentValue]);

  const handleDropdownChange = async (value: string) => {
    if (!isSaving) {
      setIsSaving(true);
      try {
        await onSave(partId, specKey, value);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleTextBlur = async () => {
    // Only save if value changed
    if (localValue !== currentValue && !isSaving) {
      setIsSaving(true);
      try {
        await onSave(partId, specKey, localValue);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const baseClass = `w-full h-[26px] px-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
    !hasValue ? 'text-gray-400' : 'text-gray-900'
  } ${isEmpty ? EMPTY_FIELD_BG_CLASS : ''}`;

  return (
    <div className="h-[26px] flex items-center py-1">
      {field.type === 'dropdown' && field.options ? (
        <select
          value={currentValue}
          onChange={(e) => handleDropdownChange(e.target.value)}
          className={getValidSpecFieldClass(hasValue, baseClass)}
          disabled={isSaving}
        >
          <option value="" className="text-gray-400">{field.placeholder || 'Select...'}</option>
          {field.options.map(opt => (
            <option key={opt} value={opt} className="text-gray-900">{opt}</option>
          ))}
        </select>
      ) : field.type === 'combobox' && field.options ? (
        <>
          <input
            type="text"
            list={`${partId}-${specKey}-datalist`}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleTextBlur}
            className={getValidSpecFieldClass(hasValue, baseClass)}
            placeholder={field.placeholder}
            disabled={isSaving}
          />
          <datalist id={`${partId}-${specKey}-datalist`}>
            {field.options.map(opt => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        </>
      ) : field.type === 'boolean' ? (
        <select
          value={currentValue}
          onChange={(e) => handleDropdownChange(e.target.value)}
          className={getValidSpecFieldClass(hasValue, baseClass)}
          disabled={isSaving}
        >
          <option value="" className="text-gray-400">{field.placeholder || 'Select...'}</option>
          <option value="true" className="text-gray-900">Yes</option>
          <option value="false" className="text-gray-900">No</option>
        </select>
      ) : (
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleTextBlur}
          className={getValidSpecFieldClass(hasValue, baseClass)}
          placeholder={field.placeholder}
          disabled={isSaving}
        />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.currentValue === nextProps.currentValue &&
         prevProps.hasValue === nextProps.hasValue &&
         prevProps.partId === nextProps.partId &&
         prevProps.specKey === nextProps.specKey &&
         prevProps.rowNum === nextProps.rowNum &&
         prevProps.field.key === nextProps.field.key &&
         prevProps.field.type === nextProps.field.type &&
         prevProps.isEmpty === nextProps.isEmpty;
});

SpecFieldInput.displayName = 'SpecFieldInput';
