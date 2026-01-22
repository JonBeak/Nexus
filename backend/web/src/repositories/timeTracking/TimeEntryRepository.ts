// File Clean up Finished: 2025-11-15
// Changes:
// - Migrated all pool.execute() calls to query() helper (15 instances)
// - All methods now use centralized error logging and performance monitoring
//
// Updated: 2025-11-20
// - Added forExport parameter to findEntries() method
// - Updated import path for SharedQueryBuilder (moved from utils to repositories)
import { query } from '../../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import {
  TimeEntryDB as TimeEntry,
  TimeEntryData,
  WeeklySummaryEntry,
  TimeEntryDTO,
  TimeEntryFilters,
  TimeEntryUpdateData,
  SimpleUser
} from '../../types/TimeTypes';
import { SharedQueryBuilder } from './SharedQueryBuilder';

/**
 * Time Entry Repository
 * Handles all database operations for time_entries table
 * Expanded with CRUD operations for time management refactoring
 */
export class TimeEntryRepository {
  /**
   * Get active time entry for a user
   * @param userId - User ID
   * @returns Active time entry or null
   */
  static async getActiveEntry(userId: number): Promise<TimeEntry | null> {
    const rows = await query(
      `SELECT te.entry_id, te.clock_in, te.break_minutes, te.auto_break_minutes
       FROM time_entries te
       WHERE te.user_id = ?
         AND te.clock_out IS NULL
         AND te.is_deleted = FALSE
         -- Ensure this is the ONLY incomplete entry
         AND NOT EXISTS (
           SELECT 1 FROM time_entries te2
           WHERE te2.user_id = te.user_id
             AND te2.clock_out IS NULL
             AND te2.is_deleted = FALSE
             AND te2.entry_id != te.entry_id
         )
         -- Ensure this is the most recent entry overall
         AND NOT EXISTS (
           SELECT 1 FROM time_entries te3
           WHERE te3.user_id = te.user_id
             AND te3.clock_in > te.clock_in
             AND te3.is_deleted = FALSE
         )
       LIMIT 1`,
      [userId]
    ) as TimeEntry[];

    return rows[0] || null;
  }

  /**
   * Create a new time entry (clock in)
   * @param data - Time entry data
   * @returns Insert ID
   */
  static async createTimeEntry(data: TimeEntryData): Promise<number> {
    const result = await query(
      'INSERT INTO time_entries (user_id, clock_in) VALUES (?, ?)',
      [data.user_id, data.clock_in]
    ) as ResultSetHeader;
    return result.insertId;
  }

  /**
   * Update time entry (clock out)
   * @param entryId - Entry ID
   * @param data - Update data
   * @returns Affected rows
   */
  static async updateTimeEntry(entryId: number, data: Partial<TimeEntryData>): Promise<number> {
    const result = await query(
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
    ) as ResultSetHeader;
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
    const rows = await query(
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
    ) as WeeklySummaryEntry[];
    return rows;
  }

