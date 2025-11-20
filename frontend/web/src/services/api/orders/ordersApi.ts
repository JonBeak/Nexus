import { api } from '../../apiClient';

/**
 * Orders API - Core CRUD Operations
 * Handles basic order management, creation, retrieval, and updates
 */
export const ordersApi = {
  /**
   * Get all orders with optional filters
   */
  async getOrders(filters?: {
    status?: string;
    customer_id?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const params: any = {};

    if (filters?.status && filters.status !== 'all') {
      params.status = filters.status;
    }
    if (filters?.customer_id) {
      params.customer_id = filters.customer_id;
    }
    if (filters?.search) {
      params.search = filters.search;
    }
    if (filters?.limit) {
      params.limit = filters.limit;
    }
    if (filters?.offset) {
      params.offset = filters.offset;
    }

    const response = await api.get('/orders', { params });
    // Backend returns orders directly in response.data, not response.data.data
    return response.data;
  },

  /**
   * Get single order by order number
   */
  async getOrderById(orderNumber: number): Promise<any> {
    const response = await api.get(`/orders/${orderNumber}`);
    return response.data;
  },

  /**
   * Update order details
   */
  async updateOrder(orderNumber: number, updates: {
    customer_po?: string;
    customer_job_number?: string;
    due_date?: string;
    hard_due_date_time?: string;
    production_notes?: string;
    manufacturing_note?: string;
    internal_note?: string;
  }): Promise<void> {
    await api.put(`/orders/${orderNumber}`, updates);
  },

  /**
   * Convert estimate to order
   */
  async convertEstimateToOrder(data: {
    estimateId: number;
    orderName: string;
    customerPo?: string;
    customerJobNumber?: string;
    dueDate?: string;
    hardDueDateTime?: string;
    pointPersons?: any[];
    productionNotes?: string;
    estimatePreviewData?: any;
  }): Promise<{ order_id: number; order_number: number }> {
    const response = await api.post('/orders/convert-estimate', data);
    return response.data;
  },

  /**
   * Delete order
   */
  async deleteOrder(orderNumber: number): Promise<void> {
    await api.delete(`/orders/${orderNumber}`);
  },

  /**
   * Get order by estimate ID
   */
  async getOrderByEstimate(estimateId: number): Promise<{ order_id: number; order_number: number } | null> {
    const response = await api.get(`/orders/by-estimate/${estimateId}`);
    return response.data.order;
  },

  /**
   * Get order with full part details
   * Enhanced version that ensures parts are included
   */
  async getOrderWithParts(orderNumber: number): Promise<{
    order: any;
    parts: any[];
  }> {
    const response = await api.get(`/orders/${orderNumber}`);
    // Interceptor already unwraps response.data.data to response.data
    return {
      order: response.data,
      parts: response.data.parts || []
    };
  },

  /**
   * Get customer tax from billing address
   * Returns the tax_name for the order's customer based on billing address province
   */
  async getCustomerTax(orderNumber: number): Promise<string> {
    const response = await api.get(`/orders/${orderNumber}/customer-tax`);
    return response.data.tax_name;
  },
};
