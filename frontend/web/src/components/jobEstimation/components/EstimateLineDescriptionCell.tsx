import React, { useState, useEffect, useRef, useCallback } from 'react';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(24, textarea.scrollHeight)}px`;
    }
  }, []);

  // Update local state when initialValue changes (e.g., after auto-fill)
  useEffect(() => {
    if (initialValue !== prevValueRef.current) {
      setValue(initialValue);
      prevValueRef.current = initialValue;
      setIsDirty(false);
    }
  }, [initialValue]);

  // Auto-resize when value changes
  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setValue(initialValue); // Revert
      setIsDirty(false);
      e.currentTarget.blur();
    }
    // Allow Enter for new lines (don't blur on Enter)
  };

  if (readOnly) {
    // Display with proper newline formatting when finalized
    return (
      <div className="text-xs text-gray-700 px-1">
        {value ? (
          value.split('\n').map((line, i) => (
            <div key={i} className="leading-tight">
              {line || '\u00A0'}
            </div>
          ))
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </div>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      rows={1}
      className={`w-full px-1 py-0.5 text-xs border-2 rounded resize-none overflow-hidden
        ${isDirty
          ? 'border-blue-500 bg-blue-50'
          : 'border-green-500 bg-green-50 hover:border-green-600'
        }
        focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-500`}
      placeholder="Enter QB description"
      disabled={readOnly}
    />
  );
};
