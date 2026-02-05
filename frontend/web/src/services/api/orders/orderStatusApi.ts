import { api } from '../../apiClient';

export interface UpdateStatusResult {
  warnings?: string[];
}

/**
 * Order Status API
 * Handles order status updates and history tracking
 */
export const orderStatusApi = {
  /**
   * Update order status
   * Returns warnings array if folder movement or other non-blocking issues occurred
   */
  async updateOrderStatus(orderNumber: number, status: string, notes?: string): Promise<UpdateStatusResult> {
    const response = await api.put(`/orders/${orderNumber}/status`, { status, notes });
    return { warnings: response.data?.warnings };
  },

  /**
   * Get status history (timeline events)
   */
  async getStatusHistory(orderNumber: number): Promise<any[]> {
    const response = await api.get(`/orders/${orderNumber}/status-history`);
    // Interceptor already unwraps { success: true, data: T } to just T
    return response.data;
  },
};
