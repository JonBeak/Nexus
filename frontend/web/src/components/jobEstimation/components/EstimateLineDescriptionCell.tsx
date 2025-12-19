import React, { useState, useEffect, useRef } from 'react';

interface EstimateLineDescriptionCellProps {
  lineIndex: number;
  initialValue: string;
  estimateId: number;
  readOnly: boolean;
  onUpdate: (lineIndex: number, value: string) => void;
}

export const EstimateLineDescriptionCell: React.FC<EstimateLineDescriptionCellProps> = ({
  lineIndex,
  initialValue,
  estimateId,
  readOnly,
  onUpdate
}) => {
  const [value, setValue] = useState(initialValue);
  const [isDirty, setIsDirty] = useState(false);
  const prevValueRef = useRef(initialValue);

  // Update local state when initialValue changes (e.g., after auto-fill)
  useEffect(() => {
    if (initialValue !== prevValueRef.current) {
      setValue(initialValue);
      prevValueRef.current = initialValue;
      setIsDirty(false);
    }
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setIsDirty(newValue !== initialValue);
  };

  const handleBlur = () => {
    if (isDirty) {
      onUpdate(lineIndex, value);
      setIsDirty(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur(); // Trigger save
    }
    if (e.key === 'Escape') {
      setValue(initialValue); // Revert
      setIsDirty(false);
      e.currentTarget.blur();
    }
  };

  if (readOnly) {
    return (
      <span className="text-xs text-gray-700 px-1">
        {value || '-'}
      </span>
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`w-full px-1 py-0.5 text-xs border rounded
        ${isDirty
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-blue-400'
        }
        focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
      placeholder="Enter QB description"
      disabled={readOnly}
    />
  );
};
