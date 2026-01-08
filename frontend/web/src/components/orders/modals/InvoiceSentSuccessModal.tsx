/**
 * Invoice Sent Success Modal
 * Shows success confirmation after invoice email is sent or scheduled
 */

import React from 'react';
import { CheckCircle, X, Mail, Clock, FileText, Users } from 'lucide-react';

interface InvoiceSentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  orderName: string;
  invoiceNumber?: string;
  recipients: {
    to: string[];
    cc: string[];
    bcc: string[];
  };
  scheduledFor?: string; // ISO date string if scheduled
  wasResent?: boolean;
}

export const InvoiceSentSuccessModal: React.FC<InvoiceSentSuccessModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  orderName,
  invoiceNumber,
  recipients,
  scheduledFor,
  wasResent
}) => {
  if (!isOpen) return null;

  const isScheduled = !!scheduledFor;
  const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;

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
              <div className={`p-2 rounded-full ${isScheduled ? 'bg-blue-100' : 'bg-green-100'}`}>
                {isScheduled ? (
                  <Clock className="h-5 w-5 text-blue-600" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {isScheduled ? 'Invoice Scheduled!' : 'Invoice Sent!'}
                </h3>
                <p className="text-sm text-gray-500">
                  #{orderNumber} - {orderName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            {/* Invoice Info */}
            {invoiceNumber && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Invoice:</span>
                <span className="font-medium text-gray-900">{invoiceNumber}</span>
              </div>
            )}

            {/* Scheduled Time */}
            {isScheduled && scheduledDate && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Scheduled for:</span>
                </div>
                <p className="text-sm text-blue-700 mt-1 ml-6">
                  {scheduledDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })} at {scheduledDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
              </div>
            )}

            {/* Resend Notice */}
            {wasResent && !isScheduled && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                This invoice was previously sent and has been sent again.
              </div>
            )}

            {/* Recipients */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Recipients</span>
              </div>

              <div className="space-y-2 text-sm">
                {recipients.to.length > 0 && (
                  <div className="flex">
                    <span className="w-12 text-gray-500 font-medium">To:</span>
                    <span className="flex-1 text-gray-700">{recipients.to.join(', ')}</span>
                  </div>
                )}
                {recipients.cc.length > 0 && (
                  <div className="flex">
                    <span className="w-12 text-gray-500 font-medium">CC:</span>
                    <span className="flex-1 text-gray-700">{recipients.cc.join(', ')}</span>
                  </div>
                )}
                {recipients.bcc.length > 0 && (
                  <div className="flex">
                    <span className="w-12 text-gray-500 font-medium">BCC:</span>
                    <span className="flex-1 text-gray-700">{recipients.bcc.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-5 py-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
            <button
              onClick={onClose}
              className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                isScheduled
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceSentSuccessModal;
