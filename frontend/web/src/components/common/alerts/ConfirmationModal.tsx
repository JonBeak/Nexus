/**
 * ConfirmationModal Component
 * Replaces browser confirm() calls with a styled modal.
 * Supports danger, warning, and default variants.
 */

import React from 'react';
import { AlertTriangle, HelpCircle, Trash2, X } from 'lucide-react';
import type { ConfirmData, ConfirmVariant } from './types';

interface ConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  data: ConfirmData | null;
  isLoading?: boolean;
}

const variantConfig: Record<ConfirmVariant, {
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  confirmButtonColor: string;
}> = {
  danger: {
    icon: Trash2,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-100',
    confirmButtonColor: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    confirmButtonColor: 'bg-yellow-600 hover:bg-yellow-700',
  },
  default: {
    icon: HelpCircle,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-100',
    confirmButtonColor: 'bg-blue-600 hover:bg-blue-700',
  },
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  data,
  isLoading = false
}) => {
  if (!isOpen || !data) return null;

  const { title, message, confirmText, cancelText, variant = 'default', details } = data;
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={isLoading ? undefined : onCancel}
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
              onClick={onCancel}
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{message}</p>

            {details && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                {typeof details === 'string' ? (
                  <p className="text-xs text-gray-600">{details}</p>
                ) : (
                  details
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px] disabled:opacity-50"
            >
              {cancelText || 'Cancel'}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors min-h-[44px] active:opacity-80 disabled:opacity-50 flex items-center gap-2 ${config.confirmButtonColor}`}
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {confirmText || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
