import { api } from '../../apiClient';

/**
 * Order Status API
 * Handles order status updates and history tracking
 */
export const orderStatusApi = {
  /**
   * Update order status
   */
  async updateOrderStatus(orderNumber: number, status: string, notes?: string): Promise<void> {
    await api.put(`/orders/${orderNumber}/status`, { status, notes });
  },

  /**
   * Get status history (timeline events)
   */
  async getStatusHistory(orderNumber: number): Promise<any[]> {
    const response = await api.get(`/orders/${orderNumber}/status-history`);
    return response.data.data;
  },
};
