import React, { useState, useEffect } from 'react';
import { FieldRendererProps, FieldOption } from '../types';
import { getValidationStyling } from '../utils/validationStyler';

export const ProductFieldRenderer: React.FC<FieldRendererProps> = ({
  row,
  rowIndex,
  field,
  fieldIndex,
  onFieldCommit,
  validationErrors,
  hasFieldBeenBlurred
}) => {
  // For non-assembly rows, field should be defined
  if (!field) {
    // If this row has a productTypeId but no field config, show a placeholder indicating loading
    if (row.productTypeId && fieldIndex < 12) {
      return (
        <div className="w-full px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded text-gray-400">
          Loading field...
        </div>
      );
    }
    return <div className="w-full px-2 py-1 text-xs"></div>;
  }

  // ✅ BLUR-ONLY: Local state management - no grid updates during typing
  const initialValue = row.data[field.name] || '';
  const [localValue, setLocalValue] = useState(initialValue);
  
  // Update local value when row data changes externally (e.g., data loading, undo operations)
  useEffect(() => {
    setLocalValue(row.data[field.name] || '');
  }, [row.data[field.name]]);

  const cellKey = `${row.id}-${field.name}`;
  const hasErrors = validationErrors && validationErrors.length > 0;
  const hasValue = !!localValue;
  
  // ✅ BLUR-ONLY: Check if field has been blurred for validation styling
  const fieldHasBeenBlurred = hasFieldBeenBlurred?.(row.id, field.name) || false;
  
  // ✅ BLUR-ONLY: Only show validation errors after field has been blurred
  const { fieldClasses, errorTitle } = getValidationStyling(
    hasErrors && fieldHasBeenBlurred, 
    hasValue, 
    validationErrors
  );
  
  // ✅ BLUR-ONLY: Commit handler - only updates grid state on blur
  const handleFieldCommit = () => {
    if (onFieldCommit && localValue !== initialValue) {
      onFieldCommit(rowIndex, field.name, localValue);
    }
  };
  
  // Regular field rendering
  switch (field.type) {
    case 'select':
      return (
        <select
          key={cellKey}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)} // ✅ BLUR-ONLY: Only local state
          onBlur={handleFieldCommit} // ✅ BLUR-ONLY: Commit to grid state on blur
          className={`w-full px-2 py-1 text-xs ${fieldClasses} focus:bg-white focus:border focus:border-blue-300 rounded text-center ${localValue ? 'text-black' : 'text-gray-500'} appearance-none`}
          title={errorTitle}
        >
          <option value="" className="text-gray-500">{field.label}</option>
          {field.options?.map((option: FieldOption | string) => {
            const optionValue = typeof option === 'string' ? option : option.value;
            const optionLabel = typeof option === 'string' ? option : option.label;
            return (
              <option key={optionValue} value={optionValue} className="text-black">
                {optionLabel}
              </option>
            );
          })}
        </select>
      );
    
    case 'number':
      return (
        <input
          key={cellKey}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)} // ✅ BLUR-ONLY: Only local state
          onBlur={handleFieldCommit} // ✅ BLUR-ONLY: Commit to grid state on blur
          className={`w-full px-2 py-1 text-xs ${fieldClasses} focus:bg-white focus:border focus:border-blue-300 rounded text-center ${localValue ? 'text-black' : 'text-gray-500'} placeholder-gray-500`}
          placeholder={field.label}
          title={errorTitle}
        />
      );
    
    case 'text':
    case 'currency':
    case 'textarea':
      return (
        <input
          key={cellKey}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)} // ✅ BLUR-ONLY: Only local state
          onBlur={handleFieldCommit} // ✅ BLUR-ONLY: Commit to grid state on blur
          className={`w-full px-2 py-1 text-xs ${fieldClasses} focus:bg-white focus:border focus:border-blue-300 rounded text-center ${localValue ? 'text-black' : 'text-gray-500'} placeholder-gray-500`}
          maxLength={field.maxLength}
          placeholder={field.label}
          title={errorTitle}
        />
      );
    
    default:
      return (
        <div className="w-full px-2 py-1 text-xs bg-red-50 border border-red-200 rounded text-red-600">
          Unknown field type: {field.type}
        </div>
      );
  }
};