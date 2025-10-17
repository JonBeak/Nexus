/**
 * Time Entries Service
 * Business logic layer for time entries CRUD operations
 * Extracted from timeEntries.ts route file (445 → 150 lines, 66% reduction)
 */

import { User } from '../../types';
import { TimeTrackingPermissions } from '../../utils/timeTracking/permissions';
import { TimeEntryRepository } from '../../repositories/timeTracking/TimeEntryRepository';
import { query } from '../../config/database';
import {
  ServiceResponse,
  TimeEntry,
  TimeEntryFilters,
  TimeEntryCreateData,
  TimeEntryUpdateData,
  ServiceOptions,
  CacheEntry,
  CACHE_TTL,
  SimpleUser
} from '../../types/TimeManagementTypes';

export class TimeEntriesService {
  // Cache storage for users list
  private static cache = new Map<string, CacheEntry<any>>();

  /**
   * Get time entries with filters
   * @param user - Authenticated user
   * @param filters - Query filters
   * @param options - Service options
   * @returns List of time entries
   */
  static async getTimeEntries(
    user: User,
    filters: TimeEntryFilters,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<TimeEntry[]>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canView = await TimeTrackingPermissions.canViewTimeEntriesHybrid(user);
        if (!canView) {
          return {
            success: false,
            error: 'You do not have permission to view time entries',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Fetch entries
      const entries = await TimeEntryRepository.findEntries(filters);

      return { success: true, data: entries };
    } catch (error: any) {
      console.error('Error in getTimeEntries:', error);
      return {
        success: false,
        error: 'Failed to fetch time entries',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Create new time entry
   * @param user - Authenticated user
   * @param data - Entry data
   * @param options - Service options
   * @returns Entry ID
   */
  static async createTimeEntry(
    user: User,
    data: TimeEntryCreateData,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<{ entry_id: number }>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canCreate = await TimeTrackingPermissions.canCreateTimeEntriesHybrid(user);
        if (!canCreate) {
          return {
            success: false,
            error: 'You do not have permission to create time entries',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Validate required fields
      if (!data.user_id || !data.clock_in) {
        return {
          success: false,
          error: 'Missing required fields: user_id, clock_in',
          code: 'VALIDATION_ERROR'
        };
      }

      // Calculate total hours if clock_out is provided
      let total_hours = 0;
      if (data.clock_out && data.clock_in !== data.clock_out) {
        const startTime = new Date(data.clock_in);
        const endTime = new Date(data.clock_out);
        const diffMs = endTime.getTime() - startTime.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const breakHours = (data.break_minutes || 0) / 60;
        total_hours = Math.max(0, diffHours - breakHours);
      }

      // Create entry in database
      const entryId = await TimeEntryRepository.createEntry({
        user_id: data.user_id,
        clock_in: data.clock_in,
        clock_out: data.clock_out || null,
        break_minutes: data.break_minutes || 30,
        total_hours,
        status: data.status || 'completed',
        notes: data.notes || ''
      });

      // Log audit trail
      await query(
        `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'create', 'time_entry', ?, ?)`,
        [user.user_id, entryId, `Created time entry for user ${data.user_id}`]
      );

      return { success: true, data: { entry_id: entryId } };
    } catch (error: any) {
      console.error('Error in createTimeEntry:', error);
      return {
        success: false,
        error: 'Failed to create time entry',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Update single time entry
   * @param user - Authenticated user
   * @param entryId - Entry ID to update
   * @param data - Update data
   * @param options - Service options
   * @returns Success status
   */
  static async updateTimeEntry(
    user: User,
    entryId: number,
    data: TimeEntryUpdateData,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<void>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canUpdate = await TimeTrackingPermissions.canUpdateTimeEntriesHybrid(user);
        if (!canUpdate) {
          return {
            success: false,
            error: 'You do not have permission to update time entries',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Validate entry exists
      const existingEntry = await TimeEntryRepository.getEntryById(entryId);
      if (!existingEntry) {
        return {
          success: false,
          error: 'Time entry not found',
          code: 'NOT_FOUND'
        };
      }

      // Validate at least one field is provided
      if (data.clock_in === undefined && data.clock_out === undefined && data.break_minutes === undefined) {
        return {
          success: false,
          error: 'No updates provided',
          code: 'VALIDATION_ERROR'
        };
      }

      // Update entry with payroll synchronization
      await TimeEntryRepository.updateEntry(entryId, data);

      // Log audit trail
      await query(
        `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'update', 'time_entry', ?, ?)`,
        [user.user_id, entryId, JSON.stringify(data)]
      );

      return { success: true };
    } catch (error: any) {
      console.error('Error in updateTimeEntry:', error);
      return {
        success: false,
        error: 'Failed to update time entry',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Delete single time entry (soft delete)
   * @param user - Authenticated user
   * @param entryId - Entry ID to delete
   * @param options - Service options
   * @returns Success status
   */
  static async deleteTimeEntry(
    user: User,
    entryId: number,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<void>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canDelete = await TimeTrackingPermissions.canDeleteTimeEntriesHybrid(user);
        if (!canDelete) {
          return {
            success: false,
            error: 'You do not have permission to delete time entries',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Validate entry ID
      if (!entryId || isNaN(entryId)) {
        return {
          success: false,
          error: 'Invalid entry ID',
          code: 'VALIDATION_ERROR'
        };
      }

      // Soft delete entry
      await TimeEntryRepository.deleteEntry(entryId);

      // Log audit trail
      await query(
        `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'delete', 'time_entry', ?, ?)`,
        [user.user_id, entryId.toString(), JSON.stringify({ deleted: true })]
      );

      return { success: true };
    } catch (error: any) {
      console.error('Error in deleteTimeEntry:', error);
      return {
        success: false,
        error: 'Failed to delete time entry',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Bulk update time entries
   * @param user - Authenticated user
   * @param entryIds - Array of entry IDs
   * @param updates - Update data to apply to all entries
   * @param options - Service options
   * @returns Success status
   */
  static async bulkUpdateEntries(
    user: User,
    entryIds: number[],
    updates: TimeEntryUpdateData,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<void>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canUpdate = await TimeTrackingPermissions.canUpdateTimeEntriesHybrid(user);
        if (!canUpdate) {
          return {
            success: false,
            error: 'You do not have permission to update time entries',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Validate entry IDs
      if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
        return {
          success: false,
          error: 'No entries selected',
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate updates provided
      if (updates.clock_in === undefined && updates.clock_out === undefined && updates.break_minutes === undefined) {
        return {
          success: false,
          error: 'No updates provided',
          code: 'VALIDATION_ERROR'
        };
      }

      // Bulk update entries
      await TimeEntryRepository.bulkUpdate(entryIds, updates);

      // Log audit trail
      await query(
        `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'bulk_edit', 'time_entries', ?, ?)`,
        [user.user_id, entryIds.join(','), JSON.stringify(updates)]
      );

      return { success: true };
    } catch (error: any) {
      console.error('Error in bulkUpdateEntries:', error);
      return {
        success: false,
        error: 'Failed to update entries',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Bulk delete time entries (soft delete)
   * @param user - Authenticated user
   * @param entryIds - Array of entry IDs
   * @param options - Service options
   * @returns Success status with count
   */
  static async bulkDeleteEntries(
    user: User,
    entryIds: number[],
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<{ count: number }>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canDelete = await TimeTrackingPermissions.canDeleteTimeEntriesHybrid(user);
        if (!canDelete) {
          return {
            success: false,
            error: 'You do not have permission to delete time entries',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Validate entry IDs
      if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
        return {
          success: false,
          error: 'No entries selected',
          code: 'VALIDATION_ERROR'
        };
      }

      // Bulk delete entries
      await TimeEntryRepository.bulkDelete(entryIds);

      // Log audit trail
      await query(
        `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'bulk_delete', 'time_entries', ?, ?)`,
        [user.user_id, entryIds.join(','), JSON.stringify({ deleted_count: entryIds.length })]
      );

      return { success: true, data: { count: entryIds.length } };
    } catch (error: any) {
      console.error('Error in bulkDeleteEntries:', error);
      return {
        success: false,
        error: 'Failed to delete entries',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Get active users list
   * Cached for 1 hour to reduce database load
   * @param user - Authenticated user
   * @param options - Service options
   * @returns List of active users
   */
  static async getActiveUsers(
    user: User,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse<SimpleUser[]>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        const canView = await TimeTrackingPermissions.canViewTimeEntriesHybrid(user);
        if (!canView) {
          return {
            success: false,
            error: 'You do not have permission to view users',
            code: 'PERMISSION_DENIED'
          };
        }
      }

      // Check cache
      const cacheKey = 'active_users';
      if (options.useCache !== false) {
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiry > Date.now()) {
          return { success: true, data: cached.data, cached: true };
        }
      }

      // Fetch users
      const users = await TimeEntryRepository.getActiveUsers();

      // Cache result
      if (options.useCache !== false) {
        this.cache.set(cacheKey, {
          data: users,
          expiry: Date.now() + CACHE_TTL.USERS
        });
      }

      return { success: true, data: users };
    } catch (error: any) {
      console.error('Error in getActiveUsers:', error);
      return {
        success: false,
        error: 'Failed to fetch users',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Clear cache (called after mutations that affect users)
   */
  static clearCache(): void {
    this.cache.clear();
    console.log('[CACHE] TimeEntriesService cache cleared');
  }
}
