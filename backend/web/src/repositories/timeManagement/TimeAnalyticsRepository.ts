/**
 * Time Analytics Repository
 * Handles all database operations for time analytics queries
 */

import { pool } from '../../config/database';
import { RowDataPacket } from 'mysql2';
import {
  WeeklySummaryData,
  UserWithSchedule,
  Holiday,
  VacationPeriod,
  TopPerformer,
  DateRangeFilter,
  AnalyticsFilters
} from '../../types/TimeManagementTypes';

export class TimeAnalyticsRepository {
  /**
   * Get weekly summary data for users
   * @param dateRange - Start and end dates
   * @param filters - Group and user filters
   * @returns Weekly summary data
   */
  static async getWeeklySummaryData(
    dateRange: DateRangeFilter,
    filters: AnalyticsFilters
  ): Promise<WeeklySummaryData[]> {
    let sql = `
      SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        COALESCE(SUM(te.total_hours), 0) as total_hours,
        COALESCE(SUM(CASE WHEN te.total_hours > 8 THEN te.total_hours - 8 ELSE 0 END), 0) as overtime_hours,
        COUNT(DISTINCT DATE(te.clock_in)) as days_worked,
        COUNT(CASE WHEN TIME(te.clock_in) > '09:00:00' THEN 1 END) as late_days,
        COUNT(CASE WHEN ter.entry_id IS NOT NULL THEN 1 END) as edited_entries
      FROM users u
      LEFT JOIN time_entries te ON u.user_id = te.user_id
        AND te.is_deleted = 0
        AND DATE(te.clock_in) BETWEEN ? AND ?
      LEFT JOIN (
        SELECT DISTINCT entry_id
        FROM time_edit_requests
        WHERE status IN ('approved', 'modified')
      ) ter ON te.entry_id = ter.entry_id
      WHERE u.is_active = 1
    `;

    const params: (string | number)[] = [dateRange.startDate, dateRange.endDate];

    // Apply group/user filter
    if (filters.group && filters.group !== 'all' && filters.group !== '') {
      if (filters.group === 'Group A' || filters.group === 'Group B') {
        sql += ' AND u.user_group = ?';
        params.push(filters.group);
      } else {
        const userId = Number(filters.group);
        if (!isNaN(userId)) {
          sql += ' AND u.user_id = ?';
          params.push(userId);
        }
      }
    } else if (filters.users && filters.users !== '') {
      // Legacy support for users parameter
      const userIds = filters.users.split(',').map(Number).filter(Boolean);
      if (userIds.length > 0) {
        sql += ` AND u.user_id IN (${userIds.map(() => '?').join(',')})`;
        params.push(...userIds);
      }
    }

    sql += ' GROUP BY u.user_id, u.first_name, u.last_name ORDER BY u.first_name, u.last_name';

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows as WeeklySummaryData[];
  }

