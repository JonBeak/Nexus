import React from 'react';
import { Pencil, Check, X } from 'lucide-react';

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
  onSave: (field: string) => void;
  onCancel: () => void;
  editValue?: string;
  onEditValueChange?: (value: string) => void;
  displayFormatter?: (value: any) => string;
  className?: string;
  height?: string; // For textarea height
  placeholder?: string; // For textarea placeholder
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
  placeholder = ''
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // For textarea, don't trigger save on Enter (allow multiline)
    if (type === 'textarea') {
      if (e.key === 'Escape') {
        onCancel();
      }
    } else {
      if (e.key === 'Enter') {
        onSave(field);
      } else if (e.key === 'Escape') {
        onCancel();
      }
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
        <p className="font-medium text-gray-900 text-base">
          {value ? 'Yes' : 'No'}
        </p>
      </div>
    );
  }

  // Handle textarea type
  if (type === 'textarea') {
    if (isEditing) {
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
        <p className="text-base text-gray-600 whitespace-pre-wrap h-full overflow-y-auto border border-gray-300 rounded px-2 py-1">
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
      <div className="flex items-center space-x-1 h-6">
        {type === 'select' ? (
          <select
            value={editValue}
            onChange={(e) => onEditValueChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            className="font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base w-full h-full"
            autoFocus
          >
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
            onKeyDown={handleKeyDown}
            className={`font-medium text-gray-900 border border-indigo-300 rounded px-1 text-base w-full h-full ${className}`}
            autoFocus
          />
        )}
        <button
          onClick={() => onSave(field)}
          disabled={isSaving}
          className="text-green-600 hover:text-green-700 flex-shrink-0"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 group h-6">
      <p className="font-medium text-gray-900 text-base">
        {displayValue}
      </p>
      <button
        onClick={() => onEdit(field, String(value || ''))}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default EditableField;