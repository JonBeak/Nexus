// Centralized validation utility functions
// For time management input validation and business rules

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Time entry validation
export const validateTimeEntry = (entry: {
  clock_in: string;
  clock_out: string;
  break_minutes: number;
}): ValidationResult => {
  const errors: ValidationError[] = [];

  // Validate clock in
  if (!entry.clock_in) {
    errors.push({ field: 'clock_in', message: 'Clock in time is required' });
  }

  // Validate clock out
  if (!entry.clock_out) {
    errors.push({ field: 'clock_out', message: 'Clock out time is required' });
  }

  // Validate break minutes
  if (entry.break_minutes < 0) {
    errors.push({ field: 'break_minutes', message: 'Break minutes cannot be negative' });
  }
  if (entry.break_minutes > 480) {
    errors.push({ field: 'break_minutes', message: 'Break minutes cannot exceed 8 hours (480 minutes)' });
  }

  // If both times are provided, validate the time sequence
  if (entry.clock_in && entry.clock_out) {
    const clockIn = new Date(entry.clock_in);
    const clockOut = new Date(entry.clock_out);

    if (clockOut <= clockIn) {
      errors.push({ field: 'clock_out', message: 'Clock out time must be after clock in time' });
    }

    // Check for reasonable work duration (not more than 24 hours)
    const diffHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    if (diffHours > 24) {
      errors.push({ field: 'clock_out', message: 'Work duration cannot exceed 24 hours' });
    }

    // Check if break minutes exceed total work time
    const workMinutes = diffHours * 60;
    if (entry.break_minutes >= workMinutes) {
      errors.push({ field: 'break_minutes', message: 'Break time cannot exceed total work time' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Date range validation
export const validateDateRange = (startDate: string, endDate: string): ValidationResult => {
  const errors: ValidationError[] = [];

  if (!startDate) {
    errors.push({ field: 'startDate', message: 'Start date is required' });
  }

  if (!endDate) {
    errors.push({ field: 'endDate', message: 'End date is required' });
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      errors.push({ field: 'endDate', message: 'End date must be after start date' });
    }

    // Check for reasonable date range (not more than 1 year)
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 365) {
      errors.push({ field: 'endDate', message: 'Date range cannot exceed 1 year' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Search term validation
export const validateSearchTerm = (searchTerm: string): ValidationResult => {
  const errors: ValidationError[] = [];

  if (searchTerm.length > 100) {
    errors.push({ field: 'searchTerm', message: 'Search term cannot exceed 100 characters' });
  }

  // Check for potentially harmful characters
  if (/<script|javascript:|data:/i.test(searchTerm)) {
    errors.push({ field: 'searchTerm', message: 'Search term contains invalid characters' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Bulk edit validation
export const validateBulkEditValues = (values: {
  clock_in?: string;
  clock_out?: string;
  break_minutes?: number;
}): ValidationResult => {
  const errors: ValidationError[] = [];

  // Validate break minutes if provided
  if (values.break_minutes !== undefined) {
    if (values.break_minutes < 0) {
      errors.push({ field: 'break_minutes', message: 'Break minutes cannot be negative' });
    }
    if (values.break_minutes > 480) {
      errors.push({ field: 'break_minutes', message: 'Break minutes cannot exceed 8 hours (480 minutes)' });
    }
  }

  // If both times are provided, validate the time sequence
  if (values.clock_in && values.clock_out) {
    const clockIn = new Date(values.clock_in);
    const clockOut = new Date(values.clock_out);

    if (clockOut <= clockIn) {
      errors.push({ field: 'clock_out', message: 'Clock out time must be after clock in time' });
    }

    // Check for reasonable work duration
    const diffHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    if (diffHours > 24) {
      errors.push({ field: 'clock_out', message: 'Work duration cannot exceed 24 hours' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// User ID validation
export const validateUserId = (userId: number | string): ValidationResult => {
  const errors: ValidationError[] = [];

  const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  if (isNaN(id) || id <= 0) {
    errors.push({ field: 'userId', message: 'Valid user ID is required' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Export format validation
export const validateExportFormat = (format: string): ValidationResult => {
  const errors: ValidationError[] = [];

  const validFormats = ['csv', 'pdf'];
  if (!validFormats.includes(format.toLowerCase())) {
    errors.push({ field: 'format', message: 'Export format must be CSV or PDF' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Business rule validations
export const businessRules = {
  // Check if entry is late (clock in after 9 AM)
  isLateEntry: (clockIn: string): boolean => {
    const clockInTime = new Date(clockIn);
    const hour = clockInTime.getHours();
    return hour > 9;
  },

  // Check if entry is overtime (>8 hours)
  isOvertimeEntry: (totalHours: number): boolean => {
    return totalHours > 8;
  },

  // Check if entry needs manager approval (>12 hours or unusual times)
  needsManagerApproval: (clockIn: string, clockOut: string): boolean => {
    const clockInTime = new Date(clockIn);
    const clockOutTime = new Date(clockOut);
    
    const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
    
    // More than 12 hours
    if (totalHours > 12) return true;
    
    // Work starting before 5 AM or ending after midnight
    const startHour = clockInTime.getHours();
    const endHour = clockOutTime.getHours();
    
    if (startHour < 5 || (endHour >= 0 && endHour < 6)) return true;
    
    return false;
  },

  // Check if date is a weekend
  isWeekend: (date: string): boolean => {
    const day = new Date(date + 'T12:00:00').getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  },

  // Check if break time is reasonable
  isReasonableBreak: (breakMinutes: number, totalHours: number): boolean => {
    if (breakMinutes === 0) return true; // No break is fine for short shifts
    
    const workMinutes = totalHours * 60;
    const breakRatio = breakMinutes / workMinutes;
    
    // Break should not exceed 20% of work time
    return breakRatio <= 0.2;
  }
};

// Format validation errors for display
export const formatValidationErrors = (errors: ValidationError[]): string => {
  if (errors.length === 0) return '';
  
  if (errors.length === 1) {
    return errors[0].message;
  }
  
  return errors.map((error, index) => `${index + 1}. ${error.message}`).join('\n');
};

// Get first error message for a specific field
export const getFieldError = (errors: ValidationError[], field: string): string | null => {
  const error = errors.find(e => e.field === field);
  return error ? error.message : null;
};

export default {
  validateTimeEntry,
  validateDateRange,
  validateSearchTerm,
  validateBulkEditValues,
  validateUserId,
  validateExportFormat,
  businessRules,
  formatValidationErrors,
  getFieldError
};