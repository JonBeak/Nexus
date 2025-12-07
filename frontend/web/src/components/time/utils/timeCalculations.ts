import type { TimeEntry } from '../../../types/time';
import { formatTimeForDisplay } from '../../../lib/timeUtils';

// Re-export for backwards compatibility
export const formatTime = formatTimeForDisplay;

export const formatDate = (dateString: string) => {
  if (!dateString) return '-';

  // Normalise to YYYY-MM-DD by stripping any time component first
  const [datePart] = dateString.includes('T')
    ? dateString.split('T')
    : dateString.split(' ');

  if (!datePart) return '-';

  const [yearStr, monthStr, dayStr] = datePart.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if ([year, month, day].some(Number.isNaN)) {
    return '-';
  }

  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
};

export const getStatusColor = (entry: TimeEntry) => {
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

export const navigateDate = (
  selectedDate: string,
  direction: 'prev' | 'next',
  setSelectedDate: (date: string) => void
) => {
  const currentDate = new Date(selectedDate + 'T12:00:00');

  // Simple day navigation - users control the date range via Quick Select
  currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
  setSelectedDate(currentDate.toISOString().split('T')[0]);
};
