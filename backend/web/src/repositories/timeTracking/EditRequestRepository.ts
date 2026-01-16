// File Clean up Finished: 2025-11-15
// Changes:
// - Migrated all pool.execute() calls to query() helper (11 instances)
// - All methods now use centralized error logging and performance monitoring
// File Clean up Finished: 2025-11-15 (Second pass - architectural refactoring)
// Changes:
// - Extracted 5 notification methods to new NotificationRepository
// - Removed unused imports (TimeEditNotification, NotificationWithDetails, NotificationData, RowDataPacket)
// - Now focuses solely on time_edit_requests table (single-responsibility)
// - Reduced from 219 lines → 129 lines (41% reduction)
import { query } from '../../config/database';
import { ResultSetHeader } from 'mysql2';
import {
  TimeEditRequest,
  PendingEditRequest,
  EditRequestData
} from '../../types/TimeTypes';

/**
 * Edit Request Repository
 * Handles all database operations for time_edit_requests table
 */
export class EditRequestRepository {
  /**
   * Cancel existing pending requests for an entry
   * @param entryId - Entry ID
   * @returns Affected rows
   */
  static async cancelPendingRequests(entryId: number): Promise<number> {
    const result = await query(
      'UPDATE time_edit_requests SET status = "cancelled" WHERE entry_id = ? AND status = "pending"',
      [entryId]
    ) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Create a new edit request
   * @param data - Edit request data
   * @returns Insert ID
   */
  static async createEditRequest(data: EditRequestData): Promise<number> {
    const result = await query(
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
    ) as ResultSetHeader;
    return result.insertId;
  }

  /**
   * Create a new delete request
   * @param data - Delete request data
   * @returns Insert ID
   */
  static async createDeleteRequest(data: { entry_id: number; user_id: number; reason: string }): Promise<number> {
    const result = await query(
      `INSERT INTO time_edit_requests
       (entry_id, user_id, requested_clock_in, requested_clock_out, requested_break_minutes, reason, request_type)
       VALUES (?, ?, NULL, NULL, NULL, ?, 'delete')`,
      [data.entry_id, data.user_id, data.reason]
    ) as ResultSetHeader;
    return result.insertId;
  }

  /**
   * Get all pending edit requests
   * @returns Pending requests with user information
   */
  static async getPendingRequests(): Promise<PendingEditRequest[]> {
    const rows = await query(
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
    ) as PendingEditRequest[];
    return rows;
  }

  /**
   * Get edit request by ID
   * @param requestId - Request ID
   * @returns Edit request or null
   */
  static async getRequestById(requestId: number): Promise<TimeEditRequest | null> {
    const rows = await query(
      'SELECT * FROM time_edit_requests WHERE request_id = ? AND status = "pending"',
      [requestId]
    ) as TimeEditRequest[];
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
    const result = await query(
      `UPDATE time_edit_requests
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), reviewer_notes = ?
       WHERE request_id = ?`,
      [status, reviewedBy, reviewerNotes, requestId]
    ) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Get pending request count (for dashboard badge)
   * @returns Count of pending requests
   */
  static async getPendingCount(): Promise<number> {
    const rows = await query(
      'SELECT COUNT(*) as count FROM time_edit_requests WHERE status = "pending"',
      []
    ) as Array<{ count: number }>;
    return rows[0]?.count || 0;
  }

}