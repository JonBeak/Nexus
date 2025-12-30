import React, { useState, useEffect } from 'react';

interface VersionNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  title?: string;
  buttonText?: string;
  placeholder?: string;
}

export const VersionNotesModal: React.FC<VersionNotesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Duplicate Version',
  buttonText = 'Duplicate',
  placeholder = 'Add notes about this version...'
}) => {
  const [notes, setNotes] = useState('');

  // Reset notes when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setNotes('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes('');
  };

  const handleClose = () => {
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description (Optional)
          </label>
          <textarea
            className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleClose}
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};
