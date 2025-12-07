/**
 * Time Management Utility Functions
 * Extracted from TimeManagement.tsx for reusability
 */

import { TimeEntry, ViewMode } from '../types/time';

/**
 * Get status color classes based on time entry properties
 */
export const getStatusColor = (entry: TimeEntry): string => {
  // Check for overtime (>8 hours)
  if (entry.total_hours > 8) return 'text-blue-600 bg-blue-50';
  // Check if edited
  if (entry.is_edited) return 'text-gray-600 bg-gray-50';
  // Check if late (clock in after 9 AM)
  const clockInHour = new Date(entry.clock_in).getHours();
  if (clockInHour > 9) return 'text-red-600 bg-red-50';
  // Normal
  return 'text-green-600 bg-green-50';
};

/**
 * Format MySQL/ISO datetime string to human-readable time (12-hour format with AM/PM)
 * Use this for displaying time to users in tables, cards, etc.
 *
 * @param dateString - MySQL datetime ('YYYY-MM-DD HH:MM:SS') or ISO datetime
 * @returns Formatted time string (e.g., "5:55 PM") or "-" if null
 *
 * @example
 * formatTimeForDisplay('2025-08-26 17:55:00') // "5:55 PM"
 * formatTimeForDisplay('2025-08-26T17:55:00.000Z') // "5:55 PM"
 */
