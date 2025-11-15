// File Clean up Finished: Nov 14, 2025
// Changes:
// - Migrated from pool.execute() to query() helper (architectural requirement)
// - Removed array destructuring ([rows]) - query() returns rows directly
// - Added proper type assertions for ResultSetHeader and ScheduledBreak[]
// - Follows DATABASE_QUERY_STANDARDIZATION_PLAN.md
import { query } from '../../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { ScheduledBreak } from '../../types/TimeTypes';

/**
 * Break Schedule Repository
 * Handles all database operations for scheduled_breaks table
 *
 * Part of Enhanced Three-Layer Architecture:
 * Route → Controller → Service → Repository → Database
 */
export class BreakScheduleRepository {
  /**
   * Get scheduled breaks for a specific day
   * @param dayOfWeek - Day name (e.g., "Monday")
   * @returns Scheduled breaks for the day
   */
  static async getBreaksForDay(dayOfWeek: string): Promise<ScheduledBreak[]> {
    const rows = await query(
      `SELECT break_id, break_name, start_time, end_time, duration_minutes
       FROM scheduled_breaks
       WHERE is_active = 1
       AND FIND_IN_SET(?, days_of_week) > 0
       ORDER BY start_time`,
      [dayOfWeek]
    ) as ScheduledBreak[];
    return rows;
  }

  /**
   * Get all active scheduled breaks
   * @returns All active breaks
   */
  static async getAllActiveBreaks(): Promise<ScheduledBreak[]> {
    const rows = await query(
      'SELECT * FROM scheduled_breaks WHERE is_active = 1 ORDER BY start_time',
      []
    ) as ScheduledBreak[];
    return rows;
  }

  /**
   * Update scheduled break
   * @param breakId - Break ID
   * @param data - Update data
   * @returns Affected rows
   */
  static async updateBreak(breakId: number, data: {
    start_time: string;
    end_time: string;
    duration_minutes: number;
    days_of_week: string;
  }): Promise<number> {
    const result = await query(
      `UPDATE scheduled_breaks
       SET start_time = ?, end_time = ?, duration_minutes = ?, days_of_week = ?
       WHERE break_id = ?`,
      [data.start_time, data.end_time, data.duration_minutes, data.days_of_week, breakId]
    ) as ResultSetHeader;
    return result.affectedRows;
  }
}