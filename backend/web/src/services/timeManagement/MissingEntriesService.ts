// File Clean up Started: 2025-11-21
// File Clean up Finished: 2025-11-21
// Phase 2 Changes:
// - Removed TimeTrackingPermissions import (redundant with route-level RBAC)
// - Removed 1 service-level permission check block
// - Permissions now enforced at route level via requirePermission() middleware
//
// Previous cleanup: 2025-11-15
// - Created during cleanup to split TimeAnalyticsService (was 612 lines)
// - Contains missing entries logic + all private helper methods

/**
 * Missing Entries Service
 * Handles complex business logic for identifying missing time entries
 * Extracted from TimeAnalyticsService to maintain 500-line file limit
 *
 * ARCHITECTURAL STATUS:
 * ✅ 3-layer architecture (Route → Service → Repository)
 * ✅ Route-level RBAC protection (requirePermission middleware)
 * ✅ No redundant service-level permission checks
 */

import { User } from '../../types';
import { TimeAnalyticsRepository } from '../../repositories/timeManagement/TimeAnalyticsRepository';
import {
  ServiceResponse,
  MissingEntryData,
  DateRangeFilter,
  AnalyticsFilters,
  ServiceOptions,
  UserScheduleMap,
  ScheduleInfo,
  CACHE_TTL
} from '../../types/TimeTypes';

export class MissingEntriesService {
  // Shared cache reference from TimeAnalyticsService
  private static cache = new Map<string, { data: any; expiry: number }>();

  /**
   * Get missing time entries
   * Complex logic for identifying days when employees should have entries but don't
   */
  static async getMissingEntries(
    user: User,
    dateRange: DateRangeFilter,
    filters: AnalyticsFilters,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<MissingEntryData[]>> {
    const startTime = Date.now();
    const timeout = options.timeout || 8000; // 8 second timeout

    try {
      // Permissions enforced at route level via requirePermission('time_management.view_reports') middleware

      // Validate date range
      const validation = this._validateDateRange(dateRange);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error!,
          code: 'VALIDATION_ERROR'
        };
      }

      // Check cache
      const cacheKey = `missing_${user.user_id}_${dateRange.startDate}_${dateRange.endDate}_${filters.group || 'all'}`;
      if (options.useCache !== false) {
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiry > Date.now()) {
          return { success: true, data: cached.data, cached: true };
        }
      }

      // Adjust end date to today if in future
      const adjustedDateRange = this._adjustDateRange(dateRange);

      console.log(`[MISSING] Processing date range: ${adjustedDateRange.startDate} to ${adjustedDateRange.endDate}`);

      // Fetch all required data in parallel
      const batchData = await this._fetchBatchData(adjustedDateRange, filters);

      // Check timeout
      if (Date.now() - startTime > timeout - 1000) {
        return {
          success: false,
          error: 'Request timeout - try a smaller date range',
          code: 'TIMEOUT_ERROR'
        };
      }

      // Build user schedule maps
      const userData = this._buildUserScheduleMaps(batchData.users);

      // Build vacation lookup
      const vacationMap = this._buildVacationMap(batchData.vacations);

      // Build holiday set
      const holidaySet = this._buildHolidaySet(batchData.holidays);

      // Compute missing entries
      const missingEntries = this._computeMissingEntries(
        userData,
        vacationMap,
        holidaySet,
        adjustedDateRange,
        startTime,
        timeout
      );

      console.log(`[MISSING] Found ${missingEntries.length} missing entries (${Date.now() - startTime}ms)`);

      // Cache result
      if (options.useCache !== false) {
        this.cache.set(cacheKey, {
          data: missingEntries,
          expiry: Date.now() + CACHE_TTL.MISSING_ENTRIES
        });
      }

