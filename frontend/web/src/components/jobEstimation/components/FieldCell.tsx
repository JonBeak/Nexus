/**
 * FieldCell - Individual field input component
 * Matches original ProductFieldRenderer styling with blur-only validation
 * Simplified for Base Layer - no complex validation or styling
 */

import React, { useState, useEffect } from 'react';

interface FieldCellProps {
  fieldName: string;
  fieldValue: string;
  fieldType: 'text' | 'number' | 'select';
  placeholder?: string;
  isEditable: boolean;
  onCommit: (value: string) => void;
  options?: string[]; // For select fields
  staticDataCache?: Record<string, any[]>; // Database options cache
  fieldPrompt?: string; // Meaningful label like "Type", "Inches"
  fieldEnabled?: boolean; // Whether field is active (default: true)
  validationState?: 'error' | 'warning' | 'valid'; // Placeholder for validation
}

export const FieldCell: React.FC<FieldCellProps> = ({
  fieldName,
  fieldValue,
  fieldType,
  placeholder = '',
  isEditable,
  onCommit,
  options,
  staticDataCache,
  fieldPrompt,
  fieldEnabled = true,
  validationState = 'valid'
}) => {
  // Local state for blur-only validation pattern
  const [localValue, setLocalValue] = useState(fieldValue);
  
  // Update local value when fieldValue changes externally
  useEffect(() => {
    setLocalValue(fieldValue);
  }, [fieldValue]);

  // Commit handler - only updates on blur
  const handleCommit = () => {
    if (localValue !== fieldValue) {
      onCommit(localValue);
    }
  };

  // Don't render anything if field is disabled
  if (!fieldEnabled) {
    return null;
  }

  if (!isEditable) {
    // Read-only display
    return (
      <div className="w-full px-2 py-1 text-xs text-gray-600 text-center">
        {fieldValue || '-'}
      </div>
    );
  }

  // Base field classes with validation state styling
  const getValidationBorder = () => {
    if (validationState === 'error') return 'border-red-500';
    if (validationState === 'warning') return 'border-orange-500';
    return 'border-gray-300';
  };

  const baseClasses = `w-full px-2 py-1 text-xs border ${getValidationBorder()} rounded focus:bg-white focus:border focus:border-blue-300 text-center placeholder-gray-500`;
  const valueClasses = localValue ? 'text-black' : 'text-gray-500';
  const fieldClasses = `${baseClasses} ${valueClasses}`;

  // Use fieldPrompt as placeholder - no fallback, should fail clearly if missing
  const displayPlaceholder = fieldPrompt;

  switch (fieldType) {
    case 'select':
      // Try to get options from staticDataCache first, then fallback to passed options
      let selectOptions = options;
      if (staticDataCache && fieldName && staticDataCache[fieldName]) {
        selectOptions = staticDataCache[fieldName].map((item: any) => 
          typeof item === 'string' ? item : item.name || item.label || item.value
        );
      }
      
      if (!selectOptions || selectOptions.length === 0) {
        // No options available - render as text input
        return (
          <input
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleCommit}
            className={fieldClasses}
            placeholder={displayPlaceholder}
          />
        );
      }
      
      return (
        <select
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleCommit}
          className={`${fieldClasses} appearance-none`}
        >
          <option value="" className="text-gray-500">{displayPlaceholder}</option>
          {selectOptions.map((option) => (
            <option key={option} value={option} className="text-black">
              {option}
            </option>
          ))}
        </select>
      );
    
    case 'number':
      return (
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleCommit}
          className={fieldClasses}
          placeholder={displayPlaceholder}
        />
      );
    
    case 'text':
    default:
      return (
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleCommit}
          className={fieldClasses}
          placeholder={displayPlaceholder}
        />
      );
  }
};