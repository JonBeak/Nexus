import React, { useState, useEffect } from 'react';
import { FieldRendererProps } from '../types';
import { getValidationStyling } from '../utils/validationStyler';
import { useDragDropContext } from '../managers/DragDropManager';

export const AssemblyFieldRenderer: React.FC<FieldRendererProps> = ({
  row,
  rowIndex,
  field,
  fieldIndex,
  onFieldCommit,
  assemblyOperations,
  validationErrors,
  allRows,
  hasFieldBeenBlurred
}) => {
  // Skip expensive assembly operations during drag calculations
  const { isDragCalculating } = useDragDropContext();
  if (isDragCalculating) {
    return <div className="w-full px-2 py-1 text-xs text-gray-400">Updating...</div>;
  }
  
  const cellKey = `${row.id}-assembly-field-${fieldIndex}`;
  const assemblyIdx = assemblyOperations!.getAssemblyIndex(rowIndex);
  const assemblyColor = assemblyOperations!.getAssemblyColor(assemblyIdx);
  
  // Field 1 (fieldIndex 0): Assembly cost dollar input
  if (fieldIndex === 0) {
    // ✅ BLUR-ONLY: Local state management for assembly cost
    const initialValue = (row.data.cost || '').toString();
    const [localValue, setLocalValue] = useState(initialValue);
    
    // Update local value when row data changes externally
    useEffect(() => {
      setLocalValue((row.data.cost || '').toString());
    }, [row.data.cost]);
    
    const hasErrors = validationErrors && validationErrors.length > 0;
    const hasValue = !!localValue.trim();
    const fieldHasBeenBlurred = hasFieldBeenBlurred?.(row.id, 'cost') ?? false;
    const { fieldClasses } = getValidationStyling(hasErrors && fieldHasBeenBlurred, hasValue, validationErrors || []);
    
    const handleCostCommit = () => {
      if (onFieldCommit && localValue !== initialValue) {
        const numValue = parseFloat(localValue) || 0;
        onFieldCommit(rowIndex, 'cost', numValue);
      }
    };
    
    return (
      <input
        key={cellKey}
        type="text"
        value={localValue}
        onChange={(e) => {
          // Allow only numbers and decimal points
          const value = e.target.value.replace(/[^0-9.]/g, '');
          setLocalValue(value); // ✅ BLUR-ONLY: Only local state
        }}
        onBlur={handleCostCommit} // ✅ BLUR-ONLY: Commit to grid state on blur
        className={`w-full px-2 py-1 text-xs bg-transparent focus:bg-white focus:border-blue-300 rounded text-center placeholder-gray-500 ${fieldClasses} ${assemblyColor.split(' ').filter(cls => !cls.startsWith('text-')).join(' ')}`}
        placeholder="0.00"
      />
    );
  }
  
  // Fields 2-11 (fieldIndex 1-10): Item selection dropdowns
  if (!allRows) {
    return <div className="w-full px-2 py-1 text-xs text-red-500">Missing rows data</div>;
  }
  
  // ✅ FIELD MAPPING FIX: Correct assembly field name mapping
  const fieldName = field?.name || (fieldIndex === 0 ? 'cost' : `item_${fieldIndex}`);
  const initialValue = row.data[fieldName] || '';
  
  // ✅ BLUR-ONLY: Local state management for assembly dropdown
  const [localValue, setLocalValue] = useState(initialValue);
  
  // Update local value when row data changes externally
  useEffect(() => {
    setLocalValue(row.data[fieldName] || '');
  }, [row.data[fieldName], fieldName]);
  
  // ✅ CONSOLIDATION: Use AssemblyManager's built-in dropdown options method
  const dropdownOptions = assemblyOperations?.getAssemblyDropdownOptions() || [
    { value: '', label: '── Deselect ──', disabled: false }
  ];
  
  const hasErrors = validationErrors && validationErrors.length > 0;
  const hasValue = !!localValue.trim();
  const fieldHasBeenBlurred = hasFieldBeenBlurred?.(row.id, fieldName) ?? false;
  
  // ✅ BLUR-ONLY: Assembly commit handler
  const handleAssemblyCommit = () => {
    if (onFieldCommit) {
      const previousValue = row.data[fieldName] || '';
      onFieldCommit(rowIndex, fieldName, localValue);
      
      // Handle assembly toggle logic after commit
      if (assemblyOperations) {
        const assemblyIdx = assemblyOperations.getAssemblyIndex(rowIndex);
        
        // Handle deselection: if new value is empty and previous value was not empty
        if (localValue === '' && previousValue !== '') {
          const previousTargetNumber = parseInt(previousValue);
          if (!isNaN(previousTargetNumber)) {
            const previousTargetIndex = assemblyOperations.findRowByLogicalNumber(previousTargetNumber);
            if (previousTargetIndex !== -1) {
              const previousTargetRow = allRows[previousTargetIndex];
              assemblyOperations.handleAssemblyItemToggle(assemblyIdx, previousTargetRow.id, false);
            }
          }
        }
        // Handle selection: if new value is a valid number
        else if (localValue !== '') {
          const newTargetNumber = parseInt(localValue);
          if (!isNaN(newTargetNumber)) {
            const newTargetIndex = assemblyOperations.findRowByLogicalNumber(newTargetNumber);
            if (newTargetIndex !== -1) {
              const newTargetRow = allRows[newTargetIndex];
              assemblyOperations.handleAssemblyItemToggle(assemblyIdx, newTargetRow.id, true);
            }
          }
        }
      }
    }
  };

  // Prepare datalist options with clean formatting
  const datalistOptions = dropdownOptions.map(option => ({
    value: option.value,
    // For display: show just the name part, not "5 - Push Thru" but just "Push Thru"  
    label: option.value === '' ? option.label : option.label.split(' - ').slice(1).join(' - ') || option.label
  }));

  const { fieldClasses } = getValidationStyling(hasErrors && fieldHasBeenBlurred, hasValue, validationErrors || []);
  
  return (
    <div className="relative">
      <input
        key={cellKey}
        type="text"
        value={localValue}
        list={`assembly-items-${row.id}-${fieldIndex}`}
        onChange={(e) => setLocalValue(e.target.value)} // ✅ BLUR-ONLY: Only local state
        onBlur={handleAssemblyCommit} // ✅ BLUR-ONLY: Commit to grid state + assembly logic on blur
        className={`w-full px-2 py-1 text-xs bg-transparent focus:bg-white focus:border-blue-300 rounded text-center placeholder-gray-500 ${fieldClasses} ${assemblyColor.split(' ').filter(cls => !cls.startsWith('text-')).join(' ')}`}
        placeholder="Item #"
      />
      <datalist id={`assembly-items-${row.id}-${fieldIndex}`}>
        {datalistOptions.map((option, index) => (
          <option 
            key={`${option.value}-${index}`} 
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </datalist>
    </div>
  );
};