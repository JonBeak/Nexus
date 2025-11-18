// File Clean up Finished: 2025-11-15 (Second cleanup - Audit Trail Refactoring)
// Current Cleanup Changes (Nov 15, 2025):
// - Removed logAuditTrail() method (moved to centralized auditRepository)
// - Reduced from 472 → 455 lines (3.6% reduction)
// - Part of Phase 2: Centralized Audit Repository implementation
//
// Previous Cleanup (Nov 14, 2025):
// Changes:
// - Migrated all 21 pool.execute() calls to query() helper (standardization)
// - Deleted unused getDeductionOverrideForUser() method (dead code)
// - Removed 19 redundant console.error() statements (query() already logs)
// - Reduced from 496 → 419 lines (15% reduction)
/**
 * Payroll Repository
 *
 * Database access layer for the payroll system
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 *
 * Responsibilities:
 * - All database queries for payroll operations
 * - Data access optimization and caching
 * - Database transaction management
 * - Query parameter sanitization
 *
 * Extracted from wages.ts during refactoring - all SQL queries preserved exactly
 */

import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';
import {
  PayrollSettings,
  TimeEntry,
  PayrollUser,
  WorkSchedule,
  DeductionOverride,
  DeductionUpdateRequest,
  PaymentRecordRequest,
  PayrollRecordWithEntries,
  PayrollDataAccess
} from '../types/payrollTypes';
import { convertBooleanFields, convertBooleanFieldsArray } from '../utils/databaseUtils';

export class PayrollRepository implements PayrollDataAccess {

  // =============================================
  // PAYROLL SETTINGS
  // =============================================

  async getPayrollSettings(): Promise<PayrollSettings[]> {
    try {
      const rows = await query(
        'SELECT setting_name, setting_value FROM payroll_settings'
      ) as RowDataPacket[];

      return rows as PayrollSettings[];
    } catch (error) {
      throw new Error('Failed to fetch payroll settings');
    }
  }

  async getAllPayrollSettings(): Promise<PayrollSettings[]> {
    try {
      const rows = await query(
        'SELECT * FROM payroll_settings ORDER BY setting_name'
      ) as RowDataPacket[];

      return rows as PayrollSettings[];
    } catch (error) {
      throw new Error('Failed to fetch payroll settings');
    }
  }

  async updatePayrollSetting(name: string, value: number): Promise<void> {
    try {
      await query(
        'UPDATE payroll_settings SET setting_value = ? WHERE setting_name = ?',
        [value, name]
      );
    } catch (error) {
      throw new Error('Failed to update payroll setting');
    }
  }

  // =============================================
  // TIME ENTRIES
  // =============================================

  async getTimeEntries(startDate: string, endDate: string): Promise<TimeEntry[]> {
    try {
      const rows = await query(
        `SELECT
          te.*,
          DATE_FORMAT(te.clock_in, '%Y-%m-%d') as entry_date,
          TIME(te.clock_in) as actual_clock_in,
          TIME(te.clock_out) as actual_clock_out,
          h.holiday_name
        FROM time_entries te
        LEFT JOIN company_holidays h ON DATE(te.clock_in) = DATE(h.holiday_date) AND h.is_active = 1
        WHERE DATE(te.clock_in) BETWEEN ? AND ?
          AND te.is_deleted = 0
        ORDER BY te.clock_in`,
        [startDate, endDate]
      ) as RowDataPacket[];

      // Convert MySQL boolean fields (TINYINT) to TypeScript booleans
      const booleanFields: (keyof TimeEntry)[] = [
        'is_deleted',
        'payroll_adjusted',
        'is_overtime',
        'is_holiday'
      ];

      return convertBooleanFieldsArray(rows as TimeEntry[], booleanFields);
    } catch (error) {
      throw new Error('Failed to fetch time entries');
    }
  }

  async updateTimeEntry(entryId: number, updates: Partial<TimeEntry>): Promise<void> {
    try {
      const {
        payroll_clock_in,
        payroll_clock_out,
        payroll_break_minutes,
        payroll_total_hours,
        is_overtime,
        is_holiday
      } = updates;

      await query(
        `UPDATE time_entries SET
         payroll_clock_in = ?,
         payroll_clock_out = ?,
         payroll_break_minutes = ?,
         payroll_total_hours = ?,
         is_overtime = ?,
         is_holiday = ?
         WHERE entry_id = ?`,
        [
          payroll_clock_in,
          payroll_clock_out,
          payroll_break_minutes || 0,
          payroll_total_hours,
          is_overtime ? 1 : 0,
          is_holiday ? 1 : 0,
          entryId
        ]
      );
    } catch (error) {
      throw new Error('Failed to update time entry');
    }
  }

