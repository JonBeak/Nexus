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
   * Batch update tasks (start/complete)
   * Returns statusUpdates: Record<orderId, newStatus> for orders that changed status
   */
  async batchUpdateTasks(updates: Array<{ task_id: number; started?: boolean; completed?: boolean }>): Promise<{ statusUpdates?: Record<number, string> }> {
    const response = await api.put('/orders/tasks/batch-update', { updates });
    // Interceptor unwraps { success: true, data: T } to just T
    // So response.data is { statusUpdates: {...} }
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
   * Update task notes
   */
  async updateTaskNotes(taskId: number, notes: string): Promise<void> {
    await api.put(`/orders/tasks/${taskId}/notes`, { notes });
  },
};
