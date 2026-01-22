/**
 * AlertModal Component
 * Generic alert modal for success, error, warning, and info messages.
 * Replaces browser alert() calls with a styled modal.
 */

import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { AlertData, AlertType } from './types';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AlertData | null;
}

const alertConfig: Record<AlertType, {
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  buttonColor: string;
}> = {
  success: {
    icon: CheckCircle,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-100',
    buttonColor: 'bg-green-600 hover:bg-green-700',
  },
  error: {
    icon: XCircle,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-100',
    buttonColor: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-100',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
  },
};

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  if (!isOpen || !data) return null;

  const { type, title, message, details, buttonText } = data;
  const config = alertConfig[type];
  const Icon = config.icon;

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
              <div className={`p-2 rounded-full ${config.bgColor}`}>
                <Icon className={`h-5 w-5 ${config.iconColor}`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {title}
              </h3>
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
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{message}</p>

            {details && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-600 font-mono break-all">{details}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-5 py-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
            <button
              onClick={onClose}
              className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors min-h-[44px] active:opacity-80 ${config.buttonColor}`}
            >
              {buttonText || 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
