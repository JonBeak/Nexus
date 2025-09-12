import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Core Time Entry Interfaces
export interface TimeEntry extends RowDataPacket {
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

// Time Edit Request Interfaces
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

// Extended interface for pending requests with join data
export interface PendingEditRequest extends TimeEditRequest {
  original_clock_in: string;
  original_clock_out?: string;
  original_break_minutes: number;
  first_name: string;
  last_name: string;
  username: string;
}

// Scheduled Break Interfaces
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

// Time Edit Notification Interfaces
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

// Extended interface for notifications with join data
export interface NotificationWithDetails extends TimeEditNotification {
  entry_id: number;
  original_clock_in: string;
  original_clock_out?: string;
}

// Break Calculation Result
export interface BreakCalculationResult {
  minutes: number;
  appliedBreaks: number[];
  notes: string;
}

// Clock Status Response
export interface ClockStatusResponse {
  isClocked: boolean;
  currentEntry: TimeEntry | null;
}

// Weekly Summary Interfaces
export interface WeeklySummaryEntry extends TimeEntry {
  request_id?: number;
  request_status?: string;
  requested_clock_in?: string;
  requested_clock_out?: string;
  requested_break_minutes?: number;
  reason?: string;
}

export interface WeeklySummaryResponse {
  weekStart: string; // ISO string
  weekEnd: string; // ISO string
  entries: WeeklySummaryEntry[];
  weekTotal: number;
}

// Request/Response Body Interfaces
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

export interface BreakScheduleUpdateBody {
  start_time: string;
  end_time: string;
  duration_minutes: number;
  days_of_week: string;
}

// Repository Data Interfaces
export interface TimeEntryData {
  user_id: number;
  clock_in: string;
  clock_out?: string;
  break_minutes?: number;
  auto_break_minutes?: number;
  total_hours?: number;
  status?: 'active' | 'completed';
  applied_breaks?: string; // JSON string
  break_adjustment_notes?: string;
  notes?: string;
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

// Standard API Response Interfaces
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