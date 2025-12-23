import React from 'react';
import { CheckCircle, X, Mail, AlertTriangle } from 'lucide-react';

interface EstimateSentSuccessModalProps {
  isOpen: boolean;
  emailsSentTo: string[];
  wasResent?: boolean;
  onClose: () => void;
}

export const EstimateSentSuccessModal: React.FC<EstimateSentSuccessModalProps> = ({
  isOpen,
  emailsSentTo,
  wasResent,
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
              <h3 className="text-lg font-semibold text-gray-900">Estimate Sent!</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Resend warning */}
            {wasResent && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  This estimate was previously sent and has been sent again.
                </p>
              </div>
            )}

            {/* Recipients */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Sent to:</span>
              </div>
              <ul className="space-y-1 ml-6">
                {emailsSentTo.map((email, index) => (
                  <li key={index} className="text-sm text-green-700">
                    {email}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-4 bg-gray-50 rounded-b-lg">
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
