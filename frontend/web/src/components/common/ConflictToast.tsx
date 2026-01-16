/**
 * ConflictToast Component
 *
 * Displays a toast notification when a task version conflict occurs
 * (i.e., another user modified the task while you were editing it).
 */

import React, { useEffect } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';

interface ConflictToastProps {
  /**
   * Whether to show the toast
   */
  show: boolean;
  /**
   * Message to display (default: "This task was already updated. Refreshing...")
   */
  message?: string;
  /**
   * Callback when toast is closed
   */
  onClose: () => void;
  /**
   * Auto-hide duration in milliseconds (default: 4000)
   * Set to 0 to disable auto-hide
   */
  autoHideDuration?: number;
}

export const ConflictToast: React.FC<ConflictToastProps> = ({
  show,
  message = 'This task was already updated by another user. Refreshing...',
  onClose,
  autoHideDuration = 4000
}) => {
  // Auto-hide after duration
  useEffect(() => {
    if (show && autoHideDuration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [show, autoHideDuration, onClose]);

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 bg-amber-50 border border-amber-200 text-amber-800 max-w-md animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium">{message}</p>
          <div className="mt-1 flex items-center text-xs text-amber-600">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            <span>Syncing with server...</span>
          </div>
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="inline-flex rounded-md p-1.5 text-amber-500 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <span className="sr-only">Close</span>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictToast;
