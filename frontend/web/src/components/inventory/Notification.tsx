import React from 'react';
import { X, CheckCircle } from 'lucide-react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  show: boolean;
  onClose: () => void;
}

export const Notification: React.FC<NotificationProps> = ({
  message,
  type,
  show,
  onClose
}) => {
  if (!show) return null;

  return (
    <div className={`fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 ${
      type === 'success' 
        ? 'bg-green-50 border border-green-200 text-green-800'
        : 'bg-red-50 border border-red-200 text-red-800'
    }`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          {type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-400" />
          ) : (
            <X className="h-5 w-5 text-red-400" />
          )}
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <div className="ml-auto pl-3">
          <button
            onClick={onClose}
            className={`inline-flex rounded-md p-1.5 ${
              type === 'success'
                ? 'text-green-500 hover:bg-green-100'
                : 'text-red-500 hover:bg-red-100'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};