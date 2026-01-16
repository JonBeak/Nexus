/**
 * Task Session Edit Request Repository
 * Handles all database operations for task_session_edit_requests table
 *
 * Created: 2025-01-15
 * Pattern: Mirrors EditRequestRepository from time tracking
 */

import { query } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import {
  TaskSessionEditRequest,
  PendingSessionEditRequest,
  SessionEditRequestStatus
} from '../types/taskSessions';

interface CreateEditRequestData {
  session_id: number;
  user_id: number;
  requested_started_at: string;
  requested_ended_at: string | null;
  requested_notes?: string | null;
  reason: string;
}

interface CreateDeleteRequestData {
  session_id: number;
  user_id: number;
  reason: string;
}

/**
 * Task Session Edit Request Repository
 * Handles CRUD operations for task_session_edit_requests table
 */
export class TaskSessionEditRequestRepository {

  /**
   * Cancel existing pending requests for a session
   */
  static async cancelPendingRequests(sessionId: number): Promise<number> {
    const result = await query(
      `UPDATE task_session_edit_requests SET status = 'cancelled' WHERE session_id = ? AND status = 'pending'`,
      [sessionId]
    ) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Create a new edit request
   */
  static async createEditRequest(data: CreateEditRequestData): Promise<number> {
    const result = await query(
      `INSERT INTO task_session_edit_requests
       (session_id, user_id, requested_started_at, requested_ended_at, requested_notes, reason, request_type)
       VALUES (?, ?, ?, ?, ?, ?, 'edit')`,
      [
        data.session_id,
        data.user_id,
        data.requested_started_at,
        data.requested_ended_at,
        data.requested_notes || null,
        data.reason
      ]
    ) as ResultSetHeader;
    return result.insertId;
  }

  /**
   * Create a new delete request
   */
  static async createDeleteRequest(data: CreateDeleteRequestData): Promise<number> {
    const result = await query(
      `INSERT INTO task_session_edit_requests
       (session_id, user_id, requested_started_at, requested_ended_at, requested_notes, reason, request_type)
       VALUES (?, ?, NULL, NULL, NULL, ?, 'delete')`,
      [data.session_id, data.user_id, data.reason]
    ) as ResultSetHeader;
    return result.insertId;
  }

  /**
   * Get all pending edit requests with session, task, and user details
   */
  static async getPendingRequests(): Promise<PendingSessionEditRequest[]> {
    const rows = await query(
      `SELECT
        tser.*,
        ts.started_at as original_started_at,
        ts.ended_at as original_ended_at,
        ts.duration_minutes as original_duration_minutes,
        ts.notes as original_notes,
        ts.task_id,
        ot.task_name,
        o.order_id,
        o.order_number,
        o.order_name,
        u.first_name,
        u.last_name,
        u.username
       FROM task_session_edit_requests tser
       JOIN task_sessions ts ON tser.session_id = ts.session_id
       JOIN order_tasks ot ON ts.task_id = ot.task_id
       JOIN orders o ON ot.order_id = o.order_id
       JOIN users u ON tser.user_id = u.user_id
       WHERE tser.status = 'pending'
       ORDER BY tser.request_type, tser.created_at DESC`,
      []
    ) as RowDataPacket[];
    return rows as PendingSessionEditRequest[];
  }

  /**
   * Get edit request by ID (pending only)
   */
  static async getRequestById(requestId: number): Promise<TaskSessionEditRequest | null> {
    const rows = await query(
      `SELECT * FROM task_session_edit_requests WHERE request_id = ? AND status = 'pending'`,
      [requestId]
    ) as RowDataPacket[];
    return rows.length > 0 ? rows[0] as TaskSessionEditRequest : null;
  }

  /**
   * Get full request with session details (for processing)
   */
  static async getRequestWithSession(requestId: number): Promise<PendingSessionEditRequest | null> {
    const rows = await query(
      `SELECT
        tser.*,
        ts.started_at as original_started_at,
        ts.ended_at as original_ended_at,
        ts.duration_minutes as original_duration_minutes,
        ts.notes as original_notes,
        ts.task_id,
        ot.task_name,
        o.order_id,
        o.order_number,
        o.order_name,
        u.first_name,
        u.last_name,
        u.username
       FROM task_session_edit_requests tser
       JOIN task_sessions ts ON tser.session_id = ts.session_id
       JOIN order_tasks ot ON ts.task_id = ot.task_id
       JOIN orders o ON ot.order_id = o.order_id
       JOIN users u ON tser.user_id = u.user_id
       WHERE tser.request_id = ? AND tser.status = 'pending'`,
      [requestId]
    ) as RowDataPacket[];
    return rows.length > 0 ? rows[0] as PendingSessionEditRequest : null;
  }

  /**
   * Update edit request status
   */
  static async updateRequestStatus(
    requestId: number,
    status: SessionEditRequestStatus,
    reviewedBy: number,
    reviewerNotes?: string
  ): Promise<number> {
    const result = await query(
      `UPDATE task_session_edit_requests
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), reviewer_notes = ?
       WHERE request_id = ?`,
      [status, reviewedBy, reviewerNotes || null, requestId]
    ) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Get session by ID (for validation)
   */
  static async getSessionById(sessionId: number): Promise<RowDataPacket | null> {
    const rows = await query(
      `SELECT ts.*, u.first_name, u.last_name
       FROM task_sessions ts
       JOIN users u ON ts.user_id = u.user_id
       WHERE ts.session_id = ?`,
      [sessionId]
    ) as RowDataPacket[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Check if user owns the session
   */
  static async userOwnsSession(sessionId: number, userId: number): Promise<boolean> {
    const rows = await query(
      'SELECT session_id FROM task_sessions WHERE session_id = ? AND user_id = ?',
      [sessionId, userId]
    ) as RowDataPacket[];
    return rows.length > 0;
  }

  /**
   * Get pending request count (for dashboard badge)
   */
  static async getPendingCount(): Promise<number> {
    const rows = await query(
      `SELECT COUNT(*) as count FROM task_session_edit_requests WHERE status = 'pending'`,
      []
    ) as RowDataPacket[];
    return rows[0]?.count || 0;
  }

  /**
   * Cancel a specific request by ID (user must own the request)
   * Used when staff wants to withdraw their pending request
   */
  static async cancelRequestByUser(requestId: number, userId: number): Promise<boolean> {
    const result = await query(
      `UPDATE task_session_edit_requests
       SET status = 'cancelled'
       WHERE request_id = ? AND user_id = ? AND status = 'pending'`,
      [requestId, userId]
    ) as ResultSetHeader;
    return result.affectedRows > 0;
  }

  /**
   * Get pending request for a specific session and user
   * Used when staff wants to view/update their pending request
   */
  static async getPendingRequestForSession(sessionId: number, userId: number): Promise<TaskSessionEditRequest | null> {
    const rows = await query(
      `SELECT * FROM task_session_edit_requests WHERE session_id = ? AND user_id = ? AND status = 'pending'`,
      [sessionId, userId]
    ) as RowDataPacket[];
    return rows.length > 0 ? rows[0] as TaskSessionEditRequest : null;
  }

  /**
   * Update a pending request (staff can update their own pending requests)
   */
  static async updatePendingRequest(
    requestId: number,
    data: {
      requested_started_at: string;
      requested_ended_at: string | null;
      requested_notes?: string | null;
      reason: string;
    }
  ): Promise<number> {
    const result = await query(
      `UPDATE task_session_edit_requests
       SET requested_started_at = ?, requested_ended_at = ?, requested_notes = ?, reason = ?
       WHERE request_id = ? AND status = 'pending'`,
      [
        data.requested_started_at,
        data.requested_ended_at,
        data.requested_notes || null,
        data.reason,
        requestId
      ]
    ) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Get session info with task and order details (for broadcasts)
   */
  static async getSessionInfoForBroadcast(sessionId: number): Promise<{
    taskName: string;
    orderNumber: string;
    staffName: string;
    userId: number;
  } | null> {
    const rows = await query(
      `SELECT
        ot.task_name,
        o.order_number,
        CONCAT(u.first_name, ' ', u.last_name) as staff_name,
        ts.user_id
       FROM task_sessions ts
       JOIN order_tasks ot ON ts.task_id = ot.task_id
       JOIN orders o ON ot.order_id = o.order_id
       JOIN users u ON ts.user_id = u.user_id
       WHERE ts.session_id = ?`,
      [sessionId]
    ) as RowDataPacket[];
    if (rows.length === 0) return null;
    return {
      taskName: rows[0].task_name,
      orderNumber: String(rows[0].order_number),
      staffName: rows[0].staff_name,
      userId: rows[0].user_id
    };
  }
}
