/**
 * Time Management Types
 * Shared type definitions for time management services and repositories
 */

// ============================================================================
// Service Response Types
// ============================================================================

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: ErrorCode;
  details?: any; // Only populated in development mode
  cached?: boolean; // Indicates if response came from cache
}

export type ErrorCode =
  | 'VALIDATION_ERROR'    // 400 - Invalid input
  | 'UNAUTHORIZED'        // 401 - Not authenticated
  | 'PERMISSION_DENIED'   // 403 - Authenticated but forbidden
  | 'NOT_FOUND'           // 404 - Resource doesn't exist
  | 'CONFLICT'            // 409 - Duplicate/conflict
  | 'DATABASE_ERROR'      // 500 - DB operation failed
  | 'INTERNAL_ERROR'      // 500 - Unexpected error
  | 'TIMEOUT_ERROR';      // 408 - Request timeout

// ============================================================================
// Analytics Types
// ============================================================================

export interface WeeklySummaryData {
  user_id: number;
  first_name: string;
  last_name: string;
  total_hours: number;
  overtime_hours: number;
  days_worked: number;
  late_days: number;
  edited_entries: number;
}

export interface AnalyticsOverviewData {
  totalEmployees: number;
  totalHours: number;
  overtimeHours: number;
  averageHoursPerEmployee: number;
  onTimePercentage: number;
  attendanceRate: number;
  editRequestsCount: number;
  topPerformers: TopPerformer[];
}

export interface TopPerformer {
  user_id: number;
  first_name: string;
  last_name: string;
  total_hours: number;
}

export interface UserAnalyticsData {
  totalHours: number;
  overtimeHours: number;
  daysWorked: number;
  weekendsWorked: number;
  lateEntries: number;
}

export interface MissingEntryData {
  user_id: number;
  first_name: string;
  last_name: string;
  missing_date: string;
  day_of_week: string;
  expected_start: string;
  expected_end: string;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

export interface AnalyticsFilters {
  group?: string;      // 'all' | 'Group A' | 'Group B' | userId
  users?: string;      // Comma-separated user IDs (legacy support)
}

// ============================================================================
// Repository Data Types
// ============================================================================

export interface UserWithSchedule {
  user_id: number;
  first_name: string;
  last_name: string;
  hire_date: string | null;
  day_of_week: string | null;
  is_work_day: number | null;
  expected_start_time: string | null;
  expected_end_time: string | null;
  existing_dates: string | null; // Comma-separated dates
}

export interface Holiday {
  holiday_id: number;
  holiday_name: string;
  holiday_date: Date | string;
  is_active: number;
}

export interface VacationPeriod {
  vacation_id: number;
  user_id: number;
  start_date: Date | string;
  end_date: Date | string;
}

export interface ScheduleInfo {
  is_work_day: boolean;
  expected_start_time: string;
  expected_end_time: string | null;
}

export interface UserScheduleMap {
  user_id: number;
  first_name: string;
  last_name: string;
  hire_date: string | null;
  schedules: Map<string, ScheduleInfo>;
  existingDates: Set<string>;
}

// ============================================================================
// Cache Configuration
// ============================================================================

export interface CacheConfig {
  ttl: number;          // Time to live in milliseconds
  enabled: boolean;
}

export interface CacheEntry<T> {
  data: T;
  expiry: number;       // Timestamp when cache expires
}

// Default cache TTLs (in milliseconds)
export const CACHE_TTL = {
  WEEKLY_SUMMARY: 2 * 60 * 1000,      // 2 minutes
  ANALYTICS_OVERVIEW: 5 * 60 * 1000,  // 5 minutes
  USER_ANALYTICS: 5 * 60 * 1000,      // 5 minutes
  MISSING_ENTRIES: 10 * 60 * 1000,    // 10 minutes
  USERS: 60 * 60 * 1000,              // 1 hour
  HOLIDAYS: 60 * 60 * 1000,           // 1 hour
} as const;

// ============================================================================
// Service Options
// ============================================================================

export interface ServiceOptions {
  validatePermissions?: boolean;  // Default: true
  useCache?: boolean;             // Default: true
  timeout?: number;               // Request timeout in ms
}

// ============================================================================
// Time Entries Types (Iteration 2)
// ============================================================================

export interface TimeEntry {
  entry_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  total_hours: number;
  status: 'active' | 'completed';
  is_edited: number;
}

export interface TimeEntryFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  users?: string;       // Comma-separated user IDs
  group?: string;       // 'all' | 'Group A' | 'Group B' | userId
  search?: string;      // Name search
  quickFilter?: string; // 'late' | 'overtime' | 'edited' | 'missing'
}

export interface TimeEntryCreateData {
  user_id: number;
  clock_in: string;
  clock_out?: string;
  break_minutes?: number;
  status?: 'active' | 'completed';
  notes?: string;
}

export interface TimeEntryUpdateData {
  clock_in?: string;
  clock_out?: string;
  break_minutes?: number;
}

export interface SimpleUser {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

// ============================================================================
// Work Schedules & Holidays Types (Iteration 3)
// ============================================================================

export interface WorkSchedule {
  schedule_id: number;
  user_id: number;
  day_of_week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  is_work_day: number;
  expected_start_time: string | null;
  expected_end_time: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WorkScheduleUpdateData {
  day_of_week: string;
  is_work_day: number;
  expected_start_time: string | null;
  expected_end_time: string | null;
}

export interface HolidayData {
  holiday_id: number;
  holiday_name: string;
  holiday_date: string | Date;
  is_active: number;
  created_at?: string;
  updated_at?: string;
}

export interface HolidayCreateData {
  holiday_name: string;
  holiday_date: string;
  overwrite?: boolean;
}

export interface HolidayImportData {
  name: string;
  date: string;
}

export interface HolidayConflict {
  name: string;
  date: string;
  existing: HolidayData;
}

export interface HolidayImportResult {
  message: string;
  imported_count: number;
}

export interface CSVImportRequest {
  csvData: string;
  overwriteAll?: boolean;
}
