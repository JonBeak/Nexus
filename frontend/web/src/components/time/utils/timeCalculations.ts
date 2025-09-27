import type { TimeEntry } from '../../../types/time';

export const formatTime = (dateString: string | null) => {
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

// Helper functions for Saturday-Friday week calculations
export const getSaturdayOfWeek = (dateStr: string) => {
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
  saturday.setHours(12, 0, 0, 0);
  return saturday.toISOString().split('T')[0];
};

export const getFridayOfWeek = (dateStr: string) => {
  const saturday = getSaturdayOfWeek(dateStr);
  const fridayDate = new Date(saturday + 'T12:00:00');
  fridayDate.setDate(fridayDate.getDate() + 6); // Saturday + 6 days = Friday
  return fridayDate.toISOString().split('T')[0];
};

export const navigateDate = (
  selectedDate: string,
  viewMode: string,
  direction: 'prev' | 'next',
  setSelectedDate: (date: string) => void
) => {
  const currentDate = new Date(selectedDate + 'T12:00:00');
  
  if (viewMode === 'single' || viewMode === 'analytics' || viewMode === 'missing') {
    // Single day navigation
    currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  } else if (viewMode === 'weekly') {
    // Weekly navigation (7 days)
    currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  } else if (viewMode === 'bi-weekly') {
    // Bi-weekly navigation (14 days)
    currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 14 : -14));
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  } else if (viewMode === 'monthly') {
    // Monthly navigation
    currentDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  } else if (viewMode === 'quarterly') {
    // Quarterly navigation (3 months)
    currentDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 3 : -3));
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  } else if (viewMode === 'semi-yearly') {
    // Semi-yearly navigation (6 months)
    currentDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 6 : -6));
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  } else if (viewMode === 'yearly') {
    // Yearly navigation
    currentDate.setFullYear(currentDate.getFullYear() + (direction === 'next' ? 1 : -1));
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  }
};

export const calculateDateRange = (selectedDate: string, viewMode: string) => {
  const currentDate = new Date(selectedDate + 'T12:00:00');
  
  if (viewMode === 'weekly') {
    return {
      start: getSaturdayOfWeek(selectedDate),
      end: getFridayOfWeek(selectedDate)
    };
  } else if (viewMode === 'bi-weekly') {
    const weekStartSat = getSaturdayOfWeek(selectedDate);
    const biWeekStart = new Date(weekStartSat + 'T12:00:00');
    biWeekStart.setDate(biWeekStart.getDate() - 7);
    return {
      start: biWeekStart.toISOString().split('T')[0],
      end: getFridayOfWeek(selectedDate)
    };
  } else if (viewMode === 'monthly') {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return {
      start: monthStart.toISOString().split('T')[0],
      end: monthEnd.toISOString().split('T')[0]
    };
  } else if (viewMode === 'quarterly') {
    const quarter = Math.floor(currentDate.getMonth() / 3);
    const quarterStart = new Date(currentDate.getFullYear(), quarter * 3, 1);
    const quarterEnd = new Date(currentDate.getFullYear(), quarter * 3 + 3, 0);
    return {
      start: quarterStart.toISOString().split('T')[0],
      end: quarterEnd.toISOString().split('T')[0]
    };
  } else if (viewMode === 'semi-yearly') {
    const half = currentDate.getMonth() < 6 ? 0 : 1;
    const halfStart = new Date(currentDate.getFullYear(), half * 6, 1);
    const halfEnd = new Date(currentDate.getFullYear(), half * 6 + 6, 0);
    return {
      start: halfStart.toISOString().split('T')[0],
      end: halfEnd.toISOString().split('T')[0]
    };
  } else if (viewMode === 'yearly') {
    const yearStart = new Date(currentDate.getFullYear(), 0, 1);
    const yearEnd = new Date(currentDate.getFullYear(), 11, 31);
    return {
      start: yearStart.toISOString().split('T')[0],
      end: yearEnd.toISOString().split('T')[0]
    };
  } else {
    return {
      start: selectedDate,
      end: selectedDate
    };
  }
};
