/**
 * Task Session Repository
 * Data Access Layer for Task Sessions
 *
 * Created: 2025-01-07
 * Handles all direct database operations for task work sessions
 */

import { query, pool } from '../config/database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import {
  TaskSession,
  CreateSessionData,
  UpdateSessionData,
  StaffTask,
  StaffTaskFilters,
  SessionNote,
  CreateSessionNoteData,
  UpdateSessionNoteData
} from '../types/taskSessions';
import { ProductionRole } from '../types/orders';

export class TaskSessionRepository {

  // =============================================
  // SESSION CRUD OPERATIONS
  // =============================================

  /**
   * Create a new task session
   */
  async createSession(data: CreateSessionData, connection?: PoolConnection): Promise<number> {
    const conn = connection || pool;

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO task_sessions (task_id, user_id, notes)
       VALUES (?, ?, ?)`,
      [data.task_id, data.user_id, data.notes || null]
    );

    return result.insertId;
  }

  /**
   * End a session (set ended_at to now)
   */
  async endSession(sessionId: number, connection?: PoolConnection): Promise<void> {
    const conn = connection || pool;

    await conn.execute(
      `UPDATE task_sessions SET ended_at = NOW() WHERE session_id = ?`,
      [sessionId]
    );
  }

  /**
   * Get a session by ID
   */
  async getSessionById(sessionId: number): Promise<TaskSession | null> {
    const rows = await query(
      `SELECT ts.*, u.first_name as user_first_name, u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM task_sessions ts
       JOIN users u ON ts.user_id = u.user_id
       WHERE ts.session_id = ?`,
      [sessionId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0] as TaskSession : null;
  }

  /**
   * Get ALL active sessions for a user (for multiple concurrent tasks)
   */
  async getActiveSessionsForUser(userId: number): Promise<TaskSession[]> {
    const rows = await query(
      `SELECT ts.*, u.first_name as user_first_name, u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM task_sessions ts
       JOIN users u ON ts.user_id = u.user_id
       WHERE ts.user_id = ? AND ts.ended_at IS NULL
       ORDER BY ts.started_at ASC`,
      [userId]
    ) as RowDataPacket[];

    return rows as TaskSession[];
  }

  /**
   * Get active session for a user on a specific task
   */
  async getActiveSessionForUserTask(userId: number, taskId: number): Promise<TaskSession | null> {
    const rows = await query(
      `SELECT ts.*, u.first_name as user_first_name, u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM task_sessions ts
       JOIN users u ON ts.user_id = u.user_id
       WHERE ts.user_id = ? AND ts.task_id = ? AND ts.ended_at IS NULL
       LIMIT 1`,
      [userId, taskId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0] as TaskSession : null;
  }

  /**
   * Get all active sessions for a task (multiple staff can work on same task)
   */
  async getActiveSessionsForTask(taskId: number): Promise<TaskSession[]> {
    const rows = await query(
      `SELECT ts.*, u.first_name as user_first_name, u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM task_sessions ts
       JOIN users u ON ts.user_id = u.user_id
       WHERE ts.task_id = ? AND ts.ended_at IS NULL
       ORDER BY ts.started_at ASC`,
      [taskId]
    ) as RowDataPacket[];

    return rows as TaskSession[];
  }

  /**
   * Get all sessions for a task (history)
   */
  async getSessionsForTask(taskId: number): Promise<TaskSession[]> {
    const rows = await query(
      `SELECT ts.*, u.first_name as user_first_name, u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM task_sessions ts
       JOIN users u ON ts.user_id = u.user_id
       WHERE ts.task_id = ?
       ORDER BY ts.started_at DESC`,
      [taskId]
    ) as RowDataPacket[];

    return rows as TaskSession[];
  }

  /**
   * Get total time spent on a task (sum of all session durations)
   * Returns minutes
   */
  async getTotalTaskTime(taskId: number): Promise<number> {
    const rows = await query(
      `SELECT COALESCE(SUM(
        CASE
          WHEN ended_at IS NULL THEN TIMESTAMPDIFF(MINUTE, started_at, NOW())
          ELSE duration_minutes
        END
       ), 0) as total_minutes
       FROM task_sessions
       WHERE task_id = ?`,
      [taskId]
    ) as RowDataPacket[];

    return rows[0]?.total_minutes || 0;
  }

  /**
   * Update session (for editing times/notes)
   */
  async updateSession(sessionId: number, data: UpdateSessionData, connection?: PoolConnection): Promise<void> {
    const conn = connection || pool;
    const updates: string[] = [];
    const values: any[] = [];

    if (data.started_at !== undefined) {
      updates.push('started_at = ?');
      values.push(data.started_at);
    }

    if (data.ended_at !== undefined) {
      updates.push('ended_at = ?');
      values.push(data.ended_at);
    }

    if (data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(data.notes);
    }

    if (updates.length === 0) return;

    values.push(sessionId);

    await conn.execute(
      `UPDATE task_sessions SET ${updates.join(', ')} WHERE session_id = ?`,
      values
    );
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: number, connection?: PoolConnection): Promise<void> {
    const conn = connection || pool;

    await conn.execute(
      `DELETE FROM task_sessions WHERE session_id = ?`,
      [sessionId]
    );
  }

  /**
   * End all active sessions for a user (used by clock-out)
   * Returns count of sessions ended
   */
  async endAllUserSessions(userId: number, connection?: PoolConnection): Promise<number> {
    const conn = connection || pool;

    const [result] = await conn.execute<ResultSetHeader>(
      `UPDATE task_sessions SET ended_at = NOW()
       WHERE user_id = ? AND ended_at IS NULL`,
      [userId]
    );

    return result.affectedRows;
  }

  /**
   * End all active sessions for a task (used when completing task)
   * Returns array of user_ids whose sessions were ended
   */
  async endAllTaskSessions(taskId: number, connection?: PoolConnection): Promise<number[]> {
    const conn = connection || pool;

    // First get the user_ids of active sessions
    const [activeRows] = await conn.execute<RowDataPacket[]>(
      `SELECT DISTINCT user_id FROM task_sessions
       WHERE task_id = ? AND ended_at IS NULL`,
      [taskId]
    );

    const userIds = activeRows.map(row => row.user_id);

    // Then end all sessions
    await conn.execute(
      `UPDATE task_sessions SET ended_at = NOW()
       WHERE task_id = ? AND ended_at IS NULL`,
      [taskId]
    );

    return userIds;
  }

  // =============================================
  // TODAY'S SESSIONS QUERIES
  // =============================================

  /**
   * Get all completed sessions for a user today
   * Returns sessions with task/order info for display
   * Includes pending edit request status
   */
  async getTodayCompletedSessionsForUser(userId: number): Promise<any[]> {
    const rows = await query(
      `SELECT
        ts.session_id,
        ts.task_id,
        ts.user_id,
        ts.started_at,
        ts.ended_at,
        ts.duration_minutes,
        ts.effective_duration_minutes,
        ts.notes,
        ot.task_name,
        o.order_id,
        o.order_number,
        o.order_name,
        CASE WHEN ser.request_id IS NOT NULL THEN 1 ELSE 0 END as has_pending_request,
        ser.request_type as pending_request_type
       FROM task_sessions ts
       JOIN order_tasks ot ON ts.task_id = ot.task_id
       JOIN orders o ON ot.order_id = o.order_id
       LEFT JOIN task_session_edit_requests ser
         ON ts.session_id = ser.session_id AND ser.status = 'pending'
       WHERE ts.user_id = ?
         AND ts.ended_at IS NOT NULL
         AND DATE(ts.ended_at) = CURDATE()
       ORDER BY ts.ended_at DESC`,
      [userId]
    ) as RowDataPacket[];

    return rows;
  }

  // =============================================
  // STAFF TASK QUERIES (with session aggregates)
  // =============================================

  /**
   * Get tasks for a user by their production roles
   * Returns sanitized data (no customer info, internal notes, or pricing)
   */
  async getTasksByRolesForStaff(
    userId: number,
    roles: ProductionRole[],
    filters: StaffTaskFilters = {}
  ): Promise<StaffTask[]> {
    if (roles.length === 0) {
      return [];
    }

    const { include_completed = false, hours_back, search } = filters;

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: any[] = [];

    // Role filter
    const rolePlaceholders = roles.map(() => '?').join(',');
    conditions.push(`ot.assigned_role IN (${rolePlaceholders})`);
    params.push(...roles);

    // Completed filter
    if (!include_completed) {
      conditions.push('ot.completed = 0');
    }

    // Order status filter (only show tasks from orders in production)
    conditions.push(`o.status IN ('production_queue', 'in_production', 'overdue', 'qc_packing')`);

    // Time filter (hours back from due date)
    if (hours_back && hours_back > 0) {
      conditions.push(`(o.due_date IS NULL OR o.due_date <= DATE_ADD(NOW(), INTERVAL ? HOUR))`);
      params.push(hours_back);
    }

    // Search filter
    if (search && search.trim()) {
      conditions.push(`(ot.task_name LIKE ? OR o.order_number LIKE ?)`);
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Main query - sanitized for staff (no customer_id join, no internal notes, no pricing)
    const rows = await query(
      `SELECT
        ot.task_id,
        ot.task_name,
        ot.order_id,
        o.order_number,
        o.order_name,
        ot.part_id,
        COALESCE(op.product_type, 'Order-level task') as part_description,
        op.product_type,
        op.specifications,
        o.due_date,
        o.hard_due_date_time,
        ot.assigned_role,
        ot.completed,
        ot.completed_at,
        ot.notes,
        ot.sort_order,
        -- Session aggregates
        (SELECT COUNT(*) FROM task_sessions ts WHERE ts.task_id = ot.task_id AND ts.ended_at IS NULL) as active_sessions_count,
        (SELECT COUNT(*) FROM task_sessions ts WHERE ts.task_id = ot.task_id) as total_sessions_count,
        COALESCE((
          SELECT SUM(
            CASE
              WHEN ts2.ended_at IS NULL THEN TIMESTAMPDIFF(MINUTE, ts2.started_at, NOW())
              ELSE ts2.duration_minutes
            END
          )
          FROM task_sessions ts2 WHERE ts2.task_id = ot.task_id
        ), 0) as total_time_minutes,
        -- Notes count (across all sessions for this task)
        (SELECT COUNT(*)
         FROM task_session_notes tsn
         JOIN task_sessions ts ON tsn.session_id = ts.session_id
         WHERE ts.task_id = ot.task_id) as notes_count,
        -- Most recent note preview
        (SELECT tsn.note_text
         FROM task_session_notes tsn
         JOIN task_sessions ts ON tsn.session_id = ts.session_id
         WHERE ts.task_id = ot.task_id
         ORDER BY tsn.created_at DESC
         LIMIT 1) as latest_note
       FROM order_tasks ot
       JOIN orders o ON ot.order_id = o.order_id
       LEFT JOIN order_parts op ON ot.part_id = op.part_id
       ${whereClause}
       ORDER BY
         ot.completed ASC,
         o.due_date IS NULL ASC,
         o.due_date ASC,
         o.order_number ASC,
         ot.sort_order ASC`,
      params
    ) as RowDataPacket[];

    // Get user's active sessions (can have multiple now)
    const activeSessions = await this.getActiveSessionsForUser(userId);
    const activeSessionsByTaskId = new Map(activeSessions.map(s => [s.task_id, s]));

    return rows.map(row => ({
      ...row,
      specifications: typeof row.specifications === 'string'
        ? JSON.parse(row.specifications)
        : row.specifications,
      my_active_session: activeSessionsByTaskId.get(row.task_id) || null
    })) as StaffTask[];
  }

  // =============================================
  // VALIDATION QUERIES
  // =============================================

  /**
   * Check if task exists and is not completed
   */
  async isTaskAvailable(taskId: number): Promise<boolean> {
    const rows = await query(
      `SELECT task_id FROM order_tasks WHERE task_id = ? AND completed = 0`,
      [taskId]
    ) as RowDataPacket[];

    return rows.length > 0;
  }

  /**
   * Get task's assigned role
   */
  async getTaskRole(taskId: number): Promise<ProductionRole | null> {
    const rows = await query(
      `SELECT assigned_role FROM order_tasks WHERE task_id = ?`,
      [taskId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].assigned_role : null;
  }

  /**
   * Get task's order_id
   */
  async getTaskOrderId(taskId: number): Promise<number | null> {
    const rows = await query(
      `SELECT order_id FROM order_tasks WHERE task_id = ?`,
      [taskId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].order_id : null;
  }

  /**
   * Get user's production roles
   */
  async getUserProductionRoles(userId: number): Promise<ProductionRole[]> {
    const rows = await query(
      `SELECT production_roles FROM users WHERE user_id = ?`,
      [userId]
    ) as RowDataPacket[];

    if (rows.length === 0 || !rows[0].production_roles) {
      return [];
    }

    const roles = rows[0].production_roles;
    return typeof roles === 'string' ? JSON.parse(roles) : roles;
  }

  /**
   * Get user's full name
   */
  async getUserName(userId: number): Promise<string | null> {
    const rows = await query(
      `SELECT CONCAT(first_name, ' ', last_name) as full_name FROM users WHERE user_id = ?`,
      [userId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].full_name : null;
  }

  /**
   * Get user's system role (owner, manager, designer, production_staff)
   */
  async getUserRole(userId: number): Promise<string | null> {
    const rows = await query(
      `SELECT role FROM users WHERE user_id = ?`,
      [userId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].role : null;
  }

  /**
   * Check if user is currently clocked in
   */
  async isUserClockedIn(userId: number): Promise<boolean> {
    const rows = await query(
      `SELECT entry_id FROM time_entries WHERE user_id = ? AND status = 'active' LIMIT 1`,
      [userId]
    ) as RowDataPacket[];

    return rows.length > 0;
  }

  // =============================================
  // SESSION NOTES (Per-user notes on sessions)
  // =============================================

  /**
   * Get all notes for a session
   */
  async getNotesForSession(sessionId: number): Promise<SessionNote[]> {
    const rows = await query(
      `SELECT sn.*,
              u.first_name as user_first_name,
              u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM task_session_notes sn
       JOIN users u ON sn.user_id = u.user_id
       WHERE sn.session_id = ?
       ORDER BY sn.created_at ASC`,
      [sessionId]
    ) as RowDataPacket[];

    return rows as SessionNote[];
  }

  /**
   * Get notes for multiple sessions (batch load)
   */
  async getNotesForSessions(sessionIds: number[]): Promise<Map<number, SessionNote[]>> {
    if (sessionIds.length === 0) {
      return new Map();
    }

    const placeholders = sessionIds.map(() => '?').join(',');
    const rows = await query(
      `SELECT sn.*,
              u.first_name as user_first_name,
              u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM task_session_notes sn
       JOIN users u ON sn.user_id = u.user_id
       WHERE sn.session_id IN (${placeholders})
       ORDER BY sn.session_id, sn.created_at ASC`,
      sessionIds
    ) as RowDataPacket[];

    const notesBySession = new Map<number, SessionNote[]>();
    for (const row of rows) {
      const notes = notesBySession.get(row.session_id) || [];
      notes.push(row as SessionNote);
      notesBySession.set(row.session_id, notes);
    }

    return notesBySession;
  }

  /**
   * Get a note by ID
   */
  async getNoteById(noteId: number): Promise<SessionNote | null> {
    const rows = await query(
      `SELECT sn.*,
              u.first_name as user_first_name,
              u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM task_session_notes sn
       JOIN users u ON sn.user_id = u.user_id
       WHERE sn.note_id = ?`,
      [noteId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0] as SessionNote : null;
  }

  /**
   * Create a new session note
   */
  async createNote(data: CreateSessionNoteData): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO task_session_notes (session_id, user_id, note_text)
       VALUES (?, ?, ?)`,
      [data.session_id, data.user_id, data.note_text]
    );

    return result.insertId;
  }

  /**
   * Update a note (caller must verify ownership)
   */
  async updateNote(noteId: number, data: UpdateSessionNoteData): Promise<void> {
    await pool.execute(
      `UPDATE task_session_notes SET note_text = ? WHERE note_id = ?`,
      [data.note_text, noteId]
    );
  }

  /**
   * Delete a note (caller must verify ownership)
   */
  async deleteNote(noteId: number): Promise<void> {
    await pool.execute(
      `DELETE FROM task_session_notes WHERE note_id = ?`,
      [noteId]
    );
  }

  /**
   * Get all notes for a task (across all sessions)
   */
  async getNotesForTask(taskId: number): Promise<SessionNote[]> {
    const rows = await query(
      `SELECT sn.*,
              u.first_name as user_first_name,
              u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM task_session_notes sn
       JOIN task_sessions ts ON sn.session_id = ts.session_id
       JOIN users u ON sn.user_id = u.user_id
       WHERE ts.task_id = ?
       ORDER BY sn.created_at DESC`,
      [taskId]
    ) as RowDataPacket[];

    return rows as SessionNote[];
  }

  // =============================================
  // EFFECTIVE DURATION (Fractional Time Tracking)
  // =============================================

  /**
   * Update the effective duration for a completed session
   * This stores the proportionally calculated duration accounting for concurrent sessions
   */
  async updateEffectiveDuration(
    sessionId: number,
    effectiveMinutes: number,
    connection?: PoolConnection
  ): Promise<void> {
    const conn = connection || pool;
    await conn.execute(
      `UPDATE task_sessions SET effective_duration_minutes = ? WHERE session_id = ?`,
      [effectiveMinutes, sessionId]
    );
  }

  /**
   * Get overlapping sessions for effective duration calculation
   * Returns sessions that overlap with the given time range for the same user
   * Excludes the session being calculated
   */
  async getOverlappingSessions(
    sessionId: number,
    userId: number,
    sessionStart: Date,
    sessionEnd: Date
  ): Promise<{ session_id: number; started_at: Date; ended_at: Date | null }[]> {
    const rows = await query(
      `SELECT session_id, started_at, ended_at
       FROM task_sessions
       WHERE user_id = ?
         AND session_id != ?
         AND started_at < ?
         AND (ended_at > ? OR ended_at IS NULL)`,
      [userId, sessionId, sessionEnd, sessionStart]
    ) as RowDataPacket[];

    return rows as { session_id: number; started_at: Date; ended_at: Date | null }[];
  }

  /**
   * Get completed sessions in a time range for a user
   * Used for recalculating affected sessions after edits
   */
  async getCompletedSessionsInRange(
    userId: number,
    rangeStart: Date,
    rangeEnd: Date
  ): Promise<TaskSession[]> {
    const rows = await query(
      `SELECT ts.*, u.first_name as user_first_name, u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM task_sessions ts
       JOIN users u ON ts.user_id = u.user_id
       WHERE ts.user_id = ?
         AND ts.ended_at IS NOT NULL
         AND ts.started_at < ?
         AND ts.ended_at > ?
       ORDER BY ts.started_at ASC`,
      [userId, rangeEnd, rangeStart]
    ) as RowDataPacket[];

    return rows as TaskSession[];
  }

  /**
   * Get sessions that were just ended (within last minute) for a user
   * Used after clock-out to calculate effective durations
   */
  async getJustEndedSessionsForUser(userId: number): Promise<TaskSession[]> {
    const rows = await query(
      `SELECT ts.*, u.first_name as user_first_name, u.last_name as user_last_name,
              CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM task_sessions ts
       JOIN users u ON ts.user_id = u.user_id
       WHERE ts.user_id = ?
         AND ts.ended_at IS NOT NULL
         AND ts.ended_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
       ORDER BY ts.started_at ASC`,
      [userId]
    ) as RowDataPacket[];

    return rows as TaskSession[];
  }
}

// Export singleton instance
export const taskSessionRepository = new TaskSessionRepository();
