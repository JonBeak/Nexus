/**
 * Utility functions for formatting order field values
 */

/**
 * Formats a date string to a readable format
 */
export const formatDateString = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';

  try {
    const [year, month, day] = dateString.split('T')[0].split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
};

/**
 * Formats a time string to 12-hour format
 */
export const formatTimeTo12Hour = (timeString: string | null | undefined): string => {
  if (!timeString) return '-';

  try {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return '-';
  }
};

/**
 * Extracts HH:mm from HH:mm:ss format
 */
export const extractTimeValue = (timeString: string): string => {
  if (!timeString) return '';
  return timeString.substring(0, 5);
};

/**
 * Transforms a value for API submission based on field type
 */
export const transformFieldValue = (field: string, value: any, type?: string): any => {
  // Handle checkbox fields
  if (type === 'checkbox') {
    return value === 'true' || value === true;
  }

  // Handle select fields for shipping_required
  if (field === 'shipping_required') {
    return value === 'true';
  }

  // Handle time fields (add seconds)
  if (type === 'time' && value) {
    return `${value.trim()}:00`;
  }

  // Return as-is for other fields
  return value;
};