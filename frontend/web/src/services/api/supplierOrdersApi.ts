/**
 * Supplier Orders API
 * API client for supplier order management
 * Created: 2026-02-02
 */

import { api } from '../apiClient';
import {
  SupplierOrder,
  SupplierOrderWithItems,
  SupplierOrderSearchParams,
  CreateSupplierOrderRequest,
  UpdateSupplierOrderRequest,
  CreateSupplierOrderItemRequest,
  UpdateSupplierOrderItemRequest,
  GenerateOrderRequest,
  GenerateOrderResponse,
  ReceiveItemsRequest,
  ReceiveItemsResponse,
  SupplierOrderStatusHistory,
  SupplierOrderStatusCounts,
  SupplierOrderStatus,
} from '../../types/supplierOrders';

/**
 * Supplier Orders API
 * Manages supplier purchase orders
 */
export const supplierOrdersApi = {
  // ============================================================================
  // ORDER OPERATIONS
  // ============================================================================

  /**
   * Get all supplier orders with optional filtering
   */
  getOrders: async (params: SupplierOrderSearchParams = {}): Promise<SupplierOrder[]> => {
    const queryParams: Record<string, any> = { ...params };
    if (Array.isArray(params.status)) {
      queryParams.status = params.status.join(',');
    }
    const response = await api.get('/supplier-orders', { params: queryParams });
    return response.data;
  },

  /**
   * Get single order with items
   */
  getOrder: async (id: number): Promise<SupplierOrderWithItems> => {
    const response = await api.get(`/supplier-orders/${id}`);
    return response.data;
  },

  /**
   * Create new supplier order
   */
  createOrder: async (
    data: CreateSupplierOrderRequest
  ): Promise<{ order_id: number; order_number: string }> => {
    const response = await api.post('/supplier-orders', data);
    return response.data.data;
  },

  /**
   * Generate order from material requirements
   */
  generateOrder: async (data: GenerateOrderRequest): Promise<GenerateOrderResponse> => {
    const response = await api.post('/supplier-orders/generate', data);
    return response.data.data;
  },

  /**
   * Update supplier order
   */
  updateOrder: async (id: number, data: UpdateSupplierOrderRequest): Promise<{ success: boolean }> => {
    const response = await api.put(`/supplier-orders/${id}`, data);
    return response.data;
  },

  /**
   * Submit order to supplier
   */
  submitOrder: async (
    id: number,
    orderDate?: string,
    notes?: string,
    emailFields?: { to: string; cc: string; bcc: string; subject: string; opening?: string; closing?: string }
  ): Promise<{ success: boolean }> => {
    const response = await api.post(`/supplier-orders/${id}/submit`, {
      order_date: orderDate,
      notes,
      email: emailFields,
    });
    return response.data;
  },

  /**
   * Submit a draft PO (new flow — creates snapshot from MR data)
   */
  submitDraftPO: async (
    supplierId: number,
    requirementIds: number[],
    deliveryMethod: 'shipping' | 'pickup',
    notes?: string,
    emailFields?: { to: string; cc: string; bcc: string; subject: string; opening?: string; closing?: string }
  ): Promise<{ order_id: number; order_number: string }> => {
    const response = await api.post('/supplier-orders/submit-draft', {
      supplier_id: supplierId,
      requirement_ids: requirementIds,
      delivery_method: deliveryMethod,
      notes,
      email: emailFields,
    });
    return response.data.data;
  },

  /**
   * Update order status
   */
  updateStatus: async (
    id: number,
    status: SupplierOrderStatus,
    notes?: string
  ): Promise<{ success: boolean }> => {
    const response = await api.put(`/supplier-orders/${id}/status`, { status, notes });
    return response.data;
  },

  /**
   * Receive items on an order
   */
  receiveItems: async (id: number, data: ReceiveItemsRequest): Promise<ReceiveItemsResponse> => {
    const response = await api.post(`/supplier-orders/${id}/receive`, data);
    return response.data.data;
  },

  /**
   * Delete supplier order (draft only)
   */
  deleteOrder: async (id: number): Promise<{ success: boolean }> => {
    const response = await api.delete(`/supplier-orders/${id}`);
    return response.data;
  },

  /**
   * Get order status history
   */
  getStatusHistory: async (id: number): Promise<SupplierOrderStatusHistory[]> => {
    const response = await api.get(`/supplier-orders/${id}/history`);
    return response.data;
  },

  /**
   * Get counts by status
   */
  getStatusCounts: async (): Promise<SupplierOrderStatusCounts> => {
    const response = await api.get('/supplier-orders/status-counts');
    return response.data;
  },

  // ============================================================================
  // ITEM OPERATIONS
  // ============================================================================

  /**
   * Add item to order
   */
  addItem: async (
    orderId: number,
    data: CreateSupplierOrderItemRequest
  ): Promise<{ item_id: number }> => {
    const response = await api.post(`/supplier-orders/${orderId}/items`, data);
    return response.data.data;
  },

  /**
   * Update order item
   */
  updateItem: async (
    orderId: number,
    itemId: number,
    data: UpdateSupplierOrderItemRequest
  ): Promise<{ success: boolean }> => {
    const response = await api.put(`/supplier-orders/${orderId}/items/${itemId}`, data);
    return response.data;
  },

  /**
   * Remove item from order
   */
  removeItem: async (orderId: number, itemId: number): Promise<{ success: boolean }> => {
    const response = await api.delete(`/supplier-orders/${orderId}/items/${itemId}`);
    return response.data;
  },
};

export default supplierOrdersApi;
