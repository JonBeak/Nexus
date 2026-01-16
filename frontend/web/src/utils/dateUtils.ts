// Centralized date utility functions
// Extracted from TimeManagement.tsx monolith

export type ViewMode = 'single' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'semi-yearly' | 'yearly' | 'analytics' | 'missing';

// Get today's date as YYYY-MM-DD string
export const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Format time from datetime string to display format
// Handles both ISO strings (with Z for UTC) and MySQL datetime strings
export const formatTime = (dateString: string | null): string => {
  if (!dateString) return '-';

  // If string has 'Z' suffix, it's UTC - let JavaScript convert to local time
  // If no 'Z', treat as local time (MySQL format without timezone)
  const date = new Date(dateString);

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Format date from MySQL date string to display format (short: "Sun, Feb 8")
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

// Format date to long format (e.g., "February 8, 2026")
export const formatDateLong = (dateString?: string | null): string => {
  if (!dateString) return '-';
  // Handle YYYY-MM-DD format to avoid timezone issues
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  // Fallback for other formats
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
};

// Convert datetime string to datetime-local input format (YYYY-MM-DDTHH:MM)
// Handles both ISO strings (with Z for UTC) and MySQL datetime strings
export const toDateTimeLocal = (dateString: string | null): string => {
  if (!dateString) return '';

  // Let JavaScript handle the timezone conversion automatically
  const date = new Date(dateString);

  // Convert to YYYY-MM-DDTHH:MM format for datetime-local input (in local time)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Get the Saturday of the week containing the given date
export const getSaturdayOfWeek = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc., 6 = Saturday
  
  // Find the most recent Saturday (same logic as CalendarView)
  let daysBack;
  if (dayOfWeek === 6) {
    daysBack = 0; // Today is Saturday
  } else if (dayOfWeek === 0) {
    daysBack = 1; // Today is Sunday, go back 1 day
  } else {
    daysBack = dayOfWeek + 1; // Monday=2, Tuesday=3, etc.
  }
  
  const saturday = new Date(date);
  saturday.setDate(date.getDate() - daysBack);
  return saturday.toISOString().split('T')[0];
};

// Get the Friday of the week containing the given date
export const getFridayOfWeek = (dateStr: string): string => {
  const saturday = getSaturdayOfWeek(dateStr);
  const fridayDate = new Date(saturday + 'T12:00:00');
  fridayDate.setDate(fridayDate.getDate() + 6); // Saturday + 6 days = Friday
  return fridayDate.toISOString().split('T')[0];
};

// Navigate date based on view mode
export const navigateDate = (selectedDate: string, viewMode: ViewMode, direction: 'prev' | 'next'): string => {
  const currentDate = new Date(selectedDate + 'T12:00:00');
  
  if (viewMode === 'single' || viewMode === 'analytics' || viewMode === 'missing') {
    // Single day navigation
    currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
  } else if (viewMode === 'weekly') {
    // Weekly navigation (7 days)
    currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
  } else if (viewMode === 'bi-weekly') {
    // Bi-weekly navigation (14 days)
    currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 14 : -14));
  } else if (viewMode === 'monthly') {
    // Monthly navigation
    currentDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
  } else if (viewMode === 'quarterly') {
    // Quarterly navigation (3 months)
    currentDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 3 : -3));
  } else if (viewMode === 'semi-yearly') {
    // Semi-yearly navigation (6 months)
    currentDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 6 : -6));
  } else if (viewMode === 'yearly') {
    // Yearly navigation
    currentDate.setFullYear(currentDate.getFullYear() + (direction === 'next' ? 1 : -1));
  }
  
  return currentDate.toISOString().split('T')[0];
};

// Get date range for different view modes
export interface DateRange {
  startDate: string;
  endDate: string;
}

