/**
 * Staff Tasks Types
 * Frontend type definitions for staff task and session operations
 *
 * Created: 2025-01-07
 */

// =============================================
// TASK SESSION TYPES
// =============================================

export interface TaskSession {
  session_id: number;
  task_id: number;
  user_id: number;
  user_name?: string;
  user_first_name?: string;
  user_last_name?: string;
  started_at: string;        // ISO date string
  ended_at: string | null;   // NULL = currently active
  duration_minutes: number | null;
  effective_duration_minutes: number | null;  // Proportional duration accounting for concurrent sessions
  notes: string | null;
}

// =============================================
// STAFF TASK TYPES
// =============================================

export interface StaffTask {
  task_id: number;
  task_name: string;
  order_id: number;
  order_number: string;
  order_name: string;
  part_id: number | null;
  part_description: string;
  product_type: string | null;
  specifications: Record<string, any> | null;
  due_date: string | null;
  hard_due_date_time: string | null;
  assigned_role: string | null;
  completed: boolean;
  completed_at: string | null;
  notes: string | null;
  sort_order: number | null;

  // Session aggregates
  active_sessions_count: number;
  total_sessions_count: number;
  total_time_minutes: number;
  my_active_session: TaskSession | null;

  // Notes aggregates
  notes_count: number;
  latest_note: string | null;
}

// =============================================
// RESPONSE TYPES
// =============================================

export interface ActiveTaskInfo {
  task: StaffTask;
  session: TaskSession;
  elapsed_minutes: number;
}

export interface ActiveTasksResponse {
  has_active_tasks: boolean;
  count: number;
  active_tasks: ActiveTaskInfo[];
}

// Legacy single-task response (deprecated)
export interface ActiveTaskResponse {
  has_active_task: boolean;
  task: StaffTask | null;
  session: TaskSession | null;
  elapsed_minutes: number | null;
}

export interface StartSessionResponse {
  session_id: number;
  task_id: number;
  message: string;
}

export interface StopSessionResponse {
  session_id: number;
  task_id: number;
  duration_minutes: number;
  effective_duration_minutes?: number;  // Proportional duration if calculated
  message: string;
}

export interface CompleteTaskResponse {
  task_id: number;
  sessions_closed: number;
  message: string;
}

export interface TaskSessionHistory {
  task_id: number;
  task_name: string;
  order_number: string;
  sessions: TaskSession[];
  total_time_minutes: number;
  active_sessions_count: number;
  can_edit_all: boolean;
}

// Session with task/order info for display
export interface CompletedSessionDisplay {
  session_id: number;
  task_id: number;
  user_id: number;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  effective_duration_minutes: number | null;  // Proportional duration
  notes: string | null;
  task_name: string;
  order_id: number;
  order_number: string;
  order_name: string;
  // Pending edit request indicator
  has_pending_request?: number;
  pending_request_type?: 'edit' | 'delete' | null;
}

export interface TodaySessionsResponse {
  sessions: CompletedSessionDisplay[];
  total_time_minutes: number;
}

// =============================================
// FILTER TYPES
// =============================================

export interface StaffTaskFilters {
  include_completed?: boolean;
  hours_back?: number;
  search?: string;
}

// =============================================
// UPDATE TYPES
// =============================================

export interface SessionUpdate {
  started_at?: string;
  ended_at?: string | null;
  notes?: string | null;
}

// =============================================
// SESSION NOTES TYPES
// =============================================

export interface SessionNote {
  note_id: number;
  session_id: number;
  user_id: number;
  user_name?: string;
  user_first_name?: string;
  user_last_name?: string;
  note_text: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteResponse {
  note_id: number;
  message: string;
}