  async updatePayrollEntry(entryId: number, updates: {
    payroll_clock_in: string;
    payroll_clock_out: string;
    payroll_break_minutes: number;
    payroll_total_hours: number;
  }): Promise<void> {
    try {
      await query(
        `UPDATE time_entries SET
         payroll_clock_in = ?,
         payroll_clock_out = ?,
         payroll_break_minutes = ?,
         payroll_total_hours = ?,
         payroll_adjusted = 1,
         is_overtime = CASE WHEN ? > 8 THEN 1 ELSE 0 END
         WHERE entry_id = ?`,
        [
          updates.payroll_clock_in,
          updates.payroll_clock_out,
          updates.payroll_break_minutes,
          updates.payroll_total_hours,
          updates.payroll_total_hours,
          entryId
        ]
      );
    } catch (error) {
      throw new Error('Failed to update payroll entry');
    }
  }

  // =============================================
  // USERS AND SCHEDULES
  // =============================================

  async getPayrollUsers(groupFilter?: string): Promise<PayrollUser[]> {
    try {
      let userFilter = '';
      const params: any[] = [];

      if (groupFilter && groupFilter !== 'all') {
        if (groupFilter === 'Group A' || groupFilter === 'Group B') {
          userFilter = ' AND u.user_group = ?';
          params.push(groupFilter);
        } else {
          const userId = Number(groupFilter);
          if (!isNaN(userId)) {
            userFilter = ' AND u.user_id = ?';
            params.push(userId);
          }
        }
      }

      const rows = await query(
        `SELECT
          u.user_id,
          u.first_name,
          u.last_name,
          u.user_group,
          u.hourly_wage,
          u.overtime_rate_multiplier,
          u.vacation_pay_percent,
          u.holiday_rate_multiplier,
          ws.expected_start_time,
          ws.expected_end_time
        FROM users u
        LEFT JOIN work_schedules ws ON u.user_id = ws.user_id
          AND ws.day_of_week = 'Monday'
        WHERE u.is_active = 1 ${userFilter}
        ORDER BY u.first_name, u.last_name`,
        params
      ) as RowDataPacket[];

      return rows as PayrollUser[];
    } catch (error) {
      throw new Error('Failed to fetch payroll users');
    }
  }

  async getUserSchedule(userId: number, dayOfWeek: string): Promise<WorkSchedule[]> {
    try {
      const rows = await query(
        `SELECT expected_start_time, expected_end_time
         FROM work_schedules
         WHERE user_id = ? AND day_of_week = ? AND is_work_day = 1`,
        [userId, dayOfWeek]
      ) as RowDataPacket[];

      return rows as WorkSchedule[];
    } catch (error) {
      throw new Error('Failed to fetch user schedule');
    }
  }

  // =============================================
  // DEDUCTION OVERRIDES
  // =============================================

  async getDeductionOverrides(startDate: string, endDate: string): Promise<DeductionOverride[]> {
    try {
      const rows = await query(
        `SELECT user_id, cpp_deduction, ei_deduction, federal_tax, pay_period_start, pay_period_end
         FROM payroll_deduction_overrides
         WHERE pay_period_start = ? AND pay_period_end = ?`,
        [startDate, endDate]
      ) as RowDataPacket[];

      return rows as DeductionOverride[];
    } catch (error) {
      throw new Error('Failed to fetch deduction overrides');
    }
  }

  async upsertDeductionOverride(override: DeductionUpdateRequest): Promise<void> {
    try {
      const { user_id, pay_period_start, pay_period_end, cpp_deduction, ei_deduction, federal_tax } = override;

      await query(
        `INSERT INTO payroll_deduction_overrides
         (user_id, pay_period_start, pay_period_end, cpp_deduction, ei_deduction, federal_tax)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         cpp_deduction = VALUES(cpp_deduction),
         ei_deduction = VALUES(ei_deduction),
         federal_tax = VALUES(federal_tax),
         updated_at = CURRENT_TIMESTAMP`,
        [user_id, pay_period_start, pay_period_end,
         cpp_deduction ?? null, ei_deduction ?? null, federal_tax ?? null]
      );
    } catch (error) {
      throw new Error('Failed to save deduction override');
    }
  }