export const getDateRangeForViewMode = (selectedDate: string, viewMode: ViewMode): DateRange => {
  const currentDate = new Date(selectedDate + 'T12:00:00');
  
  switch (viewMode) {
    case 'single':
    case 'analytics':
    case 'missing':
      return {
        startDate: selectedDate,
        endDate: selectedDate
      };
    
    case 'weekly':
      return {
        startDate: getSaturdayOfWeek(selectedDate),
        endDate: getFridayOfWeek(selectedDate)
      };
    
    case 'bi-weekly': {
      const weekStartSat = getSaturdayOfWeek(selectedDate);
      const biWeekStart = new Date(weekStartSat + 'T12:00:00');
      biWeekStart.setDate(biWeekStart.getDate() - 7);
      return {
        startDate: biWeekStart.toISOString().split('T')[0],
        endDate: getFridayOfWeek(selectedDate)
      };
    }
    
    case 'monthly': {
      // First day of the month
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return {
        startDate: monthStart.toISOString().split('T')[0],
        endDate: monthEnd.toISOString().split('T')[0]
      };
    }
    
    case 'quarterly': {
      // First day of the quarter
      const quarter = Math.floor(currentDate.getMonth() / 3);
      const quarterStart = new Date(currentDate.getFullYear(), quarter * 3, 1);
      const quarterEnd = new Date(currentDate.getFullYear(), quarter * 3 + 3, 0);
      return {
        startDate: quarterStart.toISOString().split('T')[0],
        endDate: quarterEnd.toISOString().split('T')[0]
      };
    }
    
    case 'semi-yearly': {
      // First day of the half-year
      const half = currentDate.getMonth() < 6 ? 0 : 6;
      const halfStart = new Date(currentDate.getFullYear(), half, 1);
      const halfEnd = new Date(currentDate.getFullYear(), half + 6, 0);
      return {
        startDate: halfStart.toISOString().split('T')[0],
        endDate: halfEnd.toISOString().split('T')[0]
      };
    }
    
    case 'yearly': {
      // First day of the year
      const yearStart = new Date(currentDate.getFullYear(), 0, 1);
      const yearEnd = new Date(currentDate.getFullYear() + 1, 0, 0);
      return {
        startDate: yearStart.toISOString().split('T')[0],
        endDate: yearEnd.toISOString().split('T')[0]
      };
    }
    
    default:
      return {
        startDate: selectedDate,
        endDate: selectedDate
      };
  }
};

// Get period display name for different view modes
export const getPeriodDisplayName = (viewMode: ViewMode): string => {
  switch (viewMode) {
    case 'single': return 'Single Day';
    case 'weekly': return 'Weekly';
    case 'bi-weekly': return 'Bi-Weekly';
    case 'monthly': return 'Monthly';
    case 'quarterly': return 'Quarterly';
    case 'semi-yearly': return 'Semi-Yearly';
    case 'yearly': return 'Yearly';
    case 'analytics': return 'Analytics';
    case 'missing': return 'Missing Entries';
    default: return 'Unknown';
  }
};

// Format duration in minutes to readable string (e.g., "45m", "1h 30m", "2h")
export const formatDuration = (minutes: number | null): string => {
  if (minutes === null || minutes === 0) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// Format datetime for display (e.g., "Jan 15, 2:30 PM")
// Handles both ISO strings (with Z for UTC) and MySQL datetime strings
export const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Check if a date string is valid
export const isValidDateString = (dateString: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString + 'T12:00:00');
  return date.toISOString().split('T')[0] === dateString;
};

// Get date label for filters based on view mode
export const getDateLabel = (viewMode: ViewMode, dateRange: 'single' | 'range'): string => {
  if (dateRange === 'range') {
    return 'Start Date';
  }
  
  switch (viewMode) {
    case 'single': return 'Date';
    case 'weekly': return 'Week (Sat-Fri)';
    case 'bi-weekly': return 'Bi-Week (Sat-Fri)';
    case 'monthly': return 'Month';
    case 'quarterly': return 'Quarter';
    case 'semi-yearly': return 'Half-Year';
    case 'yearly': return 'Year';
    default: return 'Date';
  }
};

export default {
  getTodayString,
  formatTime,
  formatDate,
  formatDateLong,
  formatDateTime,
  formatDuration,
  toDateTimeLocal,
  getSaturdayOfWeek,
  getFridayOfWeek,
  navigateDate,
  getDateRangeForViewMode,
  getPeriodDisplayName,
  isValidDateString,
  getDateLabel
};