      return { success: true, data: missingEntries };
    } catch (error: any) {
      console.error('Error in getMissingEntries:', error);
      return {
        success: false,
        error: 'Failed to fetch missing entries',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Invalidate cache for a user
   */
  static invalidateCacheForUser(userId: number): void {
    const keysToDelete: string[] = [];
    for (const [key] of this.cache) {
      if (key.includes(`_${userId}_`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`[CACHE] Invalidated ${keysToDelete.length} missing entries cache for user ${userId}`);
  }

  /**
   * Clear all cache
   */
  static clearCache(): void {
    this.cache.clear();
    console.log('[CACHE] Missing entries cache cleared');
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Validate date range
   */
  private static _validateDateRange(dateRange: DateRangeFilter): {
    isValid: boolean;
    error?: string;
  } {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRange.startDate || !dateRange.endDate) {
      return { isValid: false, error: 'Start and end dates are required' };
    }

    if (!dateRegex.test(dateRange.startDate) || !dateRegex.test(dateRange.endDate)) {
      return { isValid: false, error: 'Invalid date format. Use YYYY-MM-DD.' };
    }

    try {
      const start = new Date(dateRange.startDate + 'T00:00:00.000Z');
      const end = new Date(dateRange.endDate + 'T00:00:00.000Z');

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { isValid: false, error: 'Invalid date values' };
      }

      if (start > end) {
        return { isValid: false, error: 'Start date must be before or equal to end date' };
      }

      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 5000) {
        return { isValid: false, error: 'Date range too large. Maximum 5000 days allowed.' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Invalid date format' };
    }
  }

  /**
   * Adjust end date to today if in future
   */
  private static _adjustDateRange(dateRange: DateRangeFilter): DateRangeFilter {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const end = new Date(dateRange.endDate + 'T00:00:00.000Z');

    if (end > today) {
      return {
        startDate: dateRange.startDate,
        endDate: today.toISOString().split('T')[0]
      };
    }

    return dateRange;
  }

  /**
   * Fetch all required data in parallel
   */
  private static async _fetchBatchData(
    dateRange: DateRangeFilter,
    filters: AnalyticsFilters
  ) {
    const [users, holidays, vacations] = await Promise.all([
      TimeAnalyticsRepository.getUsersWithSchedulesAndEntries(dateRange, filters),
      TimeAnalyticsRepository.getHolidaysInRange(dateRange),
      TimeAnalyticsRepository.getVacationsInRange(dateRange)
    ]);

    return { users, holidays, vacations };
  }

  /**
   * Build user schedule maps from batch data
   */
  private static _buildUserScheduleMaps(
    batchResults: any[]
  ): Map<number, UserScheduleMap> {
    const userData = new Map<number, UserScheduleMap>();

    // Default schedule for weekdays
    const defaultSchedule: Record<string, ScheduleInfo> = {
      'Monday': { is_work_day: true, expected_start_time: '09:00', expected_end_time: '17:00' },
      'Tuesday': { is_work_day: true, expected_start_time: '09:00', expected_end_time: '17:00' },
      'Wednesday': { is_work_day: true, expected_start_time: '09:00', expected_end_time: '17:00' },
      'Thursday': { is_work_day: true, expected_start_time: '09:00', expected_end_time: '17:00' },
      'Friday': { is_work_day: true, expected_start_time: '09:00', expected_end_time: '17:00' },
      'Saturday': { is_work_day: false, expected_start_time: '09:00', expected_end_time: null },
      'Sunday': { is_work_day: false, expected_start_time: '09:00', expected_end_time: null }
    };

    for (const row of batchResults) {
      if (!userData.has(row.user_id)) {
        // Convert hire_date to string format
        let hireDateStr: string | null = null;
        if (row.hire_date) {
          if (row.hire_date instanceof Date) {
            hireDateStr = row.hire_date.toISOString().split('T')[0];
          } else {
            hireDateStr = row.hire_date.toString().split('T')[0];
          }
        }

        userData.set(row.user_id, {
          user_id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          hire_date: hireDateStr,
          schedules: new Map(),
          existingDates: new Set(row.existing_dates ? row.existing_dates.split(',').filter(Boolean) : [])
        });
      }

      const userInfo = userData.get(row.user_id)!;

      // Add schedule info if exists
      if (row.day_of_week) {
        userInfo.schedules.set(row.day_of_week, {
          is_work_day: Boolean(row.is_work_day),
          expected_start_time: row.expected_start_time || '09:00',
          expected_end_time: row.expected_end_time || '17:00'
        });
      }
    }

    // Add default schedules for users without custom schedules
    for (const [userId, userInfo] of userData) {
      if (userInfo.schedules.size === 0) {
        for (const [day, schedule] of Object.entries(defaultSchedule)) {
          userInfo.schedules.set(day, schedule);
        }
      }
    }

    return userData;
  }

  /**
   * Build vacation lookup map
   */
  private static _buildVacationMap(vacations: any[]): Map<number, Set<string>> {
    const vacationMap = new Map<number, Set<string>>();
    const MAX_VACATION_DAYS = 365;

    for (const vacation of vacations) {
      if (!vacationMap.has(vacation.user_id)) {
        vacationMap.set(vacation.user_id, new Set<string>());
      }

      const userVacationDates = vacationMap.get(vacation.user_id)!;
      const vStartStr = vacation.start_date instanceof Date
        ? vacation.start_date.toISOString().split('T')[0]
        : vacation.start_date.toString().split('T')[0];
      const vEndStr = vacation.end_date instanceof Date
        ? vacation.end_date.toISOString().split('T')[0]
        : vacation.end_date.toString().split('T')[0];

      // Iterate through vacation dates
      const vStart = new Date(vStartStr + 'T00:00:00.000Z');
      const vEnd = new Date(vEndStr + 'T00:00:00.000Z');
      let vCurrentDate = new Date(vStart);
      let iterations = 0;

      while (vCurrentDate <= vEnd && iterations < MAX_VACATION_DAYS) {
        const year = vCurrentDate.getFullYear();
        const month = String(vCurrentDate.getMonth() + 1).padStart(2, '0');
        const day = String(vCurrentDate.getDate()).padStart(2, '0');
        userVacationDates.add(`${year}-${month}-${day}`);

        vCurrentDate.setUTCDate(vCurrentDate.getUTCDate() + 1);
        iterations++;
      }
    }

    return vacationMap;
  }

  /**
   * Build holiday set
   */
  private static _buildHolidaySet(holidays: any[]): Set<string> {
    return new Set(holidays.map(h => {
      if (h.holiday_date instanceof Date) {
        return h.holiday_date.toISOString().split('T')[0];
      }
      return h.holiday_date.toString().split('T')[0];
    }));
  }

  /**
   * Compute missing entries
   */
  private static _computeMissingEntries(
    userData: Map<number, UserScheduleMap>,
    vacationMap: Map<number, Set<string>>,
    holidaySet: Set<string>,
    dateRange: DateRangeFilter,
    startTime: number,
    timeout: number
  ): MissingEntryData[] {
    const missingEntries: MissingEntryData[] = [];
    const start = new Date(dateRange.startDate + 'T00:00:00.000Z');
    const end = new Date(dateRange.endDate + 'T00:00:00.000Z');
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const MAX_ITERATIONS = daysDiff + 5;

    let currentDate = new Date(start);
    let iterations = 0;

    while (currentDate <= end && iterations < MAX_ITERATIONS) {
      // Check timeout
      if (Date.now() - startTime > timeout - 1000) {
        console.log(`[MISSING] Timeout approaching, stopping at ${iterations} iterations`);
        break;
      }

      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });

      // Skip holidays
      if (holidaySet.has(dateStr)) {
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        iterations++;
        continue;
      }

      // Check each user
      for (const [userId, userInfo] of userData) {
        // Skip if user is on vacation
        if (vacationMap.get(userId)?.has(dateStr)) {
          continue;
        }

        // Skip if date is before user's hire date
        if (userInfo.hire_date && dateStr < userInfo.hire_date) {
          continue;
        }

        // Get schedule for this day
        const daySchedule = userInfo.schedules.get(dayName);
        if (!daySchedule || !daySchedule.is_work_day) {
          continue;
        }

        // Check if entry exists
        if (!userInfo.existingDates.has(dateStr)) {
          missingEntries.push({
            user_id: userId,
            first_name: userInfo.first_name,
            last_name: userInfo.last_name,
            missing_date: dateStr,
            day_of_week: dayName,
            expected_start: daySchedule.expected_start_time,
            expected_end: daySchedule.expected_end_time || '17:00'
          });
        }
      }

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      iterations++;
    }

    return missingEntries;
  }
}
