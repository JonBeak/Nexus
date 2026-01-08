/**
 * Task Sessions Type Definitions
 * Created: 2025-01-07
 * Purpose: Types for multi-session task tracking system
 */

import { ProductionRole } from './orders';

// =============================================
// TASK SESSION TYPES
// =============================================

export interface TaskSession {
  session_id: number;
  task_id: number;
  user_id: number;
  user_name?: string;        // Joined from users table
  user_first_name?: string;  // For display
  user_last_name?: string;   // For display
  started_at: Date;
  ended_at: Date | null;     // NULL = currently active
  duration_minutes: number | null;  // Generated column, NULL if active
  notes: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateSessionData {
  task_id: number;
  user_id: number;
  notes?: string;
}

export interface UpdateSessionData {
  started_at?: Date;
  ended_at?: Date | null;
  notes?: string | null;
}

// =============================================
// STAFF TASK TYPES (sanitized for staff view)
// =============================================

export interface StaffTask {
  task_id: number;
  task_name: string;
  order_id: number;
  order_number: string;
  order_name: string;           // Sanitized - no customer info
  part_id: number | null;
  part_description: string;     // Product type description
  product_type: string | null;
  specifications: Record<string, any> | null;  // Part specs for work reference
  due_date: Date | null;
  hard_due_date_time: string | null;
  assigned_role: ProductionRole | null;
  completed: boolean;
  completed_at: Date | null;
  notes: string | null;         // Task notes (not internal order notes)
  sort_order: number | null;

  // Session aggregates
  active_sessions_count: number;
  total_time_minutes: number;
  my_active_session: TaskSession | null;  // Current user's active session if any
}

// =============================================
// ACTIVE TASKS RESPONSE (Multiple concurrent tasks)
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

// Legacy single-task response (deprecated, kept for compatibility)
export interface ActiveTaskResponse {
  has_active_task: boolean;
  task: StaffTask | null;
  session: TaskSession | null;
  elapsed_minutes: number | null;
}

// =============================================
// SESSION MANAGEMENT RESPONSES
// =============================================

export interface StartSessionResponse {
  session_id: number;
  task_id: number;
  message: string;
}

export interface StopSessionResponse {
  session_id: number;
  task_id: number;
  duration_minutes: number;
  message: string;
}

export interface CompleteTaskResponse {
  task_id: number;
  sessions_closed: number;  // How many sessions were auto-ended
  message: string;
}

// =============================================
// BATCH OPERATIONS
// =============================================

export interface SessionUpdate {
  session_id: number;
  started_at?: Date;
  ended_at?: Date | null;
  notes?: string | null;
}

// =============================================
// USER ACTIVE TASK STATE (Deprecated - columns removed)
// Active sessions are now queried directly from task_sessions table
// =============================================

// =============================================
// TASK QUERY FILTERS
// =============================================

export interface StaffTaskFilters {
  include_completed?: boolean;
  hours_back?: number;         // Filter tasks from orders due within X hours
  assigned_role?: ProductionRole;
  search?: string;             // Search task name, order number
}

// =============================================
// SESSION HISTORY FOR MODAL
// =============================================

export interface TaskSessionHistory {
  task_id: number;
  task_name: string;
  order_number: string;
  sessions: TaskSession[];
  total_time_minutes: number;
  active_sessions_count: number;
  can_edit_all: boolean;       // True if user is manager
}
