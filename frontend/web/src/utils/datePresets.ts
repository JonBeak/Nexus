// Date preset utilities for quick date range selection
// Provides common date ranges like "This Week", "Last Month", etc.

export interface DatePreset {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  description?: string;
}

// Get date string in YYYY-MM-DD format
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get start of week (Saturday)
const getStartOfWeek = (date: Date): Date => {
  const result = new Date(date);
  const dayOfWeek = result.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Calculate days back to Saturday
  let daysBack;
  if (dayOfWeek === 6) {
    daysBack = 0; // Today is Saturday
  } else if (dayOfWeek === 0) {
    daysBack = 1; // Today is Sunday, go back 1 day
  } else {
    daysBack = dayOfWeek + 1; // Monday=2, Tuesday=3, etc.
  }
  
  result.setDate(result.getDate() - daysBack);
  return result;
};

// Get end of week (Friday)
const getEndOfWeek = (date: Date): Date => {
  const startOfWeek = getStartOfWeek(date);
  const result = new Date(startOfWeek);
  result.setDate(result.getDate() + 6); // Saturday + 6 days = Friday
  return result;
};

// Get start of month
const getStartOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

// Get end of month
const getEndOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

// Get start of year
const getStartOfYear = (date: Date): Date => {
  return new Date(date.getFullYear(), 0, 1);
};

// Get end of year
const getEndOfYear = (date: Date): Date => {
  return new Date(date.getFullYear(), 11, 31);
};

// Generate date presets based on current date
export const generateDatePresets = (): DatePreset[] => {
  const now = new Date();
  const today = formatDate(now);
  
  // This week
  const thisWeekStart = getStartOfWeek(now);
  const thisWeekEnd = getEndOfWeek(now);
  
  // Last week
  const lastWeekDate = new Date(now);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekStart = getStartOfWeek(lastWeekDate);
  const lastWeekEnd = getEndOfWeek(lastWeekDate);
  
  // This month
  const thisMonthStart = getStartOfMonth(now);
  const thisMonthEnd = getEndOfMonth(now);
  
  // Last month
  const lastMonthDate = new Date(now);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthStart = getStartOfMonth(lastMonthDate);
  const lastMonthEnd = getEndOfMonth(lastMonthDate);
  
  // This year
  const thisYearStart = getStartOfYear(now);
  const thisYearEnd = getEndOfYear(now);
  
  // Last year
  const lastYearDate = new Date(now);
  lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
  const lastYearStart = getStartOfYear(lastYearDate);
  const lastYearEnd = getEndOfYear(lastYearDate);
  
  // All time (since 2010)
  const allTimeStart = new Date(2010, 0, 1);
  const allTimeEnd = now;

  return [
    {
      id: 'today',
      label: 'Today',
      startDate: today,
      endDate: today,
      description: 'Current day only'
    },
    {
      id: 'this-week',
      label: 'This Week',
      startDate: formatDate(thisWeekStart),
      endDate: formatDate(thisWeekEnd),
      description: 'Saturday to Friday of current week'
    },
    {
      id: 'this-month',
      label: 'This Month',
      startDate: formatDate(thisMonthStart),
      endDate: formatDate(thisMonthEnd),
      description: 'Current month'
    },
    {
      id: 'this-year',
      label: 'This Year',
      startDate: formatDate(thisYearStart),
      endDate: formatDate(thisYearEnd),
      description: 'Current year'
    },
    {
      id: 'last-week',
      label: 'Last Week',
      startDate: formatDate(lastWeekStart),
      endDate: formatDate(lastWeekEnd),
      description: 'Previous week (Saturday to Friday)'
    },
    {
      id: 'last-month',
      label: 'Last Month',
      startDate: formatDate(lastMonthStart),
      endDate: formatDate(lastMonthEnd),
      description: 'Previous month'
    },
    {
      id: 'last-year',
      label: 'Last Year',
      startDate: formatDate(lastYearStart),
      endDate: formatDate(lastYearEnd),
      description: 'Previous year'
    },
    {
      id: 'all',
      label: 'All Time',
      startDate: formatDate(allTimeStart),
      endDate: formatDate(allTimeEnd),
      description: 'All available data (since 2010)'
    }
  ];
};

// Get a specific preset by ID
export const getDatePreset = (id: string): DatePreset | undefined => {
  const presets = generateDatePresets();
  return presets.find(preset => preset.id === id);
};

// Check if current date range matches a preset
export const getCurrentPreset = (startDate: string, endDate: string): DatePreset | undefined => {
  const presets = generateDatePresets();
  return presets.find(preset => 
    preset.startDate === startDate && preset.endDate === endDate
  );
};

// Get preset options for dropdown
export const getPresetOptions = () => {
  return generateDatePresets().map(preset => ({
    value: preset.id,
    label: preset.label,
    description: preset.description
  }));
};

export default {
  generateDatePresets,
  getDatePreset,
  getCurrentPreset,
  getPresetOptions
};