  async batchUpsertDeductionOverrides(overrides: DeductionUpdateRequest[]): Promise<void> {
    try {
      for (const override of overrides) {
        const { user_id, pay_period_start, pay_period_end, cpp_deduction, ei_deduction, federal_tax } = override;

        // First, get existing values for this user/pay period
        const existing = await query(
          `SELECT cpp_deduction, ei_deduction, federal_tax
           FROM payroll_deduction_overrides
           WHERE user_id = ? AND pay_period_start = ? AND pay_period_end = ?`,
          [user_id, pay_period_start, pay_period_end]
        ) as RowDataPacket[];

        // Merge new values with existing values (preserve fields that aren't being updated)
        const existingRecord = existing[0] || {};
        const finalValues = {
          cpp_deduction: cpp_deduction !== undefined ? cpp_deduction : (existingRecord.cpp_deduction || null),
          ei_deduction: ei_deduction !== undefined ? ei_deduction : (existingRecord.ei_deduction || null),
          federal_tax: federal_tax !== undefined ? federal_tax : (existingRecord.federal_tax || null)
        };

        await query(
          `INSERT INTO payroll_deduction_overrides
           (user_id, pay_period_start, pay_period_end, cpp_deduction, ei_deduction, federal_tax)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           cpp_deduction = VALUES(cpp_deduction),
           ei_deduction = VALUES(ei_deduction),
           federal_tax = VALUES(federal_tax),
           updated_at = CURRENT_TIMESTAMP`,
          [user_id, pay_period_start, pay_period_end,
           finalValues.cpp_deduction, finalValues.ei_deduction, finalValues.federal_tax]
        );
      }
    } catch (error) {
      throw new Error('Failed to save batch deduction overrides');
    }
  }

  // =============================================
  // PAYMENT RECORDS
  // =============================================

  async createPayrollRecord(record: PaymentRecordRequest, userId: number): Promise<number> {
    try {
      const { pay_period_start, pay_period_end, payment_date, entries } = record;

      // Insert payment record
      const result = await query(
        `INSERT INTO payroll_records (pay_period_start, pay_period_end, payment_date, status, created_by)
         VALUES (?, ?, ?, 'recorded', ?)`,
        [pay_period_start, pay_period_end, payment_date, userId]
      ) as any;

      const recordId = result.insertId;

      // Insert individual employee entries
      for (const entry of entries) {
        await query(
          `INSERT INTO payroll_record_entries
           (record_id, user_id, hourly_rate, regular_hours, overtime_hours, holiday_hours,
            gross_pay, vacation_pay, cpp_deduction, ei_deduction, federal_tax, provincial_tax, net_pay)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            recordId,
            entry.user_id,
            entry.hourly_rate,
            entry.regular_hours,
            entry.overtime_hours,
            entry.holiday_hours,
            entry.gross_pay,
            entry.vacation_pay,
            entry.cpp_deduction,
            entry.ei_deduction,
            entry.federal_tax,
            entry.provincial_tax,
            entry.net_pay
          ]
        );
      }

      return recordId;
    } catch (error) {
      throw new Error('Failed to create payroll record');
    }
  }

  async getPaymentHistory(includeInactive: boolean = false): Promise<PayrollRecordWithEntries[]> {
    try {
      // Get payment records (active only by default, or include inactive if requested)
      let whereClause = 'WHERE is_active = TRUE';
      if (includeInactive) {
        whereClause = ''; // Show all records
      }

      const records = await query(
        `SELECT * FROM payroll_records
         ${whereClause}
         ORDER BY payment_date DESC`
      ) as RowDataPacket[];

      // Get entries for each record
      const recordsWithEntries = await Promise.all(
        (records as any[]).map(async (record) => {
          const entries = await query(
            `SELECT
              pre.*,
              u.first_name,
              u.last_name
             FROM payroll_record_entries pre
             JOIN users u ON pre.user_id = u.user_id
             WHERE pre.record_id = ?
             ORDER BY u.last_name, u.first_name`,
            [record.record_id]
          ) as RowDataPacket[];

          // Convert is_active boolean field
          const convertedRecord = convertBooleanFields(record, ['is_active']);

          return {
            ...convertedRecord,
            entries
          };
        })
      );

      return recordsWithEntries as PayrollRecordWithEntries[];
    } catch (error) {
      throw new Error('Failed to fetch payment history');
    }
  }

  async getPaymentRecord(recordId: number, activeOnly: boolean = true): Promise<any> {
    try {
      const activeFilter = activeOnly ? 'AND is_active = TRUE' : '';

      const rows = await query(
        `SELECT * FROM payroll_records WHERE record_id = ? ${activeFilter}`,
        [recordId]
      ) as RowDataPacket[];

      if (rows.length === 0) {
        return null;
      }

      // Convert is_active boolean field
      return convertBooleanFields(rows[0], ['is_active']);
    } catch (error) {
      throw new Error('Failed to fetch payment record');
    }
  }

  async deactivatePaymentRecord(recordId: number): Promise<void> {
    try {
      await query(
        'UPDATE payroll_records SET is_active = FALSE WHERE record_id = ?',
        [recordId]
      );
    } catch (error) {
      throw new Error('Failed to deactivate payment record');
    }
  }

  async reactivatePaymentRecord(recordId: number): Promise<void> {
    try {
      await query(
        'UPDATE payroll_records SET is_active = TRUE WHERE record_id = ?',
        [recordId]
      );
    } catch (error) {
      throw new Error('Failed to reactivate payment record');
    }
  }
}