  /**
   * Get total statistics for analytics overview
   */
  static async getTotalStats(
    dateRange: DateRangeFilter,
    filters: AnalyticsFilters
  ): Promise<any> {
    let sql = `
      SELECT
        COUNT(DISTINCT te.user_id) as active_employees,
        COALESCE(SUM(te.total_hours), 0) as total_hours,
        COALESCE(SUM(CASE WHEN te.total_hours > 8 THEN te.total_hours - 8 ELSE 0 END), 0) as overtime_hours
      FROM time_entries te
      WHERE te.is_deleted = 0 AND DATE(te.clock_in) BETWEEN ? AND ?
    `;

    const params: (string | number)[] = [dateRange.startDate, dateRange.endDate];

    if (filters.group && filters.group !== 'all' && filters.group !== '') {
      if (filters.group === 'Group A' || filters.group === 'Group B') {
        sql += ' AND EXISTS(SELECT 1 FROM users WHERE user_id = te.user_id AND user_group = ?)';
        params.push(filters.group);
      } else {
        const userId = Number(filters.group);
        if (!isNaN(userId)) {
          sql += ' AND te.user_id = ?';
          params.push(userId);
        }
      }
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows[0];
  }

  /**
   * Get on-time statistics
   */
  static async getOnTimeStats(
    dateRange: DateRangeFilter,
    filters: AnalyticsFilters
  ): Promise<any> {
    let sql = `
      SELECT
        COUNT(*) as total_entries,
        COUNT(CASE WHEN TIME(te.clock_in) <= '09:00:00' THEN 1 END) as on_time_entries
      FROM time_entries te
      WHERE te.is_deleted = 0 AND DATE(te.clock_in) BETWEEN ? AND ?
    `;

    const params: (string | number)[] = [dateRange.startDate, dateRange.endDate];

    if (filters.group && filters.group !== 'all' && filters.group !== '') {
      if (filters.group === 'Group A' || filters.group === 'Group B') {
        sql += ' AND EXISTS(SELECT 1 FROM users WHERE user_id = te.user_id AND user_group = ?)';
        params.push(filters.group);
      } else {
        const userId = Number(filters.group);
        if (!isNaN(userId)) {
          sql += ' AND te.user_id = ?';
          params.push(userId);
        }
      }
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows[0];
  }

  /**
   * Get edit request statistics
   */
  static async getEditStats(
    dateRange: DateRangeFilter,
    filters: AnalyticsFilters
  ): Promise<any> {
    let sql = `
      SELECT COUNT(DISTINCT te.entry_id) as edited_entries
      FROM time_entries te
      JOIN time_edit_requests ter ON te.entry_id = ter.entry_id
      WHERE te.is_deleted = 0 AND ter.status IN ('approved', 'modified')
        AND DATE(te.clock_in) BETWEEN ? AND ?
    `;

    const params: (string | number)[] = [dateRange.startDate, dateRange.endDate];

    if (filters.group && filters.group !== 'all' && filters.group !== '') {
      if (filters.group === 'Group A' || filters.group === 'Group B') {
        sql += ' AND EXISTS(SELECT 1 FROM users WHERE user_id = te.user_id AND user_group = ?)';
        params.push(filters.group);
      } else {
        const userId = Number(filters.group);
        if (!isNaN(userId)) {
          sql += ' AND te.user_id = ?';
          params.push(userId);
        }
      }
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows[0];
  }

  /**
   * Get top performers by hours worked
   */
  static async getTopPerformers(
    dateRange: DateRangeFilter,
    filters: AnalyticsFilters,
    limit: number = 5
  ): Promise<TopPerformer[]> {
    let sql = `
      SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        COALESCE(SUM(te.total_hours), 0) as total_hours
      FROM users u
      LEFT JOIN time_entries te ON u.user_id = te.user_id
        AND te.is_deleted = 0 AND DATE(te.clock_in) BETWEEN ? AND ?
      WHERE u.is_active = 1
    `;

    const params: (string | number)[] = [dateRange.startDate, dateRange.endDate];

    if (filters.group && filters.group !== 'all' && filters.group !== '') {
      if (filters.group === 'Group A' || filters.group === 'Group B') {
        sql += ' AND u.user_group = ?';
        params.push(filters.group);
      } else {
        const userId = Number(filters.group);
        if (!isNaN(userId)) {
          sql += ' AND u.user_id = ?';
          params.push(userId);
        }
      }
    }

    sql += ` GROUP BY u.user_id, u.first_name, u.last_name ORDER BY total_hours DESC LIMIT ${limit}`;

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows as TopPerformer[];
  }

  /**
   * Get total employee count
   */
  static async getTotalEmployeeCount(filters: AnalyticsFilters): Promise<number> {
    let sql = 'SELECT COUNT(*) as count FROM users WHERE is_active = 1';
    const params: (string | number)[] = [];

    if (filters.group && filters.group !== 'all' && filters.group !== '') {
      if (filters.group === 'Group A' || filters.group === 'Group B') {
        sql += ' AND user_group = ?';
        params.push(filters.group);
      } else {
        const userId = Number(filters.group);
        if (!isNaN(userId)) {
          sql += ' AND user_id = ?';
          params.push(userId);
        }
      }
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return (rows[0] as any).count;
  }

  /**
   * Get individual user analytics
   */
  static async getUserAnalytics(
    userId: number,
    dateRange: DateRangeFilter
  ): Promise<any> {
    const [
      totalHours,
      overtimeHours,
      daysWorked,
      weekendsWorked,
      lateEntries
    ] = await Promise.all([
      // Total hours
      pool.execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(total_hours), 0) as total
         FROM time_entries
         WHERE user_id = ? AND clock_in BETWEEN ? AND ? AND is_deleted = 0`,
        [userId, dateRange.startDate, dateRange.endDate]
      ),
      // Overtime hours
      pool.execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(GREATEST(total_hours - 8, 0)), 0) as overtime
         FROM time_entries
         WHERE user_id = ? AND clock_in BETWEEN ? AND ? AND is_deleted = 0`,
        [userId, dateRange.startDate, dateRange.endDate]
      ),
      // Days worked
      pool.execute<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT DATE(clock_in)) as days
         FROM time_entries
         WHERE user_id = ? AND clock_in BETWEEN ? AND ? AND is_deleted = 0`,
        [userId, dateRange.startDate, dateRange.endDate]
      ),
      // Weekends worked
      pool.execute<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT DATE(clock_in)) as weekends
         FROM time_entries
         WHERE user_id = ? AND clock_in BETWEEN ? AND ?
         AND DAYOFWEEK(clock_in) IN (1, 7) AND is_deleted = 0`,
        [userId, dateRange.startDate, dateRange.endDate]
      ),
      // Late entries
      pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as late
         FROM time_entries
         WHERE user_id = ? AND clock_in BETWEEN ? AND ?
         AND TIME(clock_in) > '09:00:00' AND is_deleted = 0`,
        [userId, dateRange.startDate, dateRange.endDate]
      )
    ]);

    return {
      totalHours: totalHours[0][0].total,
      overtimeHours: overtimeHours[0][0].overtime,
      daysWorked: daysWorked[0][0].days,
      weekendsWorked: weekendsWorked[0][0].weekends,
      lateEntries: lateEntries[0][0].late
    };
  }

  /**
   * Batch fetch users with schedules and existing entries
   * This is the core query for missing entries calculation
   */
  static async getUsersWithSchedulesAndEntries(
    dateRange: DateRangeFilter,
    filters: AnalyticsFilters
  ): Promise<UserWithSchedule[]> {
    let sql = `
      SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        u.hire_date,
        ws.day_of_week,
        ws.is_work_day,
        ws.expected_start_time,
        ws.expected_end_time,
        GROUP_CONCAT(DISTINCT DATE_FORMAT(DATE(te.clock_in), '%Y-%m-%d')) as existing_dates
      FROM users u
      LEFT JOIN work_schedules ws ON u.user_id = ws.user_id
      LEFT JOIN time_entries te ON u.user_id = te.user_id
        AND DATE(te.clock_in) BETWEEN ? AND ?
        AND te.is_deleted = 0
      WHERE u.is_active = 1
        AND u.hire_date IS NOT NULL
    `;

    const params: (string | number)[] = [dateRange.startDate, dateRange.endDate];

    if (filters.group && filters.group !== 'all' && filters.group !== '') {
      if (filters.group === 'Group A' || filters.group === 'Group B') {
        sql += ' AND u.user_group = ?';
        params.push(filters.group);
      } else {
        const userId = Number(filters.group);
        if (!isNaN(userId)) {
          sql += ' AND u.user_id = ?';
          params.push(userId);
        }
      }
    }

    sql += `
      GROUP BY u.user_id, u.first_name, u.last_name, u.hire_date,
               ws.day_of_week, ws.is_work_day, ws.expected_start_time, ws.expected_end_time
      ORDER BY u.user_id, FIELD(ws.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
    `;

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows as UserWithSchedule[];
  }

  /**
   * Get holidays in date range
   */
  static async getHolidaysInRange(dateRange: DateRangeFilter): Promise<Holiday[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT holiday_id, holiday_name, holiday_date, is_active
       FROM company_holidays
       WHERE holiday_date BETWEEN ? AND ? AND is_active = 1`,
      [dateRange.startDate, dateRange.endDate]
    );
    return rows as Holiday[];
  }

  /**
   * Get vacation periods overlapping with date range
   */
  static async getVacationsInRange(dateRange: DateRangeFilter): Promise<VacationPeriod[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT vacation_id, user_id, start_date, end_date
       FROM vacation_periods
       WHERE (start_date <= ? AND end_date >= ?) OR
             (start_date BETWEEN ? AND ?) OR
             (end_date BETWEEN ? AND ?)`,
      [
        dateRange.endDate,
        dateRange.startDate,
        dateRange.startDate,
        dateRange.endDate,
        dateRange.startDate,
        dateRange.endDate
      ]
    );
    return rows as VacationPeriod[];
  }
}