export const formatTimeForDisplay = (dateString: string | null): string => {
  if (!dateString) return '-';

  // MySQL returns datetime as 'YYYY-MM-DD HH:MM:SS' which JavaScript interprets as local time
  // But if it includes 'T' it might be interpreted as UTC, causing timezone issues
  const date = new Date(dateString.replace('T', ' ').replace('Z', ''));

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format MySQL/ISO datetime to HH:MM format for HTML time input fields
 * Use this for setting the value attribute of <input type="time">
 *
 * @param dateString - MySQL datetime or ISO datetime string
 * @returns Time in HH:MM format (e.g., "17:55") or empty string if null
 *
 * @example
 * formatTimeForInput('2025-08-26 17:55:00') // "17:55"
 * formatTimeForInput('2025-08-26T17:55:00.000Z') // "17:55"
 */
export const formatTimeForInput = (dateString: string | null): string => {
  if (!dateString) return '';

  // Extract time portion from datetime string
  // Works with both MySQL format (YYYY-MM-DD HH:MM:SS) and ISO format (YYYY-MM-DDTHH:MM:SS.000Z)
  const normalized = dateString.replace(' ', 'T');
  return normalized.split('T')[1]?.substring(0, 5) || '';
};

/**
 * Alias for formatTimeForDisplay for backwards compatibility
 * @deprecated Use formatTimeForDisplay instead for clarity
 */
export const formatTime = formatTimeForDisplay;

/**
 * Convert 12-hour time components to 24-hour HH:MM format
 * Used by time picker components to convert user input to storage format
 *
 * @param hour - Hour in 12-hour format (1-12)
 * @param minute - Minute (0-59)
 * @param period - 'AM' or 'PM'
 * @returns Time in HH:MM format (24-hour, e.g., "17:30")
 *
 * @example
 * convert12To24Hour(5, 30, 'PM')  // "17:30"
 * convert12To24Hour(12, 0, 'AM')  // "00:00" (midnight)
 * convert12To24Hour(12, 0, 'PM')  // "12:00" (noon)
 * convert12To24Hour(9, 15, 'AM')  // "09:15"
 */
export const convert12To24Hour = (hour: number, minute: number, period: 'AM' | 'PM'): string => {
  let hour24 = hour;

  if (period === 'AM') {
    if (hour === 12) hour24 = 0;  // 12 AM = 00:xx (midnight)
  } else {
    if (hour !== 12) hour24 = hour + 12;  // PM hours (except 12)
  }

  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

/**
 * Parse MySQL datetime or HH:MM string to 12-hour time components
 * Used by time picker components to display current value
 *
 * @param timeString - MySQL datetime ('YYYY-MM-DD HH:MM:SS'), ISO datetime, or null
 * @returns Object with hour (1-12), minute (0-59), and period ('AM' | 'PM')
 *
 * @example
 * parse24HourTime('2025-12-06 17:30:00')  // { hour: 5, minute: 30, period: 'PM' }
 * parse24HourTime('2025-12-06T00:00:00.000Z')  // { hour: 12, minute: 0, period: 'AM' }
 * parse24HourTime(null)  // { hour: 9, minute: 0, period: 'AM' } (default)
 */
export const parse24HourTime = (
  timeString: string | null
): { hour: number; minute: number; period: 'AM' | 'PM' } => {
  if (!timeString) {
    return { hour: 9, minute: 0, period: 'AM' };  // Default to 9:00 AM
  }

  try {
    // Extract HH:MM from datetime string
    const hhMm = formatTimeForInput(timeString);  // Reuse existing function

    if (!hhMm) {
      return { hour: 9, minute: 0, period: 'AM' };
    }

    const [hourStr, minuteStr] = hhMm.split(':');
    const hour24 = parseInt(hourStr);
    const minute = parseInt(minuteStr);

    if (isNaN(hour24) || isNaN(minute)) {
      console.warn('Invalid time format:', timeString);
      return { hour: 9, minute: 0, period: 'AM' };
    }

    // Convert 24-hour to 12-hour
    let hour12 = hour24;
    let period: 'AM' | 'PM' = 'AM';

    if (hour24 === 0) {
      hour12 = 12;
      period = 'AM';
    } else if (hour24 === 12) {
      hour12 = 12;
      period = 'PM';
    } else if (hour24 > 12) {
      hour12 = hour24 - 12;
      period = 'PM';
    } else {
      hour12 = hour24;
      period = 'AM';
    }

    return {
      hour: Math.max(1, Math.min(12, hour12)),
      minute: Math.max(0, Math.min(59, minute)),
      period
    };
  } catch (error) {
    console.error('Error parsing time:', error);
    return { hour: 9, minute: 0, period: 'AM' };
  }
};

/**
 * Convert MySQL datetime to datetime-local input format
 */
export const toDateTimeLocal = (dateString: string | null): string => {
  if (!dateString) return '';
  
  // Same logic as formatTime - treat MySQL datetime as local time
  const date = new Date(dateString.replace('T', ' ').replace('Z', ''));
  
  // Convert to YYYY-MM-DDTHH:MM format for datetime-local input
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Create a Date object at noon (12:00:00) from a date string
 * This avoids timezone issues by anchoring to midday
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object set to 12:00:00
 */
export const createNoonDate = (dateStr: string): Date => {
  return new Date(dateStr + 'T12:00:00');
};

/**
 * Convert a Date object to YYYY-MM-DD string format
 * @param date - Date object to convert
 * @returns Date string in YYYY-MM-DD format
 */
export const toDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Get the Saturday that starts the work week for a given date
 * Work weeks run Saturday-Friday
 */
export const getSaturdayOfWeek = (dateStr: string): string => {
  const date = createNoonDate(dateStr);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc., 6 = Saturday

  // Find the most recent Saturday (same logic as CalendarView)
  let daysBack: number;
  if (dayOfWeek === 6) {
    daysBack = 0; // Today is Saturday
  } else if (dayOfWeek === 0) {
    daysBack = 1; // Today is Sunday, go back 1 day
  } else {
    daysBack = dayOfWeek + 1; // Monday=2, Tuesday=3, etc.
  }

  const saturday = new Date(date);
  saturday.setDate(date.getDate() - daysBack);
  saturday.setHours(12, 0, 0, 0);
  return toDateString(saturday);
};

/**
 * Get the Friday that ends the work week for a given date
 * Work weeks run Saturday-Friday
 */
export const getFridayOfWeek = (dateStr: string): string => {
  const saturday = getSaturdayOfWeek(dateStr);
  const fridayDate = createNoonDate(saturday);
  fridayDate.setDate(fridayDate.getDate() + 6); // Saturday + 6 days = Friday
  return toDateString(fridayDate);
};

/**
 * Get the Saturday from the PREVIOUS week (7 days before current week's Saturday)
 * Used for bi-weekly calendars showing "previous week + current week"
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns YYYY-MM-DD string for previous week's Saturday
 */
export const getPreviousSaturdayOfWeek = (dateStr: string): string => {
  const currentSaturday = getSaturdayOfWeek(dateStr);
  const previousSaturday = createNoonDate(currentSaturday);
  previousSaturday.setDate(previousSaturday.getDate() - 7);
  return toDateString(previousSaturday);
};

/**
 * Format date string for display
 */
export const formatDate = (dateString: string): string => {
  // Handle YYYY-MM-DD format to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
};

/**
 * Calculate date navigation based on view mode
 */
export const calculateNavigationDate = (
  currentDate: string,
  direction: 'prev' | 'next',
  viewMode: ViewMode
): string => {
  const date = new Date(currentDate + 'T12:00:00');
  
  switch (viewMode) {
    case 'single':
    case 'analytics':
    case 'missing':
      // Single day navigation
      date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
      break;
      
    case 'weekly':
      // Weekly navigation (7 days)
      date.setDate(date.getDate() + (direction === 'next' ? 7 : -7));
      break;
      
    case 'bi-weekly':
      // Bi-weekly navigation (14 days)
      date.setDate(date.getDate() + (direction === 'next' ? 14 : -14));
      break;
      
    case 'monthly':
      // Monthly navigation
      date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
      break;
      
    case 'quarterly':
      // Quarterly navigation (3 months)
      date.setMonth(date.getMonth() + (direction === 'next' ? 3 : -3));
      break;
      
    case 'semi-yearly':
      // Semi-yearly navigation (6 months)
      date.setMonth(date.getMonth() + (direction === 'next' ? 6 : -6));
      break;
      
    case 'yearly':
      // Yearly navigation
      date.setFullYear(date.getFullYear() + (direction === 'next' ? 1 : -1));
      break;
      
    default:
      // Default to single day
      date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
      break;
  }
  
  return date.toISOString().split('T')[0];
};

/**
 * Detect multiple entries for the same user on the same date
 */
export const detectMultipleEntries = (entries: TimeEntry[]): TimeEntry[] => {
  const entryMap = new Map<string, number>();
  
  // Count entries by user and date
  entries.forEach(entry => {
    const dateKey = entry.clock_in.split(' ')[0]; // Get date part only
    const key = `${entry.user_id}-${dateKey}`;
    entryMap.set(key, (entryMap.get(key) || 0) + 1);
  });
  
  // Add warning flag to entries
  return entries.map(entry => {
    const dateKey = entry.clock_in.split(' ')[0];
    const key = `${entry.user_id}-${dateKey}`;
    return {
      ...entry,
      has_multiple_entries: (entryMap.get(key) || 0) > 1
    };
  });
};

/**
 * Calculate week range for different period modes
 */
export interface WeekRange {
  start: string;
  end: string;
  label: string;
}

export const calculateWeekRange = (date: string, mode: ViewMode): WeekRange => {
  const saturday = getSaturdayOfWeek(date);
  const friday = getFridayOfWeek(date);
  
  switch (mode) {
    case 'weekly':
      return {
        start: saturday,
        end: friday,
        label: `Week of ${formatDate(saturday)}`
      };
      
    case 'bi-weekly':
      const nextSaturday = new Date(saturday + 'T12:00:00');
      nextSaturday.setDate(nextSaturday.getDate() + 7);
      const nextFriday = new Date(nextSaturday.toISOString().split('T')[0] + 'T12:00:00');
      nextFriday.setDate(nextFriday.getDate() + 6);
      
      return {
        start: saturday,
        end: nextFriday.toISOString().split('T')[0],
        label: `Bi-week of ${formatDate(saturday)}`
      };
      
    case 'monthly':
      const monthStart = new Date(date + 'T12:00:00');
      monthStart.setDate(1);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      
      return {
        start: monthStart.toISOString().split('T')[0],
        end: monthEnd.toISOString().split('T')[0],
        label: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      };
      
    case 'quarterly':
      const quarterStart = new Date(date + 'T12:00:00');
      const quarter = Math.floor(quarterStart.getMonth() / 3);
      quarterStart.setMonth(quarter * 3, 1);
      const quarterEnd = new Date(quarterStart);
      quarterEnd.setMonth(quarterEnd.getMonth() + 3);
      quarterEnd.setDate(0);
      
      return {
        start: quarterStart.toISOString().split('T')[0],
        end: quarterEnd.toISOString().split('T')[0],
        label: `Q${quarter + 1} ${quarterStart.getFullYear()}`
      };
      
    case 'semi-yearly':
      const halfStart = new Date(date + 'T12:00:00');
      const half = Math.floor(halfStart.getMonth() / 6);
      halfStart.setMonth(half * 6, 1);
      const halfEnd = new Date(halfStart);
      halfEnd.setMonth(halfEnd.getMonth() + 6);
      halfEnd.setDate(0);
      
      return {
        start: halfStart.toISOString().split('T')[0],
        end: halfEnd.toISOString().split('T')[0],
        label: `H${half + 1} ${halfStart.getFullYear()}`
      };
      
    case 'yearly':
      const yearStart = new Date(date + 'T12:00:00');
      yearStart.setMonth(0, 1);
      const yearEnd = new Date(yearStart);
      yearEnd.setMonth(11, 31);
      
      return {
        start: yearStart.toISOString().split('T')[0],
        end: yearEnd.toISOString().split('T')[0],
        label: yearStart.getFullYear().toString()
      };
      
    default:
      return {
        start: date,
        end: date,
        label: formatDate(date)
      };
  }
};

/**
 * Format period date based on view mode
 */
export const formatPeriodDate = (dateString: string, period: ViewMode): string => {
  const date = new Date(dateString + 'T12:00:00');
  
  switch (period) {
    case 'weekly':
    case 'bi-weekly':
      return formatDate(dateString);
      
    case 'monthly':
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
    case 'quarterly':
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `Q${quarter} ${date.getFullYear()}`;
      
    case 'semi-yearly':
      const half = Math.floor(date.getMonth() / 6) + 1;
      return `H${half} ${date.getFullYear()}`;
      
    case 'yearly':
      return date.getFullYear().toString();
      
    default:
      return formatDate(dateString);
  }
};