import { pool } from '../../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { 
  TimeEditRequest, 
  PendingEditRequest, 
  EditRequestData,
  TimeEditNotification,
  NotificationWithDetails,
  NotificationData
} from '../../types/TimeTrackingTypes';

/**
 * Edit Request Repository
 * Handles all database operations for time_edit_requests and time_edit_notifications tables
 */
export class EditRequestRepository {
  /**
   * Cancel existing pending requests for an entry
   * @param entryId - Entry ID
   * @returns Affected rows
   */
  static async cancelPendingRequests(entryId: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE time_edit_requests SET status = "cancelled" WHERE entry_id = ? AND status = "pending"',
      [entryId]
    );
    return result.affectedRows;
  }

  /**
   * Create a new edit request
   * @param data - Edit request data
   * @returns Insert ID
   */
  static async createEditRequest(data: EditRequestData): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO time_edit_requests 
       (entry_id, user_id, requested_clock_in, requested_clock_out, requested_break_minutes, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.entry_id,
        data.user_id,
        data.requested_clock_in,
        data.requested_clock_out,
        data.requested_break_minutes,
        data.reason
      ]
    );
    return result.insertId;
  }

  /**
   * Create a new delete request
   * @param data - Delete request data
   * @returns Insert ID
   */
  static async createDeleteRequest(data: { entry_id: number; user_id: number; reason: string }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO time_edit_requests 
       (entry_id, user_id, requested_clock_in, requested_clock_out, requested_break_minutes, reason, request_type)
       VALUES (?, ?, NULL, NULL, NULL, ?, 'delete')`,
      [data.entry_id, data.user_id, data.reason]
    );
    return result.insertId;
  }

  /**
   * Get all pending edit requests
   * @returns Pending requests with user information
   */
  static async getPendingRequests(): Promise<PendingEditRequest[]> {
    const [rows] = await pool.execute<PendingEditRequest[]>(
      `SELECT 
        ter.*,
        te.clock_in as original_clock_in,
        te.clock_out as original_clock_out,
        te.break_minutes as original_break_minutes,
        u.first_name,
        u.last_name,
        u.username
       FROM time_edit_requests ter
       JOIN time_entries te ON ter.entry_id = te.entry_id
       JOIN users u ON ter.user_id = u.user_id
       WHERE ter.status = 'pending'
       ORDER BY ter.request_type, ter.created_at DESC`,
      []
    );
    return rows;
  }

  /**
   * Get edit request by ID
   * @param requestId - Request ID
   * @returns Edit request or null
   */
  static async getRequestById(requestId: number): Promise<TimeEditRequest | null> {
    const [rows] = await pool.execute<TimeEditRequest[]>(
      'SELECT * FROM time_edit_requests WHERE request_id = ? AND status = "pending"',
      [requestId]
    );
    return rows[0] || null;
  }

  /**
   * Update edit request status
   * @param requestId - Request ID
   * @param status - New status
   * @param reviewedBy - Reviewer user ID
   * @param reviewerNotes - Optional reviewer notes
   * @returns Affected rows
   */
  static async updateRequestStatus(
    requestId: number, 
    status: string, 
    reviewedBy: number, 
    reviewerNotes?: string
  ): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE time_edit_requests 
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), reviewer_notes = ?
       WHERE request_id = ?`,
      [status, reviewedBy, reviewerNotes, requestId]
    );
    return result.affectedRows;
  }

  /**
   * Create a notification for edit request action
   * @param data - Notification data
   * @returns Insert ID
   */
  static async createNotification(data: NotificationData): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
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
    );
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
    
    const [rows] = await pool.execute<NotificationWithDetails[]>(
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
    );
    return rows;
  }

  /**
   * Mark notification as read
   * @param notificationId - Notification ID
   * @param userId - User ID (for security)
   * @returns Affected rows
   */
  static async markNotificationAsRead(notificationId: number, userId: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE time_edit_notifications SET is_read = TRUE WHERE notification_id = ? AND user_id = ?',
      [notificationId, userId]
    );
    return result.affectedRows;
  }

  /**
   * Clear notification (hide from default view)
   * @param notificationId - Notification ID
   * @param userId - User ID (for security)
   * @returns Affected rows
   */
  static async clearNotification(notificationId: number, userId: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE time_edit_notifications SET is_cleared = TRUE WHERE notification_id = ? AND user_id = ?',
      [notificationId, userId]
    );
    return result.affectedRows;
  }

  /**
   * Clear all notifications for a user
   * @param userId - User ID
   * @returns Affected rows
   */
  static async clearAllNotifications(userId: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE time_edit_notifications SET is_cleared = TRUE WHERE user_id = ? AND is_cleared = FALSE',
      [userId]
    );
    return result.affectedRows;
  }
}