import { BreakScheduleRepository } from '../../repositories/timeTracking/BreakScheduleRepository';
import { BreakCalculationResult } from '../../types/TimeTrackingTypes';
import { getDayOfWeek, calculateMinutesBetween, roundHours } from '../../utils/timeTracking/DateTimeUtils';

/**
 * Time Calculation Service
 * Handles break calculations, time conversions, and hour totals
 */
export class TimeCalculationService {
  /**
   * Calculate break time based on clock in/out and scheduled breaks
   * @param clockIn - Clock in Date object
   * @param clockOut - Clock out Date object
   * @returns Break calculation result with minutes, applied breaks, and notes
   */
  static async calculateBreakTime(clockIn: Date, clockOut: Date): Promise<BreakCalculationResult> {
    const dayOfWeek = getDayOfWeek(clockIn);
    
    // Get scheduled breaks for this day
    const breaks = await BreakScheduleRepository.getBreaksForDay(dayOfWeek);

    let totalBreakMinutes = 0;
    const appliedBreaks: number[] = [];
    const notes: string[] = [];

    for (const scheduledBreak of breaks) {
      // Convert break times to full datetime for comparison
      const breakStart = new Date(clockIn);
      const [startHour, startMin] = scheduledBreak.start_time.split(':').map(Number);
      breakStart.setHours(startHour, startMin, 0, 0);
      
      const breakEnd = new Date(clockIn);
      const [endHour, endMin] = scheduledBreak.end_time.split(':').map(Number);
      breakEnd.setHours(endHour, endMin, 0, 0);

      // Check if this break overlaps with the work period
      if (clockIn < breakEnd && clockOut > breakStart) {
        // Check if employee clocked out during the break
        if (clockOut >= breakStart && clockOut <= breakEnd) {
          notes.push(`Clocked out during ${scheduledBreak.break_name} - break not counted`);
          // Don't count this break
        } 
        // Check if employee clocked in during the break
        else if (clockIn >= breakStart && clockIn <= breakEnd) {
          notes.push(`Clocked in during ${scheduledBreak.break_name} - partial break counted`);
          // Calculate partial break time
          const partialMinutes = Math.floor((breakEnd.getTime() - clockIn.getTime()) / 60000);
          totalBreakMinutes += partialMinutes;
          appliedBreaks.push(scheduledBreak.break_id);
        }
        // Full break applies
        else {
          totalBreakMinutes += scheduledBreak.duration_minutes;
          appliedBreaks.push(scheduledBreak.break_id);
        }
      }
    }

    return {
      minutes: totalBreakMinutes,
      appliedBreaks,
      notes: notes.join('; ')
    };
  }

  /**
   * Calculate total work hours from clock in/out times and break minutes
   * @param clockIn - Clock in time string
   * @param clockOut - Clock out time string
   * @param breakMinutes - Break time in minutes
   * @returns Total work hours rounded to 2 decimal places
   */
  static calculateTotalHours(clockIn: string, clockOut: string, breakMinutes: number): number {
    const totalMinutes = calculateMinutesBetween(clockIn, clockOut);
    const workMinutes = totalMinutes - breakMinutes;
    return roundHours(workMinutes / 60);
  }

  /**
   * Calculate week total from time entries
   * @param entries - Array of time entries with total_hours
   * @returns Total hours for the week
   */
  static calculateWeekTotal(entries: Array<{ total_hours: number | string }>): number {
    const weekTotal = entries.reduce((sum, entry) => {
      const hours = Number(entry.total_hours) || 0;
      return sum + hours;
    }, 0);
    
    return roundHours(weekTotal);
  }

  /**
   * Recalculate hours for edit request processing
   * @param clockIn - Clock in time string
   * @param clockOut - Clock out time string
   * @param requestedBreakMinutes - Requested break minutes
   * @returns Object with calculated values and auto break info
   */
  static async recalculateHoursForRequest(
    clockIn: string, 
    clockOut: string, 
    requestedBreakMinutes: number
  ): Promise<{
    totalHours: number;
    autoBreakInfo: BreakCalculationResult;
    finalBreakMinutes: number;
  }> {
    // Calculate automatic breaks for reference only
    const autoBreakInfo = await TimeCalculationService.calculateBreakTime(
      new Date(clockIn), 
      new Date(clockOut)
    );
    
    // For edit requests, use the requested break minutes directly
    const finalBreakMinutes = requestedBreakMinutes || 0;
    
    // Calculate total hours with requested break minutes
    const totalHours = TimeCalculationService.calculateTotalHours(
      clockIn, 
      clockOut, 
      finalBreakMinutes
    );

    return {
      totalHours,
      autoBreakInfo,
      finalBreakMinutes
    };
  }
}