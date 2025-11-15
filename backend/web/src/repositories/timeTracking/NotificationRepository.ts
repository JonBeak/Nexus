// File Clean up Finished: 2025-11-15
// Changes:
// - Created new NotificationRepository to handle time_edit_notifications table
// - Extracted 5 notification methods from EditRequestRepository
// - Uses query() helper for all database operations
// - Follows single-responsibility principle (one repository per table)
import { query } from '../../config/database';
import { ResultSetHeader } from 'mysql2';
import {
  NotificationWithDetails,
  NotificationData
} from '../../types/TimeTypes';

/**
 * Notification Repository
 * Handles all database operations for time_edit_notifications table
 */
export class NotificationRepository {
  /**
   * Create a notification for edit request action
   * @param data - Notification data
   * @returns Insert ID
   */
  static async createNotification(data: NotificationData): Promise<number> {
    const result = await query(
      `INSERT INTO time_edit_notifications
       (user_id, request_id, action, reviewer_notes, reviewer_name)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.user_id,
        data.request_id,
        data.action,
        data.reviewer_notes,
        data.reviewer_name
      ]
    ) as ResultSetHeader;
    return result.insertId;
  }

  /**
   * Get notifications for a user
   * @param userId - User ID
   * @param showCleared - Whether to include cleared notifications
   * @returns User notifications with details
   */
  static async getUserNotifications(userId: number, showCleared: boolean = false): Promise<NotificationWithDetails[]> {
    let whereClause = 'WHERE n.user_id = ?';
    const params = [userId];

    if (!showCleared) {
      whereClause += ' AND n.is_cleared = FALSE';
    }

    const rows = await query(
      `SELECT
        n.*,
        ter.entry_id,
        te.clock_in as original_clock_in,
        te.clock_out as original_clock_out
       FROM time_edit_notifications n
       JOIN time_edit_requests ter ON n.request_id = ter.request_id
       JOIN time_entries te ON ter.entry_id = te.entry_id
       ${whereClause}
       ORDER BY n.created_at DESC`,
      params
    ) as NotificationWithDetails[];
    return rows;
  }

  /**
   * Mark notification as read
   * @param notificationId - Notification ID
   * @param userId - User ID (for security)
   * @returns Affected rows
   */
  static async markNotificationAsRead(notificationId: number, userId: number): Promise<number> {
    const result = await query(
      'UPDATE time_edit_notifications SET is_read = TRUE WHERE notification_id = ? AND user_id = ?',
      [notificationId, userId]
    ) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Clear notification (hide from default view)
   * @param notificationId - Notification ID
   * @param userId - User ID (for security)
   * @returns Affected rows
   */
  static async clearNotification(notificationId: number, userId: number): Promise<number> {
    const result = await query(
      'UPDATE time_edit_notifications SET is_cleared = TRUE WHERE notification_id = ? AND user_id = ?',
      [notificationId, userId]
    ) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Clear all notifications for a user
   * @param userId - User ID
   * @returns Affected rows
   */
  static async clearAllNotifications(userId: number): Promise<number> {
    const result = await query(
      'UPDATE time_edit_notifications SET is_cleared = TRUE WHERE user_id = ? AND is_cleared = FALSE',
      [userId]
    ) as ResultSetHeader;
    return result.affectedRows;
  }
}
