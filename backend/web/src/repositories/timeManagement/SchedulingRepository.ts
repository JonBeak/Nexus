// File Clean up Finished: 2025-11-15
// Changes:
// - Migrated all 9 pool.execute() calls to query() helper
// - Changed import from pool to query from '../../config/database'
// - Removed unused RowDataPacket import (query() handles destructuring)
// - Following DATABASE_QUERY_STANDARDIZATION_PLAN.md mandatory migration
// - All methods now use cleaner syntax with centralized error logging and performance monitoring

/**
 * Scheduling Repository
 * Handles all database operations for work schedules and company holidays
 * Created for Iteration 3 refactoring
 */

import { query } from '../../config/database';
import { ResultSetHeader } from 'mysql2';
import {
  WorkSchedule,
  WorkScheduleUpdateData,
  HolidayData
} from '../../types/TimeTypes';

export class SchedulingRepository {
  // ========================================================================
  // Work Schedules
  // ========================================================================

  /**
   * Get work schedules for a user, ordered by day of week
   */
  static async getWorkSchedulesByUserId(userId: number): Promise<WorkSchedule[]> {
    const rows = await query(
      `SELECT * FROM work_schedules
       WHERE user_id = ?
       ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')`,
      [userId]
    ) as WorkSchedule[];
    return rows;
  }

  /**
   * Delete all work schedules for a user
   */
  static async deleteWorkSchedulesByUserId(userId: number): Promise<void> {
    await query(
      'DELETE FROM work_schedules WHERE user_id = ?',
      [userId]
    );
  }

  /**
   * Create multiple work schedules for a user (bulk insert)
   */
  static async createWorkSchedules(
    userId: number,
    schedules: WorkScheduleUpdateData[]
  ): Promise<void> {
    for (const schedule of schedules) {
      await query(
        `INSERT INTO work_schedules
         (user_id, day_of_week, is_work_day, expected_start_time, expected_end_time)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          schedule.day_of_week,
          schedule.is_work_day,
          schedule.expected_start_time,
          schedule.expected_end_time
        ]
      );
    }
  }

  // ========================================================================
  // Company Holidays
  // ========================================================================

  /**
   * Get all active company holidays, ordered by date
   */
  static async getActiveHolidays(): Promise<HolidayData[]> {
    const rows = await query(
      'SELECT * FROM company_holidays WHERE is_active = 1 ORDER BY holiday_date'
    ) as HolidayData[];
    return rows;
  }

  /**
   * Get active holidays on a specific date (for conflict checking)
   */
  static async getHolidaysByDate(date: string): Promise<HolidayData[]> {
    const rows = await query(
      'SELECT * FROM company_holidays WHERE holiday_date = ? AND is_active = 1',
      [date]
    ) as HolidayData[];
    return rows;
  }

  /**
   * Create a new holiday
   */
  static async createHoliday(name: string, date: string): Promise<number> {
    const result = await query(
      'INSERT INTO company_holidays (holiday_name, holiday_date) VALUES (?, ?)',
      [name, date]
    ) as ResultSetHeader;
    return result.insertId;
  }

  /**
   * Soft delete a holiday (set is_active = 0)
   */
  static async softDeleteHoliday(holidayId: number): Promise<void> {
    await query(
      'UPDATE company_holidays SET is_active = 0 WHERE holiday_id = ?',
      [holidayId]
    );
  }

  /**
   * Soft delete all holidays on a specific date (for overwrite mode)
   */
  static async softDeleteHolidaysByDate(date: string): Promise<void> {
    await query(
      'UPDATE company_holidays SET is_active = 0 WHERE holiday_date = ? AND is_active = 1',
      [date]
    );
  }

  /**
   * Get active holidays for CSV export (name and date only)
   */
  static async getActiveHolidaysForExport(): Promise<Array<{ holiday_name: string; holiday_date: Date | string }>> {
    const rows = await query(
      'SELECT holiday_name, holiday_date FROM company_holidays WHERE is_active = 1 ORDER BY holiday_date'
    ) as Array<{ holiday_name: string; holiday_date: Date | string }>;
    return rows;
  }
}
