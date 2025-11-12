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
 * Determine if a given date is within Daylight Saving Time (EDT)
 * DST in US: 2nd Sunday of March at 2:00 AM through 1st Sunday of November at 2:00 AM
 * @param date - Date to check
 * @returns true if date is in DST, false if in standard time
 */
function isEasternDaylightTime(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const dayOfMonth = date.getDate();
  const dayOfWeek = date.getDay();

  // DST is not active in January, February, November, December
  if (month < 2 || month > 10) return false;

  // DST is active all month in April-October
  if (month > 2 && month < 10) return true;

  // March: DST starts 2nd Sunday of March
  if (month === 2) {
    // Find the 2nd Sunday of March
    let sundayCount = 0;
    for (let day = 1; day <= 14; day++) {
      const testDate = new Date(year, month, day);
      if (testDate.getDay() === 0) {
        sundayCount++;
        if (sundayCount === 2) {
          return dayOfMonth >= day;
        }
      }
    }
  }

  // November: DST ends 1st Sunday of November
  if (month === 10) {
    // Find the 1st Sunday of November
    for (let day = 1; day <= 7; day++) {
      const testDate = new Date(year, month, day);
      if (testDate.getDay() === 0) {
        return dayOfMonth < day;
      }
    }
  }

  return false;
}

/**
 * Get current time in Eastern timezone for database storage
 * Automatically handles EDT (UTC-4) and EST (UTC-5) based on current date
 * @returns Eastern time as formatted datetime string
 */
export function getCurrentEasternTime(): string {
  const now = new Date();

  // Determine if we're in daylight saving time
  const isDST = isEasternDaylightTime(now);

  // EDT = UTC-4, EST = UTC-5
  const easternOffset = isDST ? -4 * 60 : -5 * 60; // in minutes

  // Calculate Eastern time
  const easternTime = new Date(now.getTime() + (easternOffset * 60 * 1000));
  const formattedTime = easternTime.toISOString().slice(0, 19).replace('T', ' ');

  // Log for debugging (can be removed in production)
  console.log(`🌍 TIMEZONE - UTC: ${now.toISOString()}, Eastern: ${formattedTime} (${isDST ? 'EDT' : 'EST'})`);

  return formattedTime;
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