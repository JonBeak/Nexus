import { EditRequestRepository } from '../../repositories/timeTracking/EditRequestRepository';
import { User } from '../../types';
import { 
  NotificationWithDetails,
  NotificationData,
  ApiResponse 
} from '../../types/TimeTrackingTypes';

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
    return await EditRequestRepository.createNotification(data);
  }

  /**
   * Get notifications for a user
   * @param user - User object
   * @param showCleared - Whether to include cleared notifications
   * @returns User notifications with details
   */
  static async getUserNotifications(user: User, showCleared: boolean = false): Promise<NotificationWithDetails[]> {
    return await EditRequestRepository.getUserNotifications(user.user_id, showCleared);
  }

  /**
   * Mark notification as read
   * @param user - User object
   * @param notificationId - Notification ID
   * @returns Success response
   * @throws Error if notification not found or doesn't belong to user
   */
  static async markAsRead(user: User, notificationId: number): Promise<ApiResponse> {
    const affectedRows = await EditRequestRepository.markNotificationAsRead(notificationId, user.user_id);
    
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
    const affectedRows = await EditRequestRepository.clearNotification(notificationId, user.user_id);
    
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
    await EditRequestRepository.clearAllNotifications(user.user_id);

    return { 
      success: true,
      message: 'All notifications cleared' 
    };
  }
}