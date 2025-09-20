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
 * @returns Eastern time as formatted datetime string
 */
export function getCurrentEasternTime(): string {
  const now = new Date();
  
  // 🚨 DEBUGGING: Log timezone calculation
  console.log(`🌍 TIMEZONE DEBUG - UTC time: ${now.toISOString()}`);
  console.log(`🌍 Current month: ${now.getMonth() + 1}, Date: ${now.getDate()}`);
  
  // Eastern Time is UTC-4 (during daylight saving time) or UTC-5 (standard time)
  // For August, it's daylight saving time (EDT = UTC-4)
  // 🚨 BUG: This is hardcoded for August! September may be different!
  const easternOffset = -4 * 60; // -4 hours in minutes
  console.log(`🌍 Using Eastern offset: ${easternOffset} minutes (${easternOffset/60} hours)`);
  
  const easternTime = new Date(now.getTime() + (easternOffset * 60 * 1000));
  const formattedTime = easternTime.toISOString().slice(0, 19).replace('T', ' ');
  
  console.log(`🌍 Calculated Eastern time: ${formattedTime}`);
  
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