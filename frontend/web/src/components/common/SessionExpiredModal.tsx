import React, { useEffect } from 'react';
import { useSession } from '../../contexts/SessionContext';

export const SessionExpiredModal: React.FC = () => {
  const { isSessionExpired, hideSessionExpiredModal } = useSession();

  useEffect(() => {
    if (isSessionExpired) {
      // Auto-redirect after a short delay to allow user to see the message
      const timer = setTimeout(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/';
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isSessionExpired]);

  if (!isSessionExpired) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 animate-fade-in">
        <div className="text-center">
          {/* Icon */}
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Session Expired
          </h3>

          {/* Message */}
          <p className="text-gray-600 mb-6">
            Your session has expired. You will be redirected to the login page.
          </p>

          {/* Loading indicator */}
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-primary-red rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-primary-red rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-primary-red rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};
