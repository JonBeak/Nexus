import React, { useState, useEffect } from 'react';
import { FieldRendererProps } from '../types';
import { getValidationStyling } from '../utils/validationStyler';

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
  const isCostField = fieldIndex === 0;
  const resolvedFieldName = field?.name ?? (isCostField ? 'cost' : `item_${fieldIndex}`);

  const upstreamValue = (() => {
    if (isCostField) {
      return row.data.cost != null ? String(row.data.cost) : '';
    }

    const value = row.data[resolvedFieldName];
    return value != null ? String(value) : '';
  })();

  const [localValue, setLocalValue] = useState(upstreamValue);

  useEffect(() => {
    setLocalValue(upstreamValue);
  }, [upstreamValue]);

  const assemblyIndex = assemblyOperations?.getAssemblyIndex() ?? 0;
  const assemblyColor = assemblyOperations?.getAssemblyColor(assemblyIndex) ?? '';
  const backgroundClasses = assemblyColor
    .split(' ')
    .filter(cls => !cls.startsWith('text-'))
    .join(' ');

  const hasErrors = Boolean(validationErrors?.length);
  const hasValue = localValue.trim().length > 0;
  const fieldBlurred = hasFieldBeenBlurred?.(row.id, resolvedFieldName) ?? false;
  const { fieldClasses } = getValidationStyling(
    hasErrors && fieldBlurred,
    hasValue,
    validationErrors || []
  );

  const cellKey = `${row.id}-assembly-field-${fieldIndex}`;

  const handleCostCommit = () => {
    if (!onFieldCommit || localValue === upstreamValue) {
      return;
    }

    const numericValue = parseFloat(localValue);
    onFieldCommit(rowIndex, resolvedFieldName, Number.isFinite(numericValue) ? numericValue : 0);
  };

  const handleAssemblyCommit = () => {
    if (!onFieldCommit || !allRows) {
      return;
    }

    const previousValue = upstreamValue;
    onFieldCommit(rowIndex, resolvedFieldName, localValue);

    if (!assemblyOperations || localValue === previousValue) {
      return;
    }

    if (localValue === '') {
      const previousTargetNumber = Number.parseInt(previousValue, 10);
      if (Number.isInteger(previousTargetNumber)) {
        const previousTargetIndex = assemblyOperations.findRowByLogicalNumber(previousTargetNumber);
        if (previousTargetIndex !== -1) {
          const previousTargetRow = allRows[previousTargetIndex];
          assemblyOperations.handleAssemblyItemToggle(assemblyIndex, previousTargetRow.id, false);
        }
      }
      return;
    }

    const newTargetNumber = Number.parseInt(localValue, 10);
    if (Number.isInteger(newTargetNumber)) {
      const newTargetIndex = assemblyOperations.findRowByLogicalNumber(newTargetNumber);
      if (newTargetIndex !== -1) {
        const newTargetRow = allRows[newTargetIndex];
        assemblyOperations.handleAssemblyItemToggle(assemblyIndex, newTargetRow.id, true);
      }
    }
  };

  if (isCostField) {
    return (
      <input
        key={cellKey}
        type="text"
        value={localValue}
        onChange={event => {
          const value = event.target.value.replace(/[^0-9.]/g, '');
          setLocalValue(value);
        }}
        onBlur={handleCostCommit}
        className={`w-full px-2 py-1 text-xs bg-transparent focus:bg-white focus:border-blue-300 rounded text-center placeholder-gray-500 ${fieldClasses} ${backgroundClasses}`}
        placeholder="0.00"
        inputMode="decimal"
      />
    );
  }

  if (!allRows) {
    return <div className="w-full px-2 py-1 text-xs text-red-500">Missing rows data</div>;
  }

  const dropdownOptions = assemblyOperations?.getAssemblyDropdownOptions() ?? [
    { value: '', label: '── Deselect ──', disabled: false }
  ];

  const datalistOptions = dropdownOptions.map((option, index) => ({
    key: `${option.value}-${index}`,
    value: option.value,
    label:
      option.value === ''
        ? option.label
        : option.label.split(' - ').slice(1).join(' - ') || option.label
  }));

  return (
    <div className="relative">
      <input
        key={cellKey}
        type="text"
        value={localValue}
        list={`assembly-items-${row.id}-${fieldIndex}`}
        onChange={event => setLocalValue(event.target.value)}
        onBlur={handleAssemblyCommit}
        className={`w-full px-2 py-1 text-xs bg-transparent focus:bg-white focus:border-blue-300 rounded text-center placeholder-gray-500 ${fieldClasses} ${backgroundClasses}`}
        placeholder="Item #"
      />
      <datalist id={`assembly-items-${row.id}-${fieldIndex}`}>
        {datalistOptions.map(option => (
          <option key={option.key} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
    </div>
  );
};
