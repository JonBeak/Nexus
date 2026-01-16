import React from 'react';
import { Pencil } from 'lucide-react';
import { PAGE_STYLES } from '../../../../constants/moduleColors';

interface EditableOrderNameProps {
  orderName: string;
  isEditing: boolean;
  isSaving: boolean;
  editValue: string;
  error: string | null;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onEditValueChange: (value: string) => void;
}

/**
 * EditableOrderName - Inline editable order name for the header
 * Shows h1 with pencil icon on hover, transforms to input on edit
 * Displays inline error messages below input when validation fails
 */
const EditableOrderName: React.FC<EditableOrderNameProps> = ({
  orderName,
  isEditing,
  isSaving,
  editValue,
  error,
  onEdit,
  onCancel,
  onSave,
  onEditValueChange
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    // Only auto-save if value changed and no error
    if (editValue.trim() !== orderName && !error) {
      onSave();
    } else if (editValue.trim() === orderName) {
      onCancel();
    }
    // If there's an error, don't auto-cancel - let user fix it
  };

  if (isEditing) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            disabled={isSaving}
            autoFocus
            className={`text-2xl font-bold px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-orange-500 ${
              error
                ? 'border-red-500 bg-red-50'
                : 'border-gray-300 bg-white'
            } ${PAGE_STYLES.panel.text}`}
            style={{ minWidth: '200px', maxWidth: '400px' }}
          />
          {isSaving && (
            <span className="text-sm text-gray-500">Saving...</span>
          )}
        </div>
        {error && (
          <div className="mt-1 px-2 py-1.5 bg-red-50 border border-red-200 rounded text-red-700 text-sm max-w-md">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="group flex items-center space-x-2">
      <h1 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>
        {orderName}
      </h1>
      <button
        onClick={onEdit}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-orange-600 transition-opacity"
        title="Edit order name"
      >
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  );
};

export default EditableOrderName;
