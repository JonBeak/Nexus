/**
 * SpecTemplateDropdown Component
 * Extracted from DualTableLayout.tsx (Phase 1)
 *
 * Dropdown for selecting specification templates
 * Highlighted with gray when a template is selected
 */

import React, { useState } from 'react';
import { getValidSpecTemplateClass } from '@/utils/highlightStyles';

interface SpecTemplateDropdownProps {
  partId: number;
  rowNum: number;
  currentValue: string;
  onSave: (partId: number, rowNum: number, value: string) => Promise<void>;
  availableTemplates: string[];
  hasValue: boolean;
}

export const SpecTemplateDropdown = React.memo<SpecTemplateDropdownProps>(({
  partId,
  rowNum,
  currentValue,
  onSave,
  availableTemplates,
  hasValue
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

  const baseClass = `w-full h-[26px] px-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${
    !currentValue ? 'text-gray-400' : 'text-gray-900 font-bold'
  }`;

  return (
    <div className="h-[26px] flex items-center py-1">
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
         prevProps.rowNum === nextProps.rowNum;
});

SpecTemplateDropdown.displayName = 'SpecTemplateDropdown';
