// File Clean up Finished: 2025-11-15
// Consolidated from TimeManagementTypes.ts (282 lines) and TimeTrackingTypes.ts (207 lines)
// Total: 489 lines → 475 lines (14 lines saved)
// Changes:
// - Merged two type files into single organized file
// - Resolved TimeEntry conflict: TimeEntryDB (database) vs TimeEntryDTO (display)
// - Organized into 8 logical sections for maintainability
// - Fixed WeeklySummaryEntry to explicitly extend TimeEntryDB
// - Preserved both response patterns (ServiceResponse for TimeManagement, ApiResponse for TimeTracking)

/**
 * Time Management & Tracking Types
 * Consolidated type definitions for all time-related features
 *
 * SECTIONS:
 * 1. Service Response Types - Response wrappers for service layer
 * 2. Database Entity Types - Full entity types extending RowDataPacket (Repository layer)
 * 3. DTO & Request/Response Types - Transfer objects for API communication (Service layer)
 * 4. Scheduling & Holiday Management - Work schedules, holidays, breaks
 * 5. Analytics & Reporting Types - Time analytics, summaries, reports
 * 6. Filter Types - Query filters for time entries and analytics
 * 7. Cache & Service Configuration - Service options, caching infrastructure
 * 8. Utility Types - Calculation results, helper types
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ============================================================================
// 1. SERVICE RESPONSE TYPES
// ============================================================================
// NOTE: Two patterns intentionally maintained for domain separation:
// - TimeManagement services use ServiceResponse<T> with ErrorCode enum
// - TimeTracking services use ApiResponse<T> (SuccessResponse | ErrorResponse)

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

export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error?: string;
  message?: string;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// ============================================================================
// 2. DATABASE ENTITY TYPES (Repository Layer)
// ============================================================================
// All types extending RowDataPacket - used by repositories for database operations

/**
 * TimeEntryDB - Database model for time_entries table
 * Full entity type with all database columns
 * Used by: TimeEntryRepository for database operations
 */
export interface TimeEntryDB extends RowDataPacket {
  entry_id: number;
  user_id: number;
  clock_in: string; // datetime string
  clock_out?: string; // datetime string
  break_minutes: number;
  auto_break_minutes: number;
  total_hours: number;
  status: 'active' | 'completed';
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  applied_breaks?: string; // JSON array of break_ids
  break_adjustment_notes?: string;
  notes?: string;
  payroll_clock_in?: string; // time string
  payroll_clock_out?: string; // time string
  payroll_break_minutes?: number;
  payroll_total_hours?: number;
  payroll_adjusted: boolean;
  is_overtime: boolean;
  is_holiday: boolean;
}

export interface TimeEditRequest extends RowDataPacket {
  request_id: number;
  entry_id: number;
  user_id: number;
  requested_clock_in?: string; // datetime string
  requested_clock_out?: string; // datetime string
  requested_break_minutes?: number;
  reason?: string;
  request_type: 'edit' | 'delete';
  status: 'pending' | 'approved' | 'rejected' | 'modified' | 'cancelled';
  reviewed_by?: number;
  reviewed_at?: string; // datetime string
  reviewer_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PendingEditRequest extends TimeEditRequest {
  original_clock_in: string;
  original_clock_out?: string;
  original_break_minutes: number;
  first_name: string;
  last_name: string;
  username: string;
}

export interface ScheduledBreak extends RowDataPacket {
  break_id: number;
  break_name: string;
  start_time: string; // time string
  end_time: string; // time string
  duration_minutes: number;
  days_of_week: string; // SET field
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: number;
}

export interface TimeEditNotification extends RowDataPacket {
  notification_id: number;
  user_id: number;
  request_id: number;
  action: string;
  reviewer_notes?: string;
  reviewer_name?: string;
  is_read: boolean;
  is_cleared: boolean;
  created_at: string;
}

export interface NotificationWithDetails extends TimeEditNotification {
  entry_id: number;
  original_clock_in: string;
  original_clock_out?: string;
}

export interface WeeklySummaryEntry extends TimeEntryDB {
  request_id?: number;
  request_status?: string;
  requested_clock_in?: string;
  requested_clock_out?: string;
  requested_break_minutes?: number;
  reason?: string;
}

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

// ============================================================================
// 3. DTO & REQUEST/RESPONSE TYPES (Service Layer)
// ============================================================================
// Transfer objects for API communication

/**
 * TimeEntryDTO - Display model for time entries with user information
 * Simplified type used for list displays and filtering
 * Used by: TimeEntriesService, time management UI
 */
export interface TimeEntryDTO {
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

export interface TimeEntryData {
  user_id: number;
  clock_in: string;
  clock_out?: string;
  break_minutes?: number;
  auto_break_minutes?: number;
  total_hours?: number;
  status?: 'active' | 'completed';
  applied_breaks?: string; // JSON string
  break_adjustment_notes?: string | null;
  notes?: string;
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

export interface EditRequestData {
  entry_id: number;
  user_id: number;
  requested_clock_in?: string;
  requested_clock_out?: string;
  requested_break_minutes?: number;
  reason?: string;
  request_type?: 'edit' | 'delete';
}

export interface NotificationData {
  user_id: number;
  request_id: number;
  action: string;
  reviewer_notes?: string;
  reviewer_name?: string;
}

export interface EditRequestBody {
  entry_id: number;
  requested_clock_in: string;
  requested_clock_out: string;
  requested_break_minutes: number;
  reason: string;
}

export interface DeleteRequestBody {
  entry_id: number;
  reason: string;
}

export interface ProcessRequestBody {
  request_id: number;
  action: 'approve' | 'reject' | 'modify';
  modified_clock_in?: string;
  modified_clock_out?: string;
  modified_break_minutes?: number;
  reviewer_notes?: string;
}

export interface ClockInResponse {
  message: string;
  entry_id: number;
}

export interface ClockOutResponse {
  message: string;
  totalHours: number;
  breakMinutes: number;
  notes?: string;
}

export interface WeeklySummaryResponse {
  weekStart: string; // ISO string
  weekEnd: string; // ISO string
  entries: WeeklySummaryEntry[];
  weekTotal: number;
}

export interface SimpleUser {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  show_in_time_calendar: boolean;
}

// ============================================================================
// 4. SCHEDULING & HOLIDAY MANAGEMENT
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

export interface BreakScheduleUpdateBody {
  start_time: string;
  end_time: string;
  duration_minutes: number;
  days_of_week: string;
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
// 5. ANALYTICS & REPORTING TYPES
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
// 6. FILTER TYPES
// ============================================================================

export interface TimeEntryFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  users?: string;       // Comma-separated user IDs
  group?: string;       // 'all' | 'Group A' | 'Group B' | userId
  search?: string;      // Name search
  quickFilter?: string; // 'late' | 'overtime' | 'edited' | 'missing'
}

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

export interface AnalyticsFilters {
  group?: string;      // 'all' | 'Group A' | 'Group B' | userId
}

// ============================================================================
// 7. CACHE & SERVICE CONFIGURATION
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

export interface ServiceOptions {
  useCache?: boolean;             // Default: true
  timeout?: number;               // Request timeout in ms
}

// ============================================================================
// 8. UTILITY TYPES
// ============================================================================

export interface BreakCalculationResult {
  minutes: number;
  appliedBreaks: number[];
  notes: string;
}

export interface ClockStatusResponse {
  isClocked: boolean;
  currentEntry: TimeEntryDB | null;
}
