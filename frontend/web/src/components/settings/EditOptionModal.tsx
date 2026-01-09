/**
 * EditOptionModal - Modal for editing specification option values
 */

import React, { useState, useEffect } from 'react';
import { X, Lock } from 'lucide-react';
import { SpecificationOption } from '../../services/api/settings';

interface EditOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  option: SpecificationOption | null;
  onSave: (optionId: number, newValue: string) => Promise<boolean>;
  saving?: boolean;
}

export const EditOptionModal: React.FC<EditOptionModalProps> = ({
  isOpen,
  onClose,
  option,
  onSave,
  saving = false
}) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset form when option changes
  useEffect(() => {
    if (option) {
      setValue(option.option_value);
      setError(null);
    }
  }, [option]);

  if (!isOpen || !option) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      setError('Value cannot be empty');
      return;
    }

    if (trimmedValue === option.option_value) {
      onClose();
      return;
    }

    const success = await onSave(option.option_id, trimmedValue);
    if (success) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onKeyDown={handleKeyDown}>
      <div className="flex items-center justify-center min-h-screen px-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              Edit Option
              {!!option.is_system && (
                <Lock className="h-4 w-4 text-gray-400" title="System option" />
              )}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-4">
              <label
                htmlFor="option-value"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Option Value
              </label>
              <input
                id="option-value"
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  error ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={saving}
                autoFocus
              />
              {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
              )}
            </div>

            {!!option.is_system && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  This is a system option. You can edit the value, but it cannot be deleted.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !value.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditOptionModal;
