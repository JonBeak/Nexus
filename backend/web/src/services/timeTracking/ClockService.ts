// File Clean up Finished: 2025-11-15
// Changes:
// - Removed 11 debug console.log statements from clockOut() method
// - Removed 2 debug console.log statements from getWeeklySummary() method
// - Improved code clarity and consistency with ClockController cleanup
// - Reduced from 157 → 132 lines (16% reduction)

import { TimeEntryRepository } from '../../repositories/timeTracking/TimeEntryRepository';
import { TimeCalculationService } from './TimeCalculationService';
import { User } from '../../types';
import {
  ClockStatusResponse,
  ClockInResponse,
  ClockOutResponse,
  WeeklySummaryResponse
} from '../../types/TimeTypes';
import { getCurrentEasternTime, calculateWeekBounds } from '../../utils/timeTracking/DateTimeUtils';

/**
 * Clock Service
 * Handles clock in/out operations, status, and weekly summary business logic
 */
export class ClockService {
  /**
   * Get current clock status for a user
   * @param user - User object
   * @returns Clock status with active entry if any
   */
  static async getClockStatus(user: User): Promise<ClockStatusResponse> {
    const activeEntry = await TimeEntryRepository.getActiveEntry(user.user_id);
    
    return {
      isClocked: activeEntry !== null,
      currentEntry: activeEntry
    };
  }

  /**
   * Clock in a user
   * @param user - User object
   * @returns Clock in response with entry ID
   * @throws Error if already clocked in
   */
  static async clockIn(user: User): Promise<ClockInResponse> {
    // Check if already clocked in
    const activeEntry = await TimeEntryRepository.getActiveEntry(user.user_id);
    if (activeEntry) {
      throw new Error('Already clocked in');
    }

    // Create new time entry with Eastern time
    const easternClockIn = getCurrentEasternTime();
    const entryId = await TimeEntryRepository.createTimeEntry({
      user_id: user.user_id,
      clock_in: easternClockIn
    });

    return {
      message: 'Clocked in successfully',
      entry_id: entryId
    };
  }

  /**
   * Clock out a user
   * @param user - User object
   * @returns Clock out response with calculated hours and break info
   * @throws Error if not clocked in
   */
  static async clockOut(user: User): Promise<ClockOutResponse> {
    // Get active entry
    const activeEntry = await TimeEntryRepository.getActiveEntry(user.user_id);

    if (!activeEntry) {
      throw new Error('Not clocked in');
    }

    // Get Eastern time for clock out
    const easternClockOut = getCurrentEasternTime();
    const easternClockOutDate = new Date(easternClockOut);

    // Calculate break time using Eastern times
    const breakInfo = await TimeCalculationService.calculateBreakTime(
      new Date(activeEntry.clock_in),
      easternClockOutDate
    );

    // Calculate total hours
    const totalHours = TimeCalculationService.calculateTotalHours(
      activeEntry.clock_in,
      easternClockOut,
      breakInfo.minutes
    );

    // Update time entry
    const updateData = {
      clock_out: easternClockOut,
      auto_break_minutes: breakInfo.minutes,
      break_minutes: breakInfo.minutes, // Initially same as auto_break_minutes
      total_hours: totalHours,
      applied_breaks: JSON.stringify(breakInfo.appliedBreaks),
      break_adjustment_notes: breakInfo.notes || null
    };

    await TimeEntryRepository.updateTimeEntry(activeEntry.entry_id, updateData);

    return {
      message: 'Clocked out successfully',
      totalHours,
      breakMinutes: breakInfo.minutes,
      notes: breakInfo.notes
    };
  }

  /**
   * Get weekly summary for a user
   * @param user - User object
   * @param weekOffset - Week offset (0 = current, -1 = previous, etc.)
   * @returns Weekly summary with entries and totals
   */
  static async getWeeklySummary(user: User, weekOffset: number = 0): Promise<WeeklySummaryResponse> {
    const { weekStart, weekEnd } = calculateWeekBounds(weekOffset);

    // Get time entries for the week
    const entries = await TimeEntryRepository.getWeeklyEntries(user.user_id, weekStart, weekEnd);

    // Calculate week totals
    const weekTotal = TimeCalculationService.calculateWeekTotal(entries);

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      entries,
      weekTotal
    };
  }
}