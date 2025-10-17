/**
 * Scheduling Repository
 * Handles all database operations for work schedules and company holidays
 * Created for Iteration 3 refactoring
 */

import { pool } from '../../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import {
  WorkSchedule,
  WorkScheduleUpdateData,
  HolidayData
} from '../../types/TimeManagementTypes';

export class SchedulingRepository {
  // ========================================================================
  // Work Schedules
  // ========================================================================

  /**
   * Get work schedules for a user, ordered by day of week
   */
  static async getWorkSchedulesByUserId(userId: number): Promise<WorkSchedule[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM work_schedules
       WHERE user_id = ?
       ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')`,
      [userId]
    );
    return rows as WorkSchedule[];
  }

  /**
   * Delete all work schedules for a user
   */
  static async deleteWorkSchedulesByUserId(userId: number): Promise<void> {
    await pool.execute(
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
      await pool.execute(
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
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM company_holidays WHERE is_active = 1 ORDER BY holiday_date'
    );
    return rows as HolidayData[];
  }

  /**
   * Get active holidays on a specific date (for conflict checking)
   */
  static async getHolidaysByDate(date: string): Promise<HolidayData[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM company_holidays WHERE holiday_date = ? AND is_active = 1',
      [date]
    );
    return rows as HolidayData[];
  }

  /**
   * Create a new holiday
   */
  static async createHoliday(name: string, date: string): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO company_holidays (holiday_name, holiday_date) VALUES (?, ?)',
      [name, date]
    );
    return result.insertId;
  }

  /**
   * Soft delete a holiday (set is_active = 0)
   */
  static async softDeleteHoliday(holidayId: number): Promise<void> {
    await pool.execute(
      'UPDATE company_holidays SET is_active = 0 WHERE holiday_id = ?',
      [holidayId]
    );
  }

  /**
   * Soft delete all holidays on a specific date (for overwrite mode)
   */
  static async softDeleteHolidaysByDate(date: string): Promise<void> {
    await pool.execute(
      'UPDATE company_holidays SET is_active = 0 WHERE holiday_date = ? AND is_active = 1',
      [date]
    );
  }

  /**
   * Get active holidays for CSV export (name and date only)
   */
  static async getActiveHolidaysForExport(): Promise<Array<{ holiday_name: string; holiday_date: Date | string }>> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT holiday_name, holiday_date FROM company_holidays WHERE is_active = 1 ORDER BY holiday_date'
    );
    return rows as Array<{ holiday_name: string; holiday_date: Date | string }>;
  }
}
