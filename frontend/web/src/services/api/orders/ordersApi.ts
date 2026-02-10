import { api } from '../../apiClient';
import { KanbanOrder, OrderStatus } from '../../../types/orders';

/**
 * Response type for Kanban endpoint
 */
export interface KanbanDataResponse {
  columns: Record<OrderStatus, KanbanOrder[]>;
  painting: KanbanOrder[];
  totalCounts: {
    completed: number;
    cancelled: number;
  };
}

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
    excludeStatuses?: string[];
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
    if (filters?.excludeStatuses && filters.excludeStatuses.length > 0) {
      params.excludeStatuses = filters.excludeStatuses.join(',');
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
    order_name?: string;
    customer_po?: string;
    customer_job_number?: string;
    due_date?: string;
    hard_due_date_time?: string;
    production_notes?: string;
    manufacturing_note?: string;
    internal_note?: string;
    high_standards?: boolean | null;
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
   * Update order point persons
   */
  async updateOrderPointPersons(orderNumber: number, pointPersons: Array<{
    contact_id?: number;
    contact_email: string;
    contact_name?: string;
    contact_phone?: string;
    contact_role?: string;
    saveToDatabase?: boolean;
  }>): Promise<void> {
    await api.put(`/orders/${orderNumber}/point-persons`, { pointPersons });
  },

  /**
   * Update order accounting emails
   */
  async updateOrderAccountingEmails(orderNumber: number, accountingEmails: Array<{
    email: string;
    email_type: 'to' | 'cc' | 'bcc';
    label?: string;
    saveToDatabase?: boolean;
  }>): Promise<void> {
    await api.put(`/orders/${orderNumber}/accounting-emails`, { accountingEmails });
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

  /**
   * Check awaiting payment orders for auto-completion
   * Called on page load to sync balance and auto-complete paid orders
   * Also detects refunds on completed orders and moves them back to awaiting_payment
   */
  async checkAwaitingPayments(): Promise<{
    checked: number;
    autoCompleted: number;
    movedToAwaiting: number;
    errors: number;
  }> {
    const response = await api.post('/orders/check-awaiting-payments');
    return response.data;
  },

  /**
   * Get Kanban board data (optimized for performance)
   * Returns pre-grouped, pre-sorted orders with computed fields
   */
  async getKanbanOrders(options?: {
    showAllCompleted?: boolean;
    showAllCancelled?: boolean;
  }): Promise<KanbanDataResponse> {
    const params: Record<string, string> = {};
    if (options?.showAllCompleted) {
      params.showAllCompleted = 'true';
    }
    if (options?.showAllCancelled) {
      params.showAllCancelled = 'true';
    }
    const response = await api.get('/orders/kanban', { params });
    return response.data;
  },

  // =============================================
  // FOLDER MISMATCH MANAGEMENT
  // =============================================

  /**
   * Get orders where folder location doesn't match expected based on status
   * Note: Interceptor unwraps { success, data } to just the data array
   */
  async getFolderMismatches(): Promise<Array<{
    order_id: number;
    order_number: number;
    order_name: string;
    status: string;
    folder_name: string;
    folder_location: string;
    expected_location: string;
    customer_name: string;
  }>> {
    const response = await api.get('/orders/folder-mismatches');
    return response.data;
  },

  /**
   * Retry moving folder for a single order
   */
  async retryFolderMove(orderNumber: number): Promise<{
    success: boolean;
    message: string;
    newLocation?: string;
  }> {
    const response = await api.post(`/orders/${orderNumber}/retry-folder-move`);
    return response.data;
  },

  /**
   * Retry moving all mismatched folders
   */
  async retryAllFolderMoves(): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    results: Array<{ order_number: number; success: boolean; message: string }>;
  }> {
    const response = await api.post('/orders/retry-all-folder-moves');
    return response.data;
  },
};
