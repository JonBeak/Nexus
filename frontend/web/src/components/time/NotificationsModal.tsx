import React from 'react';
import type { TimeNotification } from '../../types/time';

interface NotificationsModalProps {
  showNotifications: boolean;
  notifications: TimeNotification[];
  showClearedNotifications: boolean;
  onClose: () => void;
  onToggleCleared: () => void;
  onClearAll: () => void;
  onMarkAsRead: (notificationId: number) => void;
}

function NotificationsModal({
  showNotifications,
  notifications,
  showClearedNotifications,
  onClose,
  onToggleCleared,
  onClearAll,
  onMarkAsRead
}: NotificationsModalProps) {
  if (!showNotifications) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-gray-800">Notifications</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={onToggleCleared}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
              >
                {showClearedNotifications ? 'Hide Cleared' : 'Show Cleared'}
              </button>
              <button
                onClick={onClearAll}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={onClose}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {notifications.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No notifications</p>
          ) : (
            <div className="space-y-4">
              {notifications
                .filter(n => showClearedNotifications || !n.is_cleared)
                .map(notification => (
                  <div 
                    key={notification.notification_id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      notification.is_read 
                        ? 'bg-gray-50 border-gray-200' 
                        : 'bg-blue-50 border-blue-200'
                    } ${notification.is_cleared ? 'opacity-60' : ''}`}
                    onClick={() => !notification.is_read && onMarkAsRead(notification.notification_id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            notification.action === 'approved' 
                              ? 'bg-green-100 text-green-800'
                              : notification.action === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {notification.action.charAt(0).toUpperCase() + notification.action.slice(1)}
                          </span>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          Request {notification.action} by {notification.reviewer_name}
                        </p>
                        {notification.reviewer_notes && (
                          <p className="text-sm text-gray-800 italic">
                            "{notification.reviewer_notes}"
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationsModal;
