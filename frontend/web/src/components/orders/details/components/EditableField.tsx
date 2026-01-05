import React from 'react';
import { Pencil } from 'lucide-react';

// Reusable EditableField component to reduce repetition
export interface EditableFieldProps {
  field: string;
  value: any;
  label?: string;
  type?: 'text' | 'date' | 'time' | 'email' | 'select' | 'checkbox' | 'textarea' | 'number';
  options?: Array<{ value: string; label: string }>;
  isEditing: boolean;
  isSaving: boolean;
  onEdit: (field: string, currentValue: string) => void;
  onSave: (field: string, newValue?: string) => void;
  onCancel: () => void;
  editValue?: string;
  onEditValueChange?: (value: string) => void;
  displayFormatter?: (value: any) => string;
  className?: string;
  height?: string; // For textarea height
  placeholder?: string; // For textarea placeholder
  autoSave?: boolean; // Auto-save on blur, auto-cancel on Escape (no Save/Cancel buttons)
  layout?: 'vertical' | 'horizontal'; // Layout direction for label/value
  valueSize?: 'sm' | 'base'; // Value text size (sm = text-sm, base = text-base)
}

const EditableField: React.FC<EditableFieldProps> = ({
  field,
  value,
  type = 'text',
  options = [],
  isEditing,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  editValue = '',
  onEditValueChange,
  displayFormatter,
  className = '',
  height = '60px',
  placeholder = '',
  autoSave = false,
  layout = 'vertical',
  valueSize = 'base'
}) => {
  // Compute text size class based on valueSize prop
  const textSizeClass = valueSize === 'sm' ? 'text-sm' : 'text-base';
  const originalValue = String(value || '');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // For textarea, don't trigger save on Enter (allow multiline)
    if (type === 'textarea') {
      if (e.key === 'Escape') {
        onCancel();
      }
    } else {
      if (e.key === 'Enter') {
        // Save if changed, cancel if not
        if (editValue !== originalValue) {
          onSave(field);
        } else {
          onCancel();
        }
      } else if (e.key === 'Escape') {
        onCancel();
      }
    }
  };

  // Auto-confirm on blur if changed, auto-cancel if not
  const handleBlur = () => {
    if (editValue !== originalValue) {
      onSave(field);
    } else {
      onCancel();
    }
  };

  // For select: auto-save immediately on change
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    onEditValueChange?.(newValue);
    // Auto-save immediately for select
    if (newValue !== originalValue) {
      // Use setTimeout to allow state to update first
      setTimeout(() => onSave(field, newValue), 0);
    }
  };

  const displayValue = displayFormatter ? displayFormatter(value) : (value || '-');

  if (type === 'checkbox') {
    return (
      <div className="flex items-center space-x-2 group h-6">
        <input
          type="checkbox"
          checked={value || false}
          onChange={(e) => {
            onEdit(field, String(e.target.checked));
            // Note: onSave is not called here because the onEdit handler
            // already triggers saveEdit for checkboxes in OrderDetailsPage
          }}
          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
        />
        <p className={`font-medium text-gray-900 ${textSizeClass}`}>
          {value ? 'Yes' : 'No'}
        </p>
      </div>
    );
  }

  // Handle textarea type
  if (type === 'textarea') {
    if (isEditing) {
      // Auto-save mode: save on blur, cancel on Escape
      if (autoSave) {
        return (
          <div className="relative" style={{ height }}>
            <div className="h-full">
              <textarea
                value={editValue}
                onChange={(e) => onEditValueChange?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    onCancel();
                  }
                }}
                onBlur={() => {
                  // Auto-save on blur if value changed
                  if (editValue !== originalValue) {
                    onSave(field);
                  } else {
                    onCancel();
                  }
                }}
                placeholder={placeholder}
                className="w-full text-sm text-gray-900 border border-indigo-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none box-border"
                style={{ height }}
                autoFocus
              />
            </div>
          </div>
        );
      }

      // Manual save mode: show Save/Cancel buttons
      return (
        <div className="relative" style={{ height }}>
          <div className="h-full">
            <textarea
              value={editValue}
              onChange={(e) => onEditValueChange?.(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full text-sm text-gray-900 border border-indigo-300 rounded p-2 pr-28 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none box-border"
              style={{ height }}
              autoFocus
            />
            <div className="absolute top-1 right-6 flex flex-col space-y-1">
              <button
                onClick={() => onSave(field)}
                disabled={isSaving}
                className="px-2 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={onCancel}
                className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Display mode for textarea
    return (
      <div className="relative group" style={{ height }}>
        <p className={`${textSizeClass} text-gray-600 whitespace-pre-wrap h-full overflow-y-auto border border-gray-300 rounded px-2 py-1`}>
          {displayValue}
        </p>
        <button
          onClick={() => onEdit(field, String(value || ''))}
          className="absolute top-1 right-5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Default behavior for non-textarea types
  if (isEditing) {
    return (
      <div className="flex items-center h-6">
        {type === 'select' ? (
          <select
            value=""
            onChange={handleSelectChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`font-medium text-gray-900 border border-indigo-300 rounded px-1 ${textSizeClass} w-full h-full focus:outline-none focus:ring-1 focus:ring-indigo-500`}
            autoFocus
          >
            <option value="" disabled>Select...</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={editValue}
            onChange={(e) => onEditValueChange?.(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`font-medium text-gray-900 border border-indigo-300 rounded px-1 ${textSizeClass} w-full h-full focus:outline-none focus:ring-1 focus:ring-indigo-500 ${className}`}
            autoFocus
          />
        )}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center space-x-2 group">
      <span className={`font-medium text-gray-900 ${textSizeClass}`}>
        {displayValue}
      </span>
      <button
        onClick={() => onEdit(field, String(value || ''))}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </span>
  );
};

export default EditableField;