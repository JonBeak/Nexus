import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface ConfirmFinalizeModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmFinalizeModal: React.FC<ConfirmFinalizeModalProps> = ({
  isOpen,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onCancel}
        />

        {/* Modal */}
        <div className={`relative ${PAGE_STYLES.panel.background} rounded-lg shadow-xl w-full max-w-md transform transition-all`}>
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${PAGE_STYLES.border}`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>Finalize Estimate</h3>
            </div>
            <button
              onClick={onCancel}
              className={`${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.textSecondary} transition-colors`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className={`${PAGE_STYLES.panel.textSecondary} mb-4`}>
              This will <strong>finalize</strong> the estimate and make it <strong>immutable</strong>.
            </p>
            <p className={`${PAGE_STYLES.panel.textSecondary} mb-4`}>
              The estimate will be locked from further edits and sent to QuickBooks.
            </p>
            <p className={`${PAGE_STYLES.panel.textSecondary} font-medium`}>
              Do you want to continue?
            </p>
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-end gap-3 px-6 py-4 ${PAGE_STYLES.header.background} rounded-b-lg`}>
            <button
              onClick={onCancel}
              className={`px-4 py-2 text-sm font-medium ${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.border} rounded-md ${PAGE_STYLES.interactive.hover} transition-colors`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Finalize & Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
