import { api } from '../../apiClient';

/**
 * Time Notifications API
 * Manages time tracking notifications and alerts
 */
export const timeNotificationsApi = {
  /**
   * Get notifications
   */
  getNotifications: async () => {
    const response = await api.get('/time/notifications');
    return response.data;
  },

  /**
   * Mark notification as read
   */
  markNotificationAsRead: async (notificationId: number) => {
    const response = await api.put(`/time/notifications/${notificationId}/read`);
    return response.data;
  },

  /**
   * Clear all notifications
   */
  clearAllNotifications: async () => {
    const response = await api.put('/time/notifications/clear-all');
    return response.data;
  },
};
