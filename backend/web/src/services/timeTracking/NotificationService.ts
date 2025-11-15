// File Clean up Finished: 2025-11-15
// Changes:
// - Updated to use new NotificationRepository instead of EditRequestRepository
// - Improved architectural separation (Service → Repository pattern)
// - No business logic changes, only updated repository layer
import { NotificationRepository } from '../../repositories/timeTracking/NotificationRepository';
import { User } from '../../types';
import {
  NotificationWithDetails,
  NotificationData,
  ApiResponse
} from '../../types/TimeTypes';

/**
 * Notification Service
 * Handles notification creation, retrieval, and management business logic
 */
export class NotificationService {
  /**
   * Create a notification for edit request action
   * @param data - Notification data
   * @returns Insert ID
   */
  static async createEditRequestNotification(data: NotificationData): Promise<number> {
    return await NotificationRepository.createNotification(data);
  }

  /**
   * Get notifications for a user
   * @param user - User object
   * @param showCleared - Whether to include cleared notifications
   * @returns User notifications with details
   */
  static async getUserNotifications(user: User, showCleared: boolean = false): Promise<NotificationWithDetails[]> {
    return await NotificationRepository.getUserNotifications(user.user_id, showCleared);
  }

  /**
   * Mark notification as read
   * @param user - User object
   * @param notificationId - Notification ID
   * @returns Success response
   * @throws Error if notification not found or doesn't belong to user
   */
  static async markAsRead(user: User, notificationId: number): Promise<ApiResponse> {
    const affectedRows = await NotificationRepository.markNotificationAsRead(notificationId, user.user_id);

    if (affectedRows === 0) {
      throw new Error('Notification not found');
    }

    return {
      success: true,
      message: 'Notification marked as read'
    };
  }

  /**
   * Clear notification (hide from default view)
   * @param user - User object
   * @param notificationId - Notification ID
   * @returns Success response
   * @throws Error if notification not found or doesn't belong to user
   */
  static async clearNotification(user: User, notificationId: number): Promise<ApiResponse> {
    const affectedRows = await NotificationRepository.clearNotification(notificationId, user.user_id);

    if (affectedRows === 0) {
      throw new Error('Notification not found');
    }

    return {
      success: true,
      message: 'Notification cleared'
    };
  }

  /**
   * Clear all notifications for a user
   * @param user - User object
   * @returns Success response
   */
  static async clearAllNotifications(user: User): Promise<ApiResponse> {
    await NotificationRepository.clearAllNotifications(user.user_id);

    return {
      success: true,
      message: 'All notifications cleared'
    };
  }
}