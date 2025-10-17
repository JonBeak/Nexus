/**
 * Time Analytics Service
 * Business logic layer for time analytics operations
 */

import { User } from '../../types';
import { TimeTrackingPermissions } from '../../utils/timeTracking/permissions';
import { TimeAnalyticsRepository } from '../../repositories/timeManagement/TimeAnalyticsRepository';
import {
  ServiceResponse,
  WeeklySummaryData,
  AnalyticsOverviewData,
  UserAnalyticsData,
  MissingEntryData,
  DateRangeFilter,
  AnalyticsFilters,
  ServiceOptions,
  CacheEntry,
  UserScheduleMap,
  ScheduleInfo,
  CACHE_TTL
} from '../../types/TimeManagementTypes';

export class TimeAnalyticsService {
  // Cache storage
  private static cache = new Map<string, CacheEntry<any>>();

  /**
   * Get weekly summary for users
   */
  static async getWeeklySummary(
    user: User,
    dateRange: DateRangeFilter,
    filters: AnalyticsFilters,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<WeeklySummaryData[]>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canView = await TimeTrackingPermissions.canViewTimeAnalyticsHybrid(user);
        if (!canView) {
          return {
            success: false,
            error: 'You do not have permission to view time analytics',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Check cache
      const cacheKey = `summary_${user.user_id}_${dateRange.startDate}_${dateRange.endDate}_${filters.group || 'all'}`;
      if (options.useCache !== false) {
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiry > Date.now()) {
          return { success: true, data: cached.data, cached: true };
        }
      }

      // Fetch data
      const summary = await TimeAnalyticsRepository.getWeeklySummaryData(dateRange, filters);

      // Cache result
      if (options.useCache !== false) {
        this.cache.set(cacheKey, {
          data: summary,
          expiry: Date.now() + CACHE_TTL.WEEKLY_SUMMARY
        });
      }

      return { success: true, data: summary };
    } catch (error: any) {
      console.error('Error in getWeeklySummary:', error);
      return {
        success: false,
        error: 'Failed to fetch weekly summary',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Get analytics overview for dashboard
   */
  static async getAnalyticsOverview(
    user: User,
    dateRange: DateRangeFilter,
    filters: AnalyticsFilters,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<AnalyticsOverviewData>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canView = await TimeTrackingPermissions.canViewTimeAnalyticsHybrid(user);
        if (!canView) {
          return {
            success: false,
            error: 'You do not have permission to view time analytics',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Check cache
      const cacheKey = `analytics_${user.user_id}_${dateRange.startDate}_${dateRange.endDate}_${filters.group || 'all'}`;
      if (options.useCache !== false) {
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiry > Date.now()) {
          return { success: true, data: cached.data, cached: true };
        }
      }

      // Fetch all analytics data in parallel
      const [totalStats, onTimeStats, editStats, topPerformers, totalEmployees] = await Promise.all([
        TimeAnalyticsRepository.getTotalStats(dateRange, filters),
        TimeAnalyticsRepository.getOnTimeStats(dateRange, filters),
        TimeAnalyticsRepository.getEditStats(dateRange, filters),
        TimeAnalyticsRepository.getTopPerformers(dateRange, filters, 5),
        TimeAnalyticsRepository.getTotalEmployeeCount(filters)
      ]);

      // Compile analytics data
      const analytics: AnalyticsOverviewData = {
        totalEmployees,
        totalHours: Number(totalStats.total_hours),
        overtimeHours: Number(totalStats.overtime_hours),
        averageHoursPerEmployee: totalStats.active_employees > 0
          ? Number(totalStats.total_hours) / totalStats.active_employees
          : 0,
        onTimePercentage: onTimeStats.total_entries > 0
          ? (onTimeStats.on_time_entries / onTimeStats.total_entries) * 100
          : 100,
        attendanceRate: totalEmployees > 0
          ? (totalStats.active_employees / totalEmployees) * 100
          : 0,
        editRequestsCount: Number(editStats.edited_entries),
        topPerformers
      };

      // Cache result
      if (options.useCache !== false) {
        this.cache.set(cacheKey, {
          data: analytics,
          expiry: Date.now() + CACHE_TTL.ANALYTICS_OVERVIEW
        });
      }

      return { success: true, data: analytics };
    } catch (error: any) {
      console.error('Error in getAnalyticsOverview:', error);
      return {
        success: false,
        error: 'Failed to fetch analytics overview',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Get individual user analytics
   */
  static async getUserAnalytics(
    user: User,
    userId: number,
    dateRange: DateRangeFilter,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<UserAnalyticsData>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canView = await TimeTrackingPermissions.canViewTimeAnalyticsHybrid(user);
        if (!canView) {
          return {
            success: false,
            error: 'You do not have permission to view time analytics',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Check cache
      const cacheKey = `user_analytics_${userId}_${dateRange.startDate}_${dateRange.endDate}`;
      if (options.useCache !== false) {
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiry > Date.now()) {
          return { success: true, data: cached.data, cached: true };
        }
      }

      // Fetch analytics
      const analytics = await TimeAnalyticsRepository.getUserAnalytics(userId, dateRange);

      // Cache result
      if (options.useCache !== false) {
        this.cache.set(cacheKey, {
          data: analytics,
          expiry: Date.now() + CACHE_TTL.USER_ANALYTICS
        });
      }

      return { success: true, data: analytics };
    } catch (error: any) {
      console.error('Error in getUserAnalytics:', error);
      return {
        success: false,
        error: 'Failed to fetch user analytics',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Get missing time entries
   * This is the complex logic extracted from the route file
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
      // Check permissions
      if (options.validatePermissions !== false) {
        const canView = await TimeTrackingPermissions.canViewTimeAnalyticsHybrid(user);
        if (!canView) {
          return {
            success: false,
            error: 'You do not have permission to view time analytics',
            code: 'PERMISSION_DENIED'
          };
        }
      }

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
   * Invalidate cache for a user (called after mutations)
   */
  static invalidateCache(userId: number): void {
    const keysToDelete: string[] = [];
    for (const [key] of this.cache) {
      if (key.includes(`_${userId}_`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`[CACHE] Invalidated ${keysToDelete.length} cache entries for user ${userId}`);
  }

  /**
   * Clear all cache
   */
  static clearCache(): void {
    this.cache.clear();
    console.log('[CACHE] All cache cleared');
  }

  // ========================================================================
  // Private Helper Methods for Missing Entries
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
