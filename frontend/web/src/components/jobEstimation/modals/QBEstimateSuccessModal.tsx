import React from 'react';
import { CheckCircle, ExternalLink, X } from 'lucide-react';

interface QBEstimateSuccessModalProps {
  isOpen: boolean;
  qbDocNumber: string;
  qbEstimateUrl: string;
  onOpenInQuickBooks: () => void;
  onClose: () => void;
}

export const QBEstimateSuccessModal: React.FC<QBEstimateSuccessModalProps> = ({
  isOpen,
  qbDocNumber,
  qbEstimateUrl,
  onOpenInQuickBooks,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
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
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Success!</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-700 mb-3">
              Estimate finalized and sent to QuickBooks.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-800">
                <strong>QB Document #:</strong> {qbDocNumber}
              </p>
            </div>
            <p className="text-gray-700 font-medium">
              Would you like to open this estimate in QuickBooks?
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Do not open
            </button>
            <button
              onClick={() => {
                onOpenInQuickBooks();
                onClose();
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open in QuickBooks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
