// File Clean up Finished: 2025-11-18
// Changes:
// - Replaced custom DST calculation (64 lines) with JavaScript's built-in Intl.DateTimeFormat
// - Removed manual isEasternDaylightTime() function (error-prone edge cases)
// - Removed debug console.log from getCurrentEasternTime()
// - Modernized timezone handling using America/New_York timezone (future-proof)
// - Reduced from 138 → 100 lines (27.5% reduction)
// - Zero breaking changes - same function signatures and return formats

/**
 * Date and Time Utilities for Time Tracking
 * Handles Eastern timezone conversions and datetime formatting
 */

/**
 * Convert datetime-local string to proper format for database storage
 * @param localDatetimeString - datetime-local input value
 * @returns Formatted datetime string for database
 */
export function convertLocalToUTC(localDatetimeString: string): string {
  if (!localDatetimeString) return localDatetimeString;
  
  // Simply format the datetime-local string for database storage
  // The datetime-local format is already in the user's timezone, so we keep it as-is
  return localDatetimeString.replace('T', ' ') + ':00';
}

/**
 * Get current time in Eastern timezone for database storage
 * Uses JavaScript's built-in Intl.DateTimeFormat for reliable DST handling
 * Automatically handles EDT (UTC-4) and EST (UTC-5) transitions
 * @returns Eastern time as formatted datetime string (YYYY-MM-DD HH:MM:SS)
 */
export function getCurrentEasternTime(): string {
  const now = new Date();

  // Use built-in timezone support for America/New_York
  // This automatically handles DST transitions, including edge cases
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;
  const hour = parts.find(p => p.type === 'hour')!.value;
  const minute = parts.find(p => p.type === 'minute')!.value;
  const second = parts.find(p => p.type === 'second')!.value;

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Calculate week start and end dates for weekly summary
 * @param weekOffset - Offset from current week (0 = current, -1 = previous, etc.)
 * @returns Object with weekStart and weekEnd Date objects
 */
export function calculateWeekBounds(weekOffset: number = 0): { weekStart: Date; weekEnd: Date } {
  const today = new Date();
  const currentDay = today.getDay();
  const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1); // Monday start
  
  const weekStart = new Date(today.setDate(diff));
  weekStart.setDate(weekStart.getDate() + (weekOffset * 7));
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

/**
 * Round hours to 2 decimal places with proper precision
 * @param hours - Raw hours value
 * @returns Rounded hours value
 */
export function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

/**
 * Calculate total minutes between two datetime strings
 * @param startTime - Start datetime string
 * @param endTime - End datetime string
 * @returns Total minutes between the times
 */
export function calculateMinutesBetween(startTime: string, endTime: string): number {
  return Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);
}

/**
 * Get day of week name from Date object
 * @param date - Date object
 * @returns Day name (e.g., "Monday")
 */
export function getDayOfWeek(date: Date): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
}