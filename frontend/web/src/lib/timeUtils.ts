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
 * Format MySQL datetime string to readable time
 */
export const formatTime = (dateString: string | null): string => {
  if (!dateString) return '-';
  
  // MySQL returns datetime as 'YYYY-MM-DD HH:MM:SS' which JavaScript interprets as local time
  // But if it includes 'T' it might be interpreted as UTC, causing timezone issues
  const date = new Date(dateString.replace('T', ' ').replace('Z', ''));
  
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
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
 * Get the Saturday that starts the work week for a given date
 * Work weeks run Saturday-Friday
 */
export const getSaturdayOfWeek = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
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
  return saturday.toISOString().split('T')[0];
};

/**
 * Get the Friday that ends the work week for a given date
 * Work weeks run Saturday-Friday
 */
export const getFridayOfWeek = (dateStr: string): string => {
  const saturday = getSaturdayOfWeek(dateStr);
  const fridayDate = new Date(saturday + 'T12:00:00');
  fridayDate.setDate(fridayDate.getDate() + 6); // Saturday + 6 days = Friday
  return fridayDate.toISOString().split('T')[0];
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