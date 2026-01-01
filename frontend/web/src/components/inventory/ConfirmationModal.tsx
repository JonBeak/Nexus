import React from 'react';
import { PAGE_STYLES } from '../../constants/moduleColors';

interface ConfirmationModalProps {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: string;
  confirmText?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  show,
  title,
  message,
  onConfirm,
  onCancel,
  type = 'warning',
  confirmText = 'Confirm'
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className={`relative top-20 mx-auto p-5 border ${PAGE_STYLES.panel.border} w-96 shadow-lg rounded-md ${PAGE_STYLES.panel.background}`}>
        <div className="mt-3 text-center">
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${
            type === 'warning' ? 'bg-yellow-100' : 'bg-red-100'
          }`}>
            <svg className={`h-6 w-6 ${
              type === 'warning' ? 'text-yellow-600' : 'text-red-600'
            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className={`text-lg leading-6 font-medium ${PAGE_STYLES.panel.text} mt-4`}>{title}</h3>
          <div className="mt-2 px-7 py-3">
            <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>{message}</p>
          </div>
          <div className="items-center px-4 py-3">
            <button
              onClick={onConfirm}
              className={`px-4 py-2 ${
                type === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-red-500 hover:bg-red-600'
              } text-white text-base font-medium rounded-md w-24 mr-2`}
            >
              {confirmText}
            </button>
            <button
              onClick={onCancel}
              className={`px-4 py-2 ${PAGE_STYLES.header.background} hover:bg-gray-500 ${PAGE_STYLES.panel.text} text-base font-medium rounded-md w-24`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};