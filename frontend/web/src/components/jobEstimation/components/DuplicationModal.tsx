import React, { useState } from 'react';

interface DuplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDuplicate: (notes: string) => void;
}

export const DuplicationModal: React.FC<DuplicationModalProps> = ({
  isOpen,
  onClose,
  onDuplicate
}) => {
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleDuplicate = () => {
    onDuplicate(notes);
    setNotes(''); // Reset notes after duplication
  };

  const handleClose = () => {
    setNotes(''); // Reset notes on close
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Duplicate Version</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this duplication..."
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
            onClick={handleDuplicate}
            className="flex-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Duplicate
          </button>
        </div>
      </div>
    </div>
  );
};
