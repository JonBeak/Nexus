import { TimeEntryRepository } from '../../repositories/timeTracking/TimeEntryRepository';
import { TimeCalculationService } from './TimeCalculationService';
import { User } from '../../types';
import { 
  ClockStatusResponse, 
  ClockInResponse, 
  ClockOutResponse,
  WeeklySummaryResponse 
} from '../../types/TimeTrackingTypes';
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
    console.log(`🕐 CLOCK OUT DEBUG - User ${user.user_id} (${user.username}) attempting to clock out`);
    
    // Get active entry
    const activeEntry = await TimeEntryRepository.getActiveEntry(user.user_id);
    console.log(`🕐 Active entry found:`, activeEntry);
    
    if (!activeEntry) {
      console.log(`❌ CLOCK OUT ERROR - No active entry found for user ${user.user_id}`);
      throw new Error('Not clocked in');
    }

    // Get Eastern time for clock out
    const easternClockOut = getCurrentEasternTime();
    const easternClockOutDate = new Date(easternClockOut);
    
    console.log(`🕐 Clock out times:`, {
      easternClockOut,
      easternClockOutDate,
      clockInTime: activeEntry.clock_in
    });
    
    // Calculate break time using Eastern times
    console.log(`🕐 Calculating break time...`);
    const breakInfo = await TimeCalculationService.calculateBreakTime(
      new Date(activeEntry.clock_in), 
      easternClockOutDate
    );
    console.log(`🕐 Break info calculated:`, breakInfo);
    
    // Calculate total hours
    console.log(`🕐 Calculating total hours...`);
    const totalHours = TimeCalculationService.calculateTotalHours(
      activeEntry.clock_in,
      easternClockOut,
      breakInfo.minutes
    );
    console.log(`🕐 Total hours calculated:`, totalHours);

    // Update time entry
    console.log(`🕐 Updating time entry ${activeEntry.entry_id}...`);
    const updateData = {
      clock_out: easternClockOut,
      auto_break_minutes: breakInfo.minutes,
      break_minutes: breakInfo.minutes, // Initially same as auto_break_minutes
      total_hours: totalHours,
      applied_breaks: JSON.stringify(breakInfo.appliedBreaks),
      break_adjustment_notes: breakInfo.notes || null
    };
    console.log(`🕐 Update data:`, updateData);
    
    const updateResult = await TimeEntryRepository.updateTimeEntry(activeEntry.entry_id, updateData);
    console.log(`🕐 Update result - affected rows:`, updateResult);

    console.log(`✅ CLOCK OUT SUCCESS - User ${user.user_id} clocked out successfully`);
    
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
    console.log('Backend: entries for weekTotal calculation:', entries.map(e => ({
      entry_id: e.entry_id,
      total_hours: e.total_hours,
      total_hours_type: typeof e.total_hours
    })));
    
    const weekTotal = TimeCalculationService.calculateWeekTotal(entries);
    
    console.log('Backend: final weekTotal:', weekTotal);

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      entries,
      weekTotal
    };
  }
}