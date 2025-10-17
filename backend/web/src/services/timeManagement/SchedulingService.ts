/**
 * Scheduling Service
 * Business logic layer for work schedules and company holidays operations
 * Extracted from timeScheduling.ts (290 → 100 lines, 65% reduction)
 */

import { User } from '../../types';
import { TimeTrackingPermissions } from '../../utils/timeTracking/permissions';
import { SchedulingRepository } from '../../repositories/timeManagement/SchedulingRepository';
import { query } from '../../config/database';
import {
  ServiceResponse,
  ServiceOptions,
  CacheEntry,
  CACHE_TTL,
  WorkSchedule,
  WorkScheduleUpdateData,
  HolidayData,
  HolidayCreateData,
  HolidayImportData,
  HolidayConflict,
  HolidayImportResult,
  CSVImportRequest
} from '../../types/TimeManagementTypes';

export class SchedulingService {
  // Cache storage
  private static cache = new Map<string, CacheEntry<any>>();

  // ========================================================================
  // Work Schedules
  // ========================================================================

  /**
   * Get work schedules for a user
   */
  static async getWorkSchedules(
    user: User,
    userId: number,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<WorkSchedule[]>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
        if (!canManage) {
          return {
            success: false,
            error: 'Unauthorized',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Fetch schedules
      const schedules = await SchedulingRepository.getWorkSchedulesByUserId(userId);

      return { success: true, data: schedules };
    } catch (error: any) {
      console.error('Error in getWorkSchedules:', error);
      return {
        success: false,
        error: 'Failed to fetch schedules',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Update work schedules for a user (delete all + bulk insert)
   */
  static async updateWorkSchedules(
    user: User,
    userId: number,
    schedules: WorkScheduleUpdateData[],
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<{ message: string }>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
        if (!canManage) {
          return {
            success: false,
            error: 'Unauthorized',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Validate input
      if (!schedules || !Array.isArray(schedules)) {
        return {
          success: false,
          error: 'Invalid schedules data',
          code: 'VALIDATION_ERROR'
        };
      }

      // Delete existing schedules
      await SchedulingRepository.deleteWorkSchedulesByUserId(userId);

      // Insert new schedules
      await SchedulingRepository.createWorkSchedules(userId, schedules);

      // Audit logging
      await query(
        `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [
          user.user_id,
          'update_work_schedule',
          'work_schedule',
          userId.toString(),
          JSON.stringify({ schedules_count: schedules.length })
        ]
      );

      return {
        success: true,
        data: { message: 'Schedule updated successfully' }
      };
    } catch (error: any) {
      console.error('Error in updateWorkSchedules:', error);
      return {
        success: false,
        error: 'Failed to update schedule',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  // ========================================================================
  // Company Holidays
  // ========================================================================

  /**
   * Get all active company holidays
   */
  static async getHolidays(
    user: User,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<HolidayData[]>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
        if (!canManage) {
          return {
            success: false,
            error: 'Unauthorized',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Check cache
      const cacheKey = 'holidays_active';
      if (options.useCache !== false) {
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiry > Date.now()) {
          return { success: true, data: cached.data, cached: true };
        }
      }

      // Fetch holidays
      const holidays = await SchedulingRepository.getActiveHolidays();

      // Cache result
      if (options.useCache !== false) {
        this.cache.set(cacheKey, {
          data: holidays,
          expiry: Date.now() + CACHE_TTL.HOLIDAYS
        });
      }

      return { success: true, data: holidays };
    } catch (error: any) {
      console.error('Error in getHolidays:', error);
      return {
        success: false,
        error: 'Failed to fetch holidays',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Create a new holiday with conflict checking
   */
  static async createHoliday(
    user: User,
    data: HolidayCreateData,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<{ message: string } | { error: string; existing_holiday: HolidayData; requires_overwrite: boolean }>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
        if (!canManage) {
          return {
            success: false,
            error: 'Unauthorized',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      const { holiday_name, holiday_date, overwrite = false } = data;

      // Validate date format
      const dateValidation = this._validateDateFormat(holiday_date);
      if (!dateValidation.isValid) {
        return {
          success: false,
          error: dateValidation.error!,
          code: 'VALIDATION_ERROR'
        };
      }

      // Check for conflicts
      const existingHolidays = await SchedulingRepository.getHolidaysByDate(holiday_date);

      if (existingHolidays.length > 0 && !overwrite) {
        // Return conflict
        return {
          success: false,
          error: 'Holiday already exists on this date',
          code: 'CONFLICT',
          data: {
            error: 'Holiday already exists on this date',
            existing_holiday: existingHolidays[0],
            requires_overwrite: true
          }
        };
      }

      if (existingHolidays.length > 0 && overwrite) {
        // Deactivate existing holidays on this date
        await SchedulingRepository.softDeleteHolidaysByDate(holiday_date);
      }

      // Create new holiday
      const holidayId = await SchedulingRepository.createHoliday(holiday_name, holiday_date);

      // Audit logging
      await query(
        `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [
          user.user_id,
          'create_holiday',
          'company_holiday',
          holidayId.toString(),
          JSON.stringify({ holiday_name, holiday_date, overwrite })
        ]
      );

      // Invalidate cache
      this.clearCache();

      return {
        success: true,
        data: { message: 'Holiday added successfully' }
      };
    } catch (error: any) {
      console.error('Error in createHoliday:', error);
      return {
        success: false,
        error: 'Failed to add holiday',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Delete a holiday (soft delete)
   */
  static async deleteHoliday(
    user: User,
    holidayId: number,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<{ message: string }>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
        if (!canManage) {
          return {
            success: false,
            error: 'Unauthorized',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Soft delete holiday
      await SchedulingRepository.softDeleteHoliday(holidayId);

      // Audit logging
      await query(
        `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [
          user.user_id,
          'delete_holiday',
          'company_holiday',
          holidayId.toString(),
          JSON.stringify({ action: 'soft_delete' })
        ]
      );

      // Invalidate cache
      this.clearCache();

      return {
        success: true,
        data: { message: 'Holiday removed successfully' }
      };
    } catch (error: any) {
      console.error('Error in deleteHoliday:', error);
      return {
        success: false,
        error: 'Failed to remove holiday',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  // ========================================================================
  // Holiday Import/Export
  // ========================================================================

  /**
   * Export holidays as CSV string
   */
  static async exportHolidaysCSV(
    user: User,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<string>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
        if (!canManage) {
          return {
            success: false,
            error: 'Unauthorized',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Fetch holidays for export
      const holidays = await SchedulingRepository.getActiveHolidaysForExport();

      // Create CSV content
      let csvContent = 'Holiday Name,Date\n';
      holidays.forEach(holiday => {
        const formattedDate = holiday.holiday_date instanceof Date
          ? holiday.holiday_date.toISOString().split('T')[0]
          : holiday.holiday_date.toString().split('T')[0];
        csvContent += `"${holiday.holiday_name}","${formattedDate}"\n`;
      });

      return { success: true, data: csvContent };
    } catch (error: any) {
      console.error('Error in exportHolidaysCSV:', error);
      return {
        success: false,
        error: 'Failed to export holidays',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Import holidays from CSV with conflict resolution
   */
  static async importHolidaysCSV(
    user: User,
    request: CSVImportRequest,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<HolidayImportResult | { error: string; conflicts: HolidayConflict[]; requires_overwrite: boolean }>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canManage = await TimeTrackingPermissions.canManageTimeSchedulesHybrid(user);
        if (!canManage) {
          return {
            success: false,
            error: 'Unauthorized',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      const { csvData, overwriteAll = false } = request;

      // Validate CSV data
      if (!csvData) {
        return {
          success: false,
          error: 'No CSV data provided',
          code: 'VALIDATION_ERROR'
        };
      }

      // Parse CSV
      const parseResult = this._parseCSV(csvData);
      if (!parseResult.success) {
        return {
          success: false,
          error: parseResult.error!,
          code: 'VALIDATION_ERROR'
        };
      }

      const holidaysToImport = parseResult.holidays!;

      if (holidaysToImport.length === 0) {
        return {
          success: false,
          error: 'No valid holidays found in CSV data',
          code: 'VALIDATION_ERROR'
        };
      }

      // Check for conflicts if not overwriting all
      if (!overwriteAll) {
        const conflicts = await this._checkConflicts(holidaysToImport);
        if (conflicts.length > 0) {
          return {
            success: false,
            error: 'Some holidays conflict with existing ones',
            code: 'CONFLICT',
            data: {
              error: 'Some holidays conflict with existing ones',
              conflicts,
              requires_overwrite: true
            }
          };
        }
      }

      // Import holidays
      let importedCount = 0;
      for (const holiday of holidaysToImport) {
        if (overwriteAll) {
          // Deactivate existing holidays on this date
          await SchedulingRepository.softDeleteHolidaysByDate(holiday.date);
        }

        // Insert new holiday
        await SchedulingRepository.createHoliday(holiday.name, holiday.date);
        importedCount++;
      }

      // Audit logging
      await query(
        `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [
          user.user_id,
          'import_holidays',
          'company_holiday',
          'bulk',
          JSON.stringify({ imported_count: importedCount, overwrite_all: overwriteAll })
        ]
      );

      // Invalidate cache
      this.clearCache();

      return {
        success: true,
        data: {
          message: `Successfully imported ${importedCount} holidays`,
          imported_count: importedCount
        }
      };
    } catch (error: any) {
      console.error('Error in importHolidaysCSV:', error);
      return {
        success: false,
        error: 'Failed to import holidays',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  /**
   * Clear all cache
   */
  static clearCache(): void {
    this.cache.clear();
    console.log('[CACHE] SchedulingService cache cleared');
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Validate date format (YYYY-MM-DD)
   */
  private static _validateDateFormat(date: string): { isValid: boolean; error?: string } {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        isValid: false,
        error: `Invalid date format: ${date}. Use YYYY-MM-DD format.`
      };
    }

    // Validate that it's a real date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return {
        isValid: false,
        error: `Invalid date: ${date}`
      };
    }

    return { isValid: true };
  }

  /**
   * Parse CSV data into holiday objects
   */
  private static _parseCSV(csvData: string): {
    success: boolean;
    holidays?: HolidayImportData[];
    error?: string;
  } {
    const lines = csvData.trim().split('\n');
    const holidaysToImport: HolidayImportData[] = [];

    for (let i = 1; i < lines.length; i++) { // Skip header
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing (handles quoted fields)
      const matches = line.match(/^"([^"]*)","([^"]*)"$/) || line.match(/^([^,]*),(.*)$/);
      if (!matches) continue;

      const name = matches[1].trim();
      const date = matches[2].trim();

      if (name && date) {
        // Validate date format
        const dateValidation = this._validateDateFormat(date);
        if (!dateValidation.isValid) {
          return {
            success: false,
            error: dateValidation.error
          };
        }

        holidaysToImport.push({ name, date });
      }
    }

    return {
      success: true,
      holidays: holidaysToImport
    };
  }

  /**
   * Check for conflicts with existing holidays
   */
  private static async _checkConflicts(
    holidays: HolidayImportData[]
  ): Promise<HolidayConflict[]> {
    const conflicts: HolidayConflict[] = [];

    for (const holiday of holidays) {
      const existing = await SchedulingRepository.getHolidaysByDate(holiday.date);
      if (existing.length > 0) {
        conflicts.push({
          name: holiday.name,
          date: holiday.date,
          existing: existing[0]
        });
      }
    }

    return conflicts;
  }
}
