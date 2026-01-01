import React from 'react';
import { CheckCircle, X } from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface QBEstimateSuccessModalProps {
  isOpen: boolean;
  qbDocNumber: string;
  qbEstimateUrl: string;  // Keep for backwards compatibility but not used
  onOpenInQuickBooks: () => void;  // Keep for backwards compatibility but not used
  onClose: () => void;
}

export const QBEstimateSuccessModal: React.FC<QBEstimateSuccessModalProps> = ({
  isOpen,
  qbDocNumber,
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
        <div className={`relative ${PAGE_STYLES.panel.background} rounded-lg shadow-xl w-full max-w-md transform transition-all`}>
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${PAGE_STYLES.border}`}>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>Success!</h3>
            </div>
            <button
              onClick={onClose}
              className={`${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.textSecondary} transition-colors`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className={`${PAGE_STYLES.panel.textSecondary} mb-3`}>
              Estimate created in QuickBooks.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                <strong>QB Document #:</strong> {qbDocNumber}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-end px-6 py-4 ${PAGE_STYLES.header.background} rounded-b-lg`}>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
