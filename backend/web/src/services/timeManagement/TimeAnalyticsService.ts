// File Clean up Started: 2025-11-21
// File Clean up Finished: 2025-11-21
// Phase 2 Changes:
// - Removed TimeTrackingPermissions import (redundant with route-level RBAC)
// - Removed 3 service-level permission check blocks
// - Permissions now enforced at route level via requirePermission() middleware
//
// Previous cleanup: 2025-11-15
// - Split 612-line file into TimeAnalyticsService (255 lines) + MissingEntriesService (424 lines)
// - Repository refactored: pool.execute() → query(), duplicate filter logic extracted, legacy support removed

/**
 * Time Analytics Service
 * Business logic layer for time analytics operations
 * Split from original 612-line file - missing entries logic moved to MissingEntriesService
 *
 * ARCHITECTURAL STATUS:
 * ✅ 3-layer architecture (Route → Service → Repository)
 * ✅ Route-level RBAC protection (requirePermission middleware)
 * ✅ No redundant service-level permission checks
 */

import { User } from '../../types';
import { TimeAnalyticsRepository } from '../../repositories/timeManagement/TimeAnalyticsRepository';
import { MissingEntriesService } from './MissingEntriesService';
import {
  ServiceResponse,
  WeeklySummaryData,
  AnalyticsOverviewData,
  UserAnalyticsData,
  DateRangeFilter,
  AnalyticsFilters,
  ServiceOptions,
  CacheEntry,
  CACHE_TTL
} from '../../types/TimeTypes';

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
      // Permissions enforced at route level via requirePermission('time_management.view_reports') middleware

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
      // Permissions enforced at route level via requirePermission('time_management.view_reports') middleware

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
      // Permissions enforced at route level via requirePermission('time_management.view_reports') middleware

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
   * Delegates to MissingEntriesService
   */
  static async getMissingEntries(
    user: User,
    dateRange: DateRangeFilter,
    filters: AnalyticsFilters,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<any>> {
    return MissingEntriesService.getMissingEntries(user, dateRange, filters, options);
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

    // Also invalidate missing entries cache
    MissingEntriesService.invalidateCacheForUser(userId);
  }

  /**
   * Clear all cache
   */
  static clearCache(): void {
    this.cache.clear();
    console.log('[CACHE] All analytics cache cleared');

    // Also clear missing entries cache
    MissingEntriesService.clearCache();
  }
}
