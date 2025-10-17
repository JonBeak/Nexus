/**
 * FieldCell - Individual field input component
 * Matches original ProductFieldRenderer styling with blur-only validation
 * Simplified for Base Layer - no complex validation or styling
 */

import React, { useState, useEffect, useRef } from 'react';
import { ExpandableFieldInput } from './ExpandableFieldInput';

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
  validationState?: 'error' | 'valid'; // Validation state
  allowExpansion?: boolean; // Enable expandable overlay for text fields
  productTypeId?: number; // Product type ID for special styling
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
  validationState = 'valid',
  allowExpansion = false,
  productTypeId
}) => {
  // Local state for blur-only validation pattern
  const [localValue, setLocalValue] = useState(fieldValue);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

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

  // If field is disabled, show prompt as read-only label (for special items like Divider)
  if (!fieldEnabled) {
    // Show prompt text if available (for informational display)
    if (fieldPrompt && fieldPrompt.trim() !== '') {
      return (
        <div className="w-full px-2 py-1 text-xs text-gray-500 text-center italic">
          {fieldPrompt}
        </div>
      );
    }
    // Otherwise render nothing
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

  // Enhanced field classes with validation state styling
  // Priority: Error (red) > Valid with value (blue/orange) > Default (gray)
  const getFieldStyling = () => {
    const hasValue = !!localValue;

    // Error styling ALWAYS takes priority
    if (validationState === 'error') {
      return {
        borderClass: 'border border-red-500',
        bgClass: 'bg-red-100',
        textClass: hasValue ? 'text-black' : 'text-gray-400'
      };
    }

    // Valid field with value gets border highlight for fields1-10 or QTY with value != "1"
    const isField1to10 = fieldName.match(/^field([1-9]|10)$/);
    const isQtyNotOne = fieldName === 'quantity' && hasValue && localValue !== '1';
    const isMultiplier = productTypeId === 23; // Multiplier special item

    if (hasValue && (isField1to10 || isQtyNotOne)) {
      // Multiplier fields get orange highlighting (matches Divider background with darker border)
      if (isMultiplier) {
        return {
          borderClass: 'border border-orange-600',
          bgClass: 'bg-orange-200',
          textClass: 'text-black'
        };
      }
      // Regular fields get blue highlighting
      return {
        borderClass: 'border border-blue-500',
        bgClass: 'bg-sky-50/25',
        textClass: 'text-black'
      };
    }

    // Default styling (no value or regular field)
    return {
      borderClass: 'border border-gray-300',
      bgClass: 'bg-white',
      textClass: hasValue ? 'text-black' : 'text-gray-400'
    };
  };

  const styling = getFieldStyling();
  const fieldClasses = `w-full px-2 py-1 text-xs ${styling.borderClass} ${styling.bgClass} ${styling.textClass} rounded focus:bg-white focus:border focus:border-blue-300 text-center placeholder-gray-400`;

  // Use fieldPrompt as placeholder - no fallback, should fail clearly if missing
  const displayPlaceholder = fieldPrompt ?? placeholder ?? '';

  switch (fieldType) {
    case 'select': {
      let selectOptions = options;
      if (staticDataCache && fieldName && staticDataCache[fieldName]) {
        selectOptions = staticDataCache[fieldName].map((item: unknown) =>
          typeof item === 'string' ? item : (item as Record<string, string>)["name"] || (item as Record<string, string>)["label"] || (item as Record<string, string>)["value"]
        );
      }

      if (!selectOptions || selectOptions.length === 0) {
        return (
          <input
            type="text"
            value={localValue}
            onChange={(event) => setLocalValue(event.target.value)}
            onBlur={handleCommit}
            className={fieldClasses}
            placeholder={displayPlaceholder}
          />
        );
      }

      return (
        <select
          ref={selectRef}
          value={localValue}
          onChange={(event) => {
            const newValue = event.target.value;
            setLocalValue(newValue);
            // Immediately commit for select fields (discrete choice, not progressive typing)
            if (newValue !== fieldValue) {
              onCommit(newValue);
            }
            // Keep focus on the select so user can Tab to next field immediately
            // The dropdown will close automatically after selection
            setIsDropdownOpen(false);
          }}
          onMouseDown={() => {
            // Dropdown opens on mouse down
            setIsDropdownOpen(true);
          }}
          onKeyDown={(event) => {
            // Handle keyboard interactions
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              if (!isDropdownOpen) {
                // Block all arrow keys when dropdown is closed
                event.preventDefault();
                return;
              }
            } else if (event.key === ' ' || event.key === 'Enter') {
              // Space or Enter opens the dropdown
              if (!isDropdownOpen) {
                setIsDropdownOpen(true);
              }
            } else if (event.key === 'Escape') {
              // Escape closes the dropdown
              setIsDropdownOpen(false);
            }
          }}
          onBlur={() => {
            // Dropdown closes on blur
            setIsDropdownOpen(false);
            handleCommit();
          }}
          className={`${fieldClasses} appearance-none`}
        >
          <option value="" className="text-gray-400">{displayPlaceholder}</option>
          {selectOptions.map((option) => (
            <option key={option} value={option} className="text-black">
              {option + '\u00A0\u00A0'}
            </option>
          ))}
        </select>
      );
    }

    case 'number':
      return (
        <input
          type="text"
          value={localValue}
          onChange={(event) => setLocalValue(event.target.value)}
          onBlur={handleCommit}
          className={fieldClasses}
          placeholder={displayPlaceholder}
        />
      );

    case 'text':
    default:
      return (
        <ExpandableFieldInput
          value={localValue}
          onChange={setLocalValue}
          onCommit={handleCommit}
          placeholder={displayPlaceholder}
          isReadOnly={false}
          className={fieldClasses}
          allowExpansion={allowExpansion}
        />
      );
  }
};
