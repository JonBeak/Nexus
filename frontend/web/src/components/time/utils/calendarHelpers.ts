/**
 * Calendar Helper Functions
 * Utility functions for CalendarView component
 * Extracted to keep CalendarView under 500-line limit
 */

import type { TimeUser } from '../../../types/time';

/**
 * Calendar entry type matching CalendarView's local type
 */
type CalendarEntry = {
  entry_id: number | null;
  user_id: number;
  first_name?: string;
  last_name?: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  total_hours: number;
  status: 'active' | 'completed';
};

/**
 * User time data structure
 */
export interface UserTimeData {
  user_id: number;
  first_name: string;
  last_name: string;
  entries: Record<string, CalendarEntry>;
  multipleEntriesWarning: { [date: string]: boolean };
}

/**
 * Generate array of dates for 2-week period (14 days)
 * @param startDate - Starting date in YYYY-MM-DD format
 * @returns Array of date strings in YYYY-MM-DD format
 */
export const generateWeekDates = (startDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate + 'T12:00:00');

  // Validate the date
  if (isNaN(start.getTime())) {
    console.error('Invalid start date:', startDate);
    return [];
  }

  for (let i = 0; i < 14; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
};

/**
 * Build user map from time entries
 * Groups entries by user_id and detects multiple entries per date
 * @param entries - Array of calendar entries
 * @returns Map of user_id to UserTimeData
 */
export const buildUserMapFromEntries = (entries: CalendarEntry[]): Map<number, UserTimeData> => {
  const userMap = new Map<number, UserTimeData>();

  entries.forEach((entry) => {
    if (!userMap.has(entry.user_id)) {
      userMap.set(entry.user_id, {
        user_id: entry.user_id,
        first_name: entry.first_name || '',
        last_name: entry.last_name || '',
        entries: {},
        multipleEntriesWarning: {}
      });
    }

    const userData = userMap.get(entry.user_id)!;
    const entryDate = entry.clock_in.split('T')[0];

    // Check if there's already an entry for this date
    if (userData.entries[entryDate]) {
      // Mark this date as having multiple entries
      userData.multipleEntriesWarning[entryDate] = true;
    }

    userData.entries[entryDate] = entry;
  });

  return userMap;
};

/**
 * Filter users by group
 * @param allUsers - All active users
 * @param groupFilter - Group filter ('all' or specific group name)
 * @returns Filtered array of users
 */
export const filterUsers = (
  allUsers: TimeUser[],
  groupFilter: string
): TimeUser[] => {
  if (groupFilter === 'all') {
    return allUsers;
  }

  return allUsers.filter(user => user.user_group === groupFilter);
};

/**
 * Check if user has entries in the given date range
 * @param userData - User time data (may be undefined)
 * @param dateRange - Array of dates in YYYY-MM-DD format
 * @returns True if user has at least one entry in range
 */
export const hasEntriesInRange = (
  userData: UserTimeData | undefined,
  dateRange: string[]
): boolean => {
  if (!userData) return false;

  return dateRange.some(date => userData.entries[date] !== undefined);
};

/**
 * Sort users into two groups: with entries (A-Z), without entries (A-Z)
 * @param filteredUsers - Users filtered by group
 * @param userTimeDataMap - Map of user_id to their time data
 * @param dateRange - Current date range being displayed
 * @returns Sorted array of UserTimeData
 */
export const sortUsers = (
  filteredUsers: TimeUser[],
  userTimeDataMap: Map<number, UserTimeData>,
  dateRange: string[]
): UserTimeData[] => {
  const usersWithEntries: UserTimeData[] = [];
  const usersWithoutEntries: UserTimeData[] = [];

  filteredUsers.forEach(user => {
    const userData = userTimeDataMap.get(user.user_id);

    if (userData && hasEntriesInRange(userData, dateRange)) {
      // User has entries in current period
      usersWithEntries.push(userData);
    } else {
      // User has no entries - create empty UserTimeData
      usersWithoutEntries.push({
        user_id: user.user_id,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        entries: {},
        multipleEntriesWarning: {}
      });
    }
  });

  // Sort each group alphabetically by name
  const sortByName = (a: UserTimeData, b: UserTimeData) => {
    const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
    const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
    return nameA.localeCompare(nameB);
  };

  usersWithEntries.sort(sortByName);
  usersWithoutEntries.sort(sortByName);

  // Combine: entries first, then non-entries
  return [...usersWithEntries, ...usersWithoutEntries];
};

/**
 * Cell key type for tracking edited cells
 */
export type CellField = 'in' | 'out' | 'break';

/**
 * Parsed cell key data
 */
export interface ParsedCellKey {
  userId: number;
  date: string;
  field: CellField;
}

/**
 * Generate a unique cell key for tracking edited cells
 * Format: "userId-YYYY-MM-DD-field"
 * @param userId - User ID
 * @param date - Date in YYYY-MM-DD format
 * @param field - Field type ('in', 'out', or 'break')
 * @returns Unique cell key string
 */
export const generateCellKey = (userId: number, date: string, field: CellField): string => {
  return `${userId}-${date}-${field}`;
};

/**
 * Parse a cell key string back into its components
 * @param cellKey - Cell key in format "userId-YYYY-MM-DD-field"
 * @returns Parsed cell key data
 */
export const parseCellKey = (cellKey: string): ParsedCellKey => {
  // Cell key format: "userId-YYYY-MM-DD-field"
  // Split and reconstruct date from parts
  const parts = cellKey.split('-');
  const userIdStr = parts[0];
  const date = `${parts[1]}-${parts[2]}-${parts[3]}`; // Reconstruct YYYY-MM-DD
  const field = parts[4] as CellField;

  return {
    userId: parseInt(userIdStr),
    date,
    field
  };
};

/**
 * Calculate total hours for a user across all their entries
 * @param userData - User time data
 * @returns Total hours as a number
 */
export const calculateTotalHours = (userData: UserTimeData): number => {
  return Object.values(userData.entries).reduce((total, entry) => {
    return total + (parseFloat(String(entry.total_hours)) || 0);
  }, 0);
};

/**
 * Export all helpers as a single object for convenient importing
 */
export const calendarHelpers = {
  generateWeekDates,
  buildUserMapFromEntries,
  filterUsers,
  hasEntriesInRange,
  sortUsers,
  generateCellKey,
  parseCellKey,
  calculateTotalHours
};