  /**
   * Get time entry by ID and user (for verification)
   * @param entryId - Entry ID
   * @param userId - User ID
   * @returns Time entry or null
   */
  static async getEntryByIdAndUser(entryId: number, userId: number): Promise<RowDataPacket | null> {
    const rows = await query(
      'SELECT entry_id FROM time_entries WHERE entry_id = ? AND user_id = ?',
      [entryId, userId]
    ) as RowDataPacket[];
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
    const result = await query(
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
    ) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Mark time entry as deleted (soft delete)
   * @param entryId - Entry ID
   * @returns Affected rows
   */
  static async markAsDeleted(entryId: number): Promise<number> {
    const result = await query(
      'UPDATE time_entries SET is_deleted = TRUE WHERE entry_id = ?',
      [entryId]
    ) as ResultSetHeader;
    return result.affectedRows;
  }

  // ============================================================================
  // NEW METHODS FOR TIME MANAGEMENT REFACTORING (Iteration 2)
  // ============================================================================

  /**
   * Find time entries with filters
   * Uses SharedQueryBuilder for consistent query logic
   * @param filters - Query filters
   * @param forExport - If true, returns export-optimized columns
   * @returns Array of time entries
   */
  static async findEntries(filters: TimeEntryFilters, forExport: boolean = false): Promise<TimeEntryDTO[]> {
    const { sql, params } = SharedQueryBuilder.buildTimeEntriesQuery(filters, forExport);
    const rows = await query(sql, params) as RowDataPacket[];
    return rows as TimeEntryDTO[];
  }

  /**
   * Create new time entry
   * @param data - Entry data
   * @returns Insert ID
   */
  static async createEntry(data: {
    user_id: number;
    clock_in: string;
    clock_out: string | null;
    break_minutes: number;
    total_hours: number;
    status: string;
    notes: string;
  }): Promise<number> {
    const result = await query(
      `INSERT INTO time_entries (user_id, clock_in, clock_out, break_minutes, total_hours, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        data.user_id,
        data.clock_in,
        data.clock_out,
        data.break_minutes,
        data.total_hours,
        data.status,
        data.notes
      ]
    ) as ResultSetHeader;
    return result.insertId;
  }

  /**
   * Update time entry
   * Includes payroll field synchronization
   * @param entryId - Entry ID
   * @param data - Update data
   * @returns Affected rows
   */
  static async updateEntry(entryId: number, data: TimeEntryUpdateData): Promise<number> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // Build dynamic update query
    if (data.clock_in !== undefined) {
      updateFields.push('clock_in = ?');
      updateValues.push(data.clock_in);
      // Sync payroll clock_in (extract time portion)
      updateFields.push('payroll_clock_in = TIME(?)');
      updateValues.push(data.clock_in);
    }

    if (data.clock_out !== undefined) {
      updateFields.push('clock_out = ?');
      updateValues.push(data.clock_out);
      // Sync payroll clock_out (extract time portion)
      updateFields.push('payroll_clock_out = TIME(?)');
      updateValues.push(data.clock_out);
    }

    if (data.break_minutes !== undefined) {
      updateFields.push('break_minutes = ?');
      updateValues.push(Number(data.break_minutes));
      // Sync payroll break_minutes
      updateFields.push('payroll_break_minutes = ?');
      updateValues.push(Number(data.break_minutes));
    }

    // Recalculate total hours and payroll total hours (2 decimal precision)
    updateFields.push('total_hours = ROUND((TIMESTAMPDIFF(MINUTE, clock_in, clock_out) - break_minutes) / 60, 2)');
    updateFields.push('payroll_total_hours = ROUND((TIMESTAMPDIFF(MINUTE, clock_in, clock_out) - break_minutes) / 60, 2)');
    updateFields.push('payroll_adjusted = 0'); // Reset since we're syncing
    updateFields.push('updated_at = NOW()');

    const sql = `
      UPDATE time_entries
      SET ${updateFields.join(', ')}
      WHERE entry_id = ?
    `;

    const result = await query(sql, [...updateValues, entryId]) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Get time entry by ID
   * @param entryId - Entry ID
   * @returns Time entry or null
   */
  static async getEntryById(entryId: number): Promise<RowDataPacket | null> {
    const rows = await query(
      'SELECT * FROM time_entries WHERE entry_id = ? AND is_deleted = 0',
      [entryId]
    ) as RowDataPacket[];
    return rows[0] || null;
  }

  /**
   * Soft delete time entry
   * @param entryId - Entry ID
   * @returns Affected rows
   */
  static async deleteEntry(entryId: number): Promise<number> {
    const result = await query(
      'UPDATE time_entries SET is_deleted = 1, updated_at = NOW() WHERE entry_id = ?',
      [entryId]
    ) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Bulk update time entries
   * @param entryIds - Array of entry IDs
   * @param updates - Update data
   * @returns Affected rows
   */
  static async bulkUpdate(entryIds: number[], updates: TimeEntryUpdateData): Promise<number> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // Build dynamic update query
    if (updates.clock_in !== undefined) {
      updateFields.push('clock_in = ?');
      updateValues.push(updates.clock_in);
      // Sync payroll clock_in
      updateFields.push('payroll_clock_in = TIME(?)');
      updateValues.push(updates.clock_in);
    }

    if (updates.clock_out !== undefined) {
      updateFields.push('clock_out = ?');
      updateValues.push(updates.clock_out);
      // Sync payroll clock_out
      updateFields.push('payroll_clock_out = TIME(?)');
      updateValues.push(updates.clock_out);
    }

    if (updates.break_minutes !== undefined) {
      updateFields.push('break_minutes = ?');
      updateValues.push(updates.break_minutes);
      // Sync payroll break_minutes
      updateFields.push('payroll_break_minutes = ?');
      updateValues.push(updates.break_minutes);
    }

    // Recalculate total hours if times are updated
    if (updates.clock_in !== undefined || updates.clock_out !== undefined || updates.break_minutes !== undefined) {
      updateFields.push('total_hours = ROUND((TIMESTAMPDIFF(MINUTE, clock_in, clock_out) - break_minutes) / 60, 2)');
      updateFields.push('payroll_total_hours = ROUND((TIMESTAMPDIFF(MINUTE, clock_in, clock_out) - break_minutes) / 60, 2)');
      updateFields.push('payroll_adjusted = 0'); // Reset since we're syncing
    }

    const sql = `
      UPDATE time_entries
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE entry_id IN (${entryIds.map(() => '?').join(',')})
    `;

    const result = await query(sql, [...updateValues, ...entryIds]) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Bulk soft delete time entries
   * @param entryIds - Array of entry IDs
   * @returns Affected rows
   */
  static async bulkDelete(entryIds: number[]): Promise<number> {
    const sql = `
      UPDATE time_entries
      SET is_deleted = 1, updated_at = NOW()
      WHERE entry_id IN (${entryIds.map(() => '?').join(',')})
    `;

    const result = await query(sql, entryIds) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Get active users list
   * @returns Array of active users
   */
  static async getActiveUsers(): Promise<SimpleUser[]> {
    const rows = await query(
      `SELECT user_id, username, first_name, last_name, email, role, show_in_time_calendar, user_group
       FROM users
       WHERE is_active = 1 AND show_in_time_calendar = 1
       ORDER BY first_name, last_name`
    ) as RowDataPacket[];
    return rows as SimpleUser[];
  }
}