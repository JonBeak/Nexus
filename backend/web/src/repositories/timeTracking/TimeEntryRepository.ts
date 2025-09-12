import { pool } from '../../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { TimeEntry, TimeEntryData, WeeklySummaryEntry } from '../../types/TimeTrackingTypes';

/**
 * Time Entry Repository
 * Handles all database operations for time_entries table
 */
export class TimeEntryRepository {
  /**
   * Get active time entry for a user
   * @param userId - User ID
   * @returns Active time entry or null
   */
  static async getActiveEntry(userId: number): Promise<TimeEntry | null> {
    const [rows] = await pool.execute<TimeEntry[]>(
      `SELECT entry_id, clock_in, break_minutes, auto_break_minutes 
       FROM time_entries 
       WHERE user_id = ? AND status = 'active' 
       ORDER BY clock_in DESC LIMIT 1`,
      [userId]
    );
    
    return rows[0] || null;
  }

  /**
   * Create a new time entry (clock in)
   * @param data - Time entry data
   * @returns Insert ID
   */
  static async createTimeEntry(data: TimeEntryData): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO time_entries (user_id, clock_in) VALUES (?, ?)',
      [data.user_id, data.clock_in]
    );
    return result.insertId;
  }

  /**
   * Update time entry (clock out)
   * @param entryId - Entry ID
   * @param data - Update data
   * @returns Affected rows
   */
  static async updateTimeEntry(entryId: number, data: Partial<TimeEntryData>): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE time_entries 
       SET clock_out = ?, 
           auto_break_minutes = ?, 
           break_minutes = ?,
           total_hours = ?,
           status = 'completed',
           applied_breaks = ?,
           break_adjustment_notes = ?
       WHERE entry_id = ?`,
      [
        data.clock_out,
        data.auto_break_minutes,
        data.break_minutes,
        data.total_hours,
        data.applied_breaks,
        data.break_adjustment_notes,
        entryId
      ]
    );
    return result.affectedRows;
  }

  /**
   * Get weekly time entries for a user
   * @param userId - User ID
   * @param weekStart - Week start date
   * @param weekEnd - Week end date
   * @returns Weekly time entries with pending requests
   */
  static async getWeeklyEntries(userId: number, weekStart: Date, weekEnd: Date): Promise<WeeklySummaryEntry[]> {
    const [rows] = await pool.execute<WeeklySummaryEntry[]>(
      `SELECT 
        te.*,
        ter.request_id,
        ter.status as request_status,
        ter.requested_clock_in,
        ter.requested_clock_out,
        ter.requested_break_minutes,
        ter.reason
       FROM time_entries te
       LEFT JOIN time_edit_requests ter ON te.entry_id = ter.entry_id 
         AND ter.status = 'pending'
       WHERE te.user_id = ? 
       AND te.clock_in >= ? 
       AND te.clock_in <= ?
       AND te.is_deleted = FALSE
       ORDER BY te.clock_in DESC`,
      [userId, weekStart, weekEnd]
    );
    return rows;
  }

  /**
   * Get time entry by ID and user (for verification)
   * @param entryId - Entry ID
   * @param userId - User ID
   * @returns Time entry or null
   */
  static async getEntryByIdAndUser(entryId: number, userId: number): Promise<RowDataPacket | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT entry_id FROM time_entries WHERE entry_id = ? AND user_id = ?',
      [entryId, userId]
    );
    return rows[0] || null;
  }

  /**
   * Update time entry for edit request approval
   * @param entryId - Entry ID
   * @param data - Update data
   * @returns Affected rows
   */
  static async updateEntryFromRequest(entryId: number, data: {
    clock_in: string;
    clock_out: string;
    break_minutes: number;
    auto_break_minutes: number;
    total_hours: number;
    applied_breaks: string;
    break_adjustment_notes?: string;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE time_entries 
       SET clock_in = ?, clock_out = ?, break_minutes = ?, auto_break_minutes = ?, total_hours = ?, 
           applied_breaks = ?, break_adjustment_notes = ?
       WHERE entry_id = ?`,
      [
        data.clock_in,
        data.clock_out,
        data.break_minutes,
        data.auto_break_minutes,
        data.total_hours,
        data.applied_breaks,
        data.break_adjustment_notes || null,
        entryId
      ]
    );
    return result.affectedRows;
  }

  /**
   * Mark time entry as deleted (soft delete)
   * @param entryId - Entry ID
   * @returns Affected rows
   */
  static async markAsDeleted(entryId: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE time_entries SET is_deleted = TRUE WHERE entry_id = ?',
      [entryId]
    );
    return result.affectedRows;
  }
}