/**
 * SpecTemplateDropdown Component
 * Extracted from DualTableLayout.tsx (Phase 1)
 *
 * Dropdown for selecting specification templates
 * Highlighted with gray when a template is selected
 */

import React, { useState } from 'react';
import { getValidSpecTemplateClass } from '@/utils/highlightStyles';
import { INPUT_STYLES } from '@/utils/inputStyles';

interface SpecTemplateDropdownProps {
  partId: number;
  rowNum: number;
  currentValue: string;
  onSave: (partId: number, rowNum: number, value: string) => Promise<void>;
  availableTemplates: string[];
  hasValue: boolean;
  isEmpty?: boolean;
}

export const SpecTemplateDropdown = React.memo<SpecTemplateDropdownProps>(({
  partId,
  rowNum,
  currentValue,
  onSave,
  availableTemplates,
  hasValue,
  isEmpty = false
}) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (value: string) => {
    if (!isSaving) {
      setIsSaving(true);
      try {
        await onSave(partId, rowNum, value);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const baseClass = INPUT_STYLES.specTemplateDropdown({
    hasValue: !!currentValue,
    isEmpty,
  });

  return (
    <div className="h-[26px] flex items-center">
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className={getValidSpecTemplateClass(hasValue, baseClass)}
        disabled={isSaving}
      >
        <option value="" className="text-gray-400">Select...</option>
        {availableTemplates.map((templateName) => (
          <option key={templateName} value={templateName} className="text-gray-900">
            {templateName}
          </option>
        ))}
      </select>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.currentValue === nextProps.currentValue &&
         prevProps.hasValue === nextProps.hasValue &&
         prevProps.partId === nextProps.partId &&
         prevProps.rowNum === nextProps.rowNum &&
         prevProps.isEmpty === nextProps.isEmpty;
});

SpecTemplateDropdown.displayName = 'SpecTemplateDropdown';
