/**
 * Print Approval Error Modal
 * Shows error messages for print/approval failures
 */

import React from 'react';
import { XCircle, X, AlertTriangle, Printer } from 'lucide-react';

export interface PrintApprovalErrorData {
  type: 'validation' | 'print_failure' | 'production_failure' | 'general';
  title: string;
  message: string;
  details?: string;
}

interface PrintApprovalErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PrintApprovalErrorData | null;
}

export const PrintApprovalErrorModal: React.FC<PrintApprovalErrorModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  if (!isOpen || !data) return null;

  const { type, title, message, details } = data;

  const getIcon = () => {
    switch (type) {
      case 'validation':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'print_failure':
        return <Printer className="h-5 w-5 text-red-600" />;
      default:
        return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getIconBackground = () => {
    switch (type) {
      case 'validation':
        return 'bg-yellow-100';
      default:
        return 'bg-red-100';
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'validation':
        return 'bg-yellow-600 hover:bg-yellow-700';
      default:
        return 'bg-red-600 hover:bg-red-700';
    }
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${getIconBackground()}`}>
                {getIcon()}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {title}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-700">{message}</p>

            {details && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-600 font-mono break-all">{details}</p>
              </div>
            )}

            {type === 'print_failure' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  Make sure CUPS is installed and a printer is configured on the server.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-5 py-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
            <button
              onClick={onClose}
              className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors min-h-[44px] active:opacity-80 ${getButtonColor()}`}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintApprovalErrorModal;
