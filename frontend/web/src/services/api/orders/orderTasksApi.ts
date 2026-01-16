import { api } from '../../apiClient';

/**
 * Order Tasks API
 * Manages production tasks, progress tracking, and task assignments
 */
export const orderTasksApi = {
  /**
   * Get order progress
   */
  async getOrderProgress(orderNumber: number): Promise<any> {
    const response = await api.get(`/orders/${orderNumber}/progress`);
    // Interceptor already unwraps { success: true, data: T } to just T
    return response.data;
  },

  /**
   * Get order tasks
   */
  async getOrderTasks(orderNumber: number): Promise<any[]> {
    const response = await api.get(`/orders/${orderNumber}/tasks`);
    // Interceptor already unwraps { success: true, data: T } to just T
    return response.data;
  },

  /**
   * Get tasks grouped by part
   */
  async getTasksByPart(orderNumber: number): Promise<any[]> {
    const response = await api.get(`/orders/${orderNumber}/tasks/by-part`);
    // Interceptor already unwraps { success: true, data: T } to just T
    return response.data;
  },

  /**
   * Update task completion
   */
  async updateTaskCompletion(orderNumber: number, taskId: number, completed: boolean): Promise<void> {
    await api.put(`/orders/${orderNumber}/tasks/${taskId}`, { completed });
  },

  /**
   * Get tasks grouped by production role
   */
  async getTasksByRole(includeCompleted: boolean = false, hoursBack: number = 24): Promise<any> {
    const response = await api.get('/orders/tasks/by-role', {
      params: { includeCompleted, hoursBack }
    });
    // Interceptor already unwraps { success: true, data: T } to just T
    return response.data;
  },

  /**
   * Batch update tasks (start/complete) with optional optimistic locking
   * Returns statusUpdates and updatedTasks with new versions
   *
   * If expected_version is provided and doesn't match, throws 409 conflict error
   */
  async batchUpdateTasks(updates: Array<{
    task_id: number;
    started?: boolean;
    completed?: boolean;
    expected_version?: number;  // Optional - for optimistic locking
  }>): Promise<{
    statusUpdates?: Record<number, string>;
    updatedTasks?: Array<{ task_id: number; new_version: number }>;
  }> {
    const response = await api.put('/orders/tasks/batch-update', { updates });
    // Interceptor unwraps { success: true, data: T } to just T
    // So response.data is { statusUpdates: {...}, updatedTasks: [...] }
    console.log('[batchUpdateTasks] Response:', response.data);
    return response.data || {};
  },

  /**
   * Get available task templates
   * Returns list of all distinct tasks in the system grouped by role
   */
  async getTaskTemplates(): Promise<Array<{
    task_name: string;
    assigned_role: string | null;
  }>> {
    const response = await api.get('/orders/task-templates');
    // Interceptor already unwraps { success: true, data: T } to just T
    return response.data;
  },

  /**
   * Add task to a specific order part
   */
  async addTaskToPart(
    orderNumber: number,
    partId: number,
    taskData: {
      task_name: string;
      assigned_role?: string;
    }
  ): Promise<{ task_id: number }> {
    const response = await api.post(
      `/orders/${orderNumber}/parts/${partId}/tasks`,
      taskData
    );
    return response.data;
  },

  /**
   * Remove task from order
   */
  async removeTask(taskId: number): Promise<void> {
    await api.delete(`/orders/tasks/${taskId}`);
  },

  /**
   * Remove all tasks for a specific part
   * Used to exclude a part from Job Progress view
   */
  async removeTasksForPart(partId: number): Promise<{ deletedCount: number }> {
    const response = await api.delete(`/orders/parts/${partId}/tasks`);
    return response.data;
  },

  /**
   * Update task notes
   */
  async updateTaskNotes(taskId: number, notes: string): Promise<void> {
    await api.put(`/orders/tasks/${taskId}/notes`, { notes });
  },

  // =====================================================
  // SESSION MANAGEMENT (Manager Features)
  // =====================================================

  /**
   * Start a task session for any user (manager feature)
   * @param taskId - The task to start a session on
   * @param userId - The user who will be working on the task
   */
  async startTaskSession(taskId: number, userId: number): Promise<{
    session_id: number;
    task_id: number;
    message: string;
  }> {
    const response = await api.post(`/orders/tasks/${taskId}/sessions`, { user_id: userId });
    return response.data;
  },

  /**
   * Stop a session by session ID (manager feature)
   */
  async stopSessionById(sessionId: number): Promise<{
    session_id: number;
    task_id: number;
    duration_minutes: number;
    message: string;
  }> {
    const response = await api.post(`/orders/sessions/${sessionId}/stop`);
    return response.data;
  },

  /**
   * Get active sessions for a task
   */
  async getActiveTaskSessions(taskId: number): Promise<Array<{
    session_id: number;
    task_id: number;
    user_id: number;
    started_at: string;
    ended_at: string | null;
    duration_minutes: number | null;
    notes: string | null;
    user_name: string;
    user_first_name: string;
    user_last_name: string;
  }>> {
    const response = await api.get(`/orders/tasks/${taskId}/sessions/active`);
    return response.data;
  },
};
