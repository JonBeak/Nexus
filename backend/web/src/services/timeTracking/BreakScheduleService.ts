import { BreakScheduleRepository } from '../../repositories/timeTracking/BreakScheduleRepository';
import { TimeTrackingPermissions } from '../../utils/timeTracking/permissions';
import { User } from '../../types';
import { 
  ScheduledBreak,
  BreakScheduleUpdateBody,
  ApiResponse 
} from '../../types/TimeTrackingTypes';

/**
 * Break Schedule Service
 * Handles break schedule management and validation business logic
 */
export class BreakScheduleService {
  /**
   * Get all scheduled breaks
   * @param user - User object (for authentication)
   * @returns All active scheduled breaks
   */
  static async getScheduledBreaks(user: User): Promise<ScheduledBreak[]> {
    // Basic authentication check - all logged in users can view breaks
    return await BreakScheduleRepository.getAllActiveBreaks();
  }

  /**
   * Update scheduled break (managers only)
   * @param user - User object
   * @param breakId - Break ID to update
   * @param data - Update data
   * @returns Success response
   * @throws Error if insufficient permissions or break not found
   */
  static async updateScheduledBreak(
    user: User, 
    breakId: number, 
    data: BreakScheduleUpdateBody
  ): Promise<ApiResponse> {
    // Check time tracking view permission using hybrid RBAC/legacy system
    const canView = await TimeTrackingPermissions.canViewTimeEntriesHybrid(user);
    if (!canView) {
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
    const affectedRows = await BreakScheduleRepository.updateBreak(breakId, {
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