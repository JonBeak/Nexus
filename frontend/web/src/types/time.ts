/**
 * Time Management Type Definitions
 * Extracted from TimeManagement.tsx for reusability across components
 */

import type { UserRole } from './user';

export interface TimeUser {
  user_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  user_group?: string;
}

export type AuthenticatedRequest = (url: string, options?: RequestInit) => Promise<Response>;

// Core data interfaces
export interface TimeEntry {
  entry_id: number;
  user_id: number;
  first_name?: string;
  last_name?: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  total_hours: number;
  status: 'active' | 'completed';
  is_edited?: boolean;
  has_multiple_entries?: boolean;
}

export interface WeeklySummary {
  user_id: number;
  first_name: string;
  last_name: string;
  total_hours: number;
  overtime_hours: number;
  days_worked: number;
  late_days: number;
  edited_entries: number;
  period_start?: string;
  period_end?: string;
}

export interface AnalyticsData {
  totalEmployees: number;
  totalHours: number;
  overtimeHours: number;
  averageHoursPerEmployee: number;
  onTimePercentage: number;
  attendanceRate: number;
  editRequestsCount: number;
  topPerformers: Array<{
    user_id: number;
    first_name: string;
    last_name: string;
    total_hours: number;
  }>;
}

export interface MissingEntry {
  user_id: number;
  first_name: string;
  last_name: string;
  missing_date: string;
  day_of_week: string;
  expected_start: string;
  expected_end: string;
}

// Type definitions
export type ViewMode = 'calendar' | 'single' | 'summary' | 'analytics' | 'missing';
export type FilterStatus = 'all' | 'active' | 'completed';
export type DateRange = 'single' | 'range';

// Component props interfaces
export interface FilterState {
  selectedDate: string;
  endDate: string;
  dateRange: DateRange;
  selectedGroup: string;
  filterStatus: FilterStatus;
  searchTerm: string;
}

export interface TimeFilterProps {
  filters: FilterState;
  users: TimeUser[];
  viewMode: ViewMode;
  onFiltersChange: (filters: FilterState) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export interface TimeDataProps {
  timeEntries: TimeEntry[];
  weeklySummary: WeeklySummary[];
  analyticsData: AnalyticsData | null;
  missingEntries: MissingEntry[];
  loading: boolean;
}

// API parameter interfaces
export interface TimeFilterParams {
  startDate: string;
  endDate?: string;
  status: FilterStatus;
  group: string;
  search: string;
}

export interface PeriodParams extends TimeFilterParams {
  period: ViewMode;
}

export interface AnalyticsParams extends TimeFilterParams {
  // Analytics-specific parameters can be added here
}

export interface MissingEntriesParams {
  startDate: string;
  endDate?: string;
  group: string;
}

// CRUD operation interfaces
export interface CreateEntryData {
  user_id: number;
  clock_in: string;
  clock_out: string;
  break_minutes: number;
  date: string;
}

export interface UpdateEntryData {
  clock_in?: string;
  clock_out?: string;
  break_minutes?: number;
}

export interface BulkEditData {
  entry_ids: number[];
  clock_in?: string;
  clock_out?: string;
  break_minutes?: number;
}

export interface ExcusedData {
  user_id: number;
  missing_date: string;
  reason?: string;
}

export interface ExportParams extends TimeFilterParams {
  format: 'csv' | 'pdf';
  viewMode: ViewMode;
}

// Edit values interface for inline editing
export interface EditValues {
  clock_in: string;
  clock_out: string;
  break_minutes: number;
}

// Bulk edit modal state
export interface BulkEditValues {
  clock_in?: string;
  clock_out?: string;
  break_minutes?: number;
}

export interface WeeklyEntry {
  entry_id: number;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  total_hours: number;
  status: string;
  request_id: number | null;
}

export interface WeeklyData {
  weekStart: string;
  weekEnd: string;
  weekTotal: number;
  entries: WeeklyEntry[];
}

export interface ClockStatus {
  isClocked: boolean;
  currentEntry?: {
    clock_in: string;
    entry_id: number;
  } | null;
}

export interface TimeNotification {
  notification_id: number;
  action: string;
  reviewer_name: string;
  reviewer_notes?: string;
  created_at: string;
  is_read: boolean;
  is_cleared: boolean;
}

export interface TimeEditRequest {
  request_id: number;
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  request_type: 'edit' | 'delete';
  original_clock_in: string;
  original_clock_out: string | null;
  original_break_minutes: number;
  requested_clock_in: string;
  requested_clock_out: string | null;
  requested_break_minutes: number;
  reason: string;
  reviewer_notes?: string;
}

export interface EditRequestDraft {
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  reason: string;
}

export interface DeleteRequestDraft {
  reason: string;
}
