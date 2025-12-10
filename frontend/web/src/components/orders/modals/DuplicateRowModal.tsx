/**
 * DuplicateRowModal Component
 * Phase 1.5.e - Row Operations Polish
 *
 * Modal for duplicating a row with 3 options:
 * - Duplicate SPECS ONLY (left table data)
 * - Duplicate INVOICE ONLY (right table data)
 * - Duplicate BOTH (specs + invoice data)
 */

import React, { useState } from 'react';
import { Copy, X, FileText, Receipt, Files } from 'lucide-react';

export type DuplicateMode = 'specs' | 'invoice' | 'both';

interface DuplicateRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: DuplicateMode) => void;
  loading?: boolean;
}

export const DuplicateRowModal: React.FC<DuplicateRowModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false
}) => {
  const [selectedMode, setSelectedMode] = useState<DuplicateMode | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedMode) {
      onConfirm(selectedMode);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSelectedMode(null);
      onClose();
    }
  };

  const options: { mode: DuplicateMode; label: string; description: string; icon: React.ReactNode }[] = [
    {
      mode: 'specs',
      label: 'Specs Only',
      description: 'Copy Item Name, Scope, Specifications, and Specs Qty',
      icon: <FileText className="w-5 h-5" />
    },
    {
      mode: 'invoice',
      label: 'Invoice Only',
      description: 'Copy QB Item, QB Description, Invoice Description, Qty, and Price',
      icon: <Receipt className="w-5 h-5" />
    },
    {
      mode: 'both',
      label: 'Both',
      description: 'Copy all data from both Specs and Invoice sections',
      icon: <Files className="w-5 h-5" />
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Copy className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Duplicate Row</h3>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-4">
          Select which data to copy to the new row:
        </p>

        {/* Options */}
        <div className="space-y-2 mb-6">
          {options.map((option) => (
            <button
              key={option.mode}
              onClick={() => setSelectedMode(option.mode)}
              disabled={loading}
              className={`w-full p-3 rounded-lg border-2 text-left transition-colors ${
                selectedMode === option.mode
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-start space-x-3">
                <div className={`mt-0.5 ${selectedMode === option.mode ? 'text-blue-600' : 'text-gray-400'}`}>
                  {option.icon}
                </div>
                <div>
                  <div className={`font-medium ${selectedMode === option.mode ? 'text-blue-900' : 'text-gray-900'}`}>
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {option.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !selectedMode}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Duplicating...</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Duplicate</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateRowModal;
