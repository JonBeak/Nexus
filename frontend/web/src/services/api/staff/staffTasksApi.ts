/**
 * Staff Tasks API
 * API client for staff task and session operations
 *
 * Created: 2025-01-07
 */

import { api } from '../../apiClient';
import {
  StaffTask,
  ActiveTasksResponse,
  StartSessionResponse,
  StopSessionResponse,
  CompleteTaskResponse,
  TaskSessionHistory,
  StaffTaskFilters,
  SessionUpdate
} from './types';

/**
 * Staff Tasks API
 * Handles task viewing and session operations for staff users
 */
export const staffTasksApi = {
  /**
   * Get tasks assigned to user's production roles
   * Note: apiClient interceptor auto-unwraps { success, data } to just data
   */
  getTasks: async (filters: StaffTaskFilters = {}): Promise<{
    tasks: StaffTask[];
    user_roles: string[];
  }> => {
    const params: Record<string, string> = {};

    if (filters.include_completed) {
      params.include_completed = 'true';
    }
    if (filters.hours_back) {
      params.hours_back = filters.hours_back.toString();
    }
    if (filters.search) {
      params.search = filters.search;
    }

    const response = await api.get('/staff/tasks', { params });
    // Backend returns { success, data: { tasks, user_roles } }
    // Interceptor unwraps to { tasks, user_roles }
    const data = response.data as { tasks: StaffTask[]; user_roles: string[] };
    return {
      tasks: data.tasks || [],
      user_roles: data.user_roles || []
    };
  },

  /**
   * Get user's currently active tasks and sessions (multiple concurrent tasks supported)
   * Note: apiClient interceptor auto-unwraps { success, data } to just data
   */
  getActiveTasks: async (): Promise<ActiveTasksResponse> => {
    const response = await api.get('/staff/tasks/active');
    return response.data as ActiveTasksResponse;
  },

  /**
   * Start working on a task (create session)
   */
  startTask: async (taskId: number): Promise<StartSessionResponse> => {
    const response = await api.post(`/staff/tasks/${taskId}/start`);
    return response.data as StartSessionResponse;
  },

  /**
   * Stop working on a specific task (end session)
   */
  stopTask: async (taskId: number): Promise<StopSessionResponse> => {
    const response = await api.post(`/staff/tasks/${taskId}/stop`);
    return response.data as StopSessionResponse;
  },

  /**
   * Complete a task (ends all sessions, marks done)
   */
  completeTask: async (taskId: number): Promise<CompleteTaskResponse> => {
    const response = await api.post(`/staff/tasks/${taskId}/complete`);
    return response.data as CompleteTaskResponse;
  },

  /**
   * Uncomplete a task (reopen it)
   */
  uncompleteTask: async (taskId: number): Promise<{ task_id: number; message: string }> => {
    const response = await api.post(`/staff/tasks/${taskId}/uncomplete`);
    return response.data as { task_id: number; message: string };
  },

  /**
   * Get session history for a task
   * Staff sees own sessions, managers see all
   */
  getTaskSessions: async (taskId: number): Promise<TaskSessionHistory> => {
    const response = await api.get(`/staff/tasks/${taskId}/sessions`);
    return response.data as TaskSessionHistory;
  },

  /**
   * Update a session (staff: notes only, managers: times + notes)
   */
  updateSession: async (sessionId: number, updates: SessionUpdate): Promise<void> => {
    await api.put(`/staff/sessions/${sessionId}`, updates);
  },

  /**
   * Delete a session (manager only)
   */
  deleteSession: async (sessionId: number): Promise<void> => {
    await api.delete(`/staff/sessions/${sessionId}`);
  }
};
