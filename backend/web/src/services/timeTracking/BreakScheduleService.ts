// File Clean up Finished: Nov 14, 2025
// Changes:
// - Converted from static methods to instance-based pattern with dependency injection
// - Fixed permission check: now uses time_management.update instead of time_tracking.list
// - Removed unused user parameter from getScheduledBreaks() (auth middleware handles it)
// - Changed import from TimeTrackingPermissions to direct hasPermission() call
// - Updated return type from ApiResponse to SuccessResponse for type accuracy
// - Added architecture documentation header
import { BreakScheduleRepository } from '../../repositories/timeTracking/BreakScheduleRepository';
import { hasPermission } from '../../middleware/rbac';
import { User } from '../../types';
import {
  ScheduledBreak,
  BreakScheduleUpdateBody,
  SuccessResponse
} from '../../types/TimeTrackingTypes';

/**
 * Break Schedule Service
 * Handles break schedule management and validation business logic
 *
 * Part of Enhanced Three-Layer Architecture:
 * Route → Controller → Service → Repository → Database
 */
export class BreakScheduleService {
  constructor(private repository: typeof BreakScheduleRepository = BreakScheduleRepository) {}

  /**
   * Get all scheduled breaks
   * No special permissions required - all authenticated users can view break schedules
   * @returns All active scheduled breaks
   */
  async getScheduledBreaks(): Promise<ScheduledBreak[]> {
    return await this.repository.getAllActiveBreaks();
  }

  /**
   * Update scheduled break (requires time_management.update permission)
   * @param user - User object
   * @param breakId - Break ID to update
   * @param data - Update data
   * @returns Success response
   * @throws Error if insufficient permissions or break not found
   */
  async updateScheduledBreak(
    user: User,
    breakId: number,
    data: BreakScheduleUpdateBody
  ): Promise<SuccessResponse> {
    // Check time management update permission
    const canUpdate = await hasPermission(user.user_id, 'time_management.update');
    if (!canUpdate) {
      throw new Error('Insufficient permissions to update break schedules');
    }

    // Validate required fields
    if (!data.start_time || !data.end_time || !data.duration_minutes || !data.days_of_week) {
      throw new Error('All fields are required: start_time, end_time, duration_minutes, days_of_week');
    }

    // Validate duration_minutes is positive
    if (data.duration_minutes <= 0) {
      throw new Error('Duration must be greater than 0');
    }

    // Validate time format (basic check)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(data.start_time) || !timeRegex.test(data.end_time)) {
      throw new Error('Invalid time format. Use HH:MM format');
    }

    // Update the break schedule
    const affectedRows = await this.repository.updateBreak(breakId, {
      start_time: data.start_time,
      end_time: data.end_time,
      duration_minutes: data.duration_minutes,
      days_of_week: data.days_of_week
    });

    if (affectedRows === 0) {
      throw new Error('Break schedule not found');
    }

    return {
      success: true,
      message: 'Break schedule updated successfully'
    };
  }
}