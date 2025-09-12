/**
 * Time Management Type Definitions
 * Extracted from TimeManagement.tsx for reusability across components
 */

import { User } from './index';

// Core data interfaces
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
  is_edited: boolean;
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
export type ViewMode = 'calendar' | 'single' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'semi-yearly' | 'yearly' | 'analytics' | 'missing';
export type FilterStatus = 'all' | 'active' | 'completed';
export type DateRange = 'single' | 'range';

// Component props interfaces
export interface TimeManagementProps {
  user: User;
}

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
  users: User[];
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