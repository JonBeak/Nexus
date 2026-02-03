/**
 * Material Requirements API
 * API client for material requirements tracking
 * Created: 2025-01-27
 */

import { api } from '../apiClient';
import {
  MaterialRequirement,
  MaterialRequirementSearchParams,
  CreateMaterialRequirementRequest,
  UpdateMaterialRequirementRequest,
  ReceiveQuantityRequest,
  ReceiveQuantityResponse,
  BulkReceiveRequest,
  BulkReceiveResponse,
  ActionableRequirementsResponse,
  StatusCountsResponse,
  OrderDropdownOption,
} from '../../types/materialRequirements';

/**
 * Material Requirements API
 * Manages material requirements for orders and stock replenishment
 */
export const materialRequirementsApi = {
  /**
   * Get all material requirements with optional filtering
   */
  getRequirements: async (
    params: MaterialRequirementSearchParams = {}
  ): Promise<MaterialRequirement[]> => {
    // Convert status array to comma-separated string if needed
    const queryParams: Record<string, any> = { ...params };
    if (Array.isArray(params.status)) {
      queryParams.status = params.status.join(',');
    }
    const response = await api.get('/material-requirements', { params: queryParams });
    return response.data;
  },

  /**
   * Get actionable requirements (pending/backordered) for Overview
   */
  getActionableRequirements: async (): Promise<ActionableRequirementsResponse> => {
    const response = await api.get('/material-requirements/actionable');
    return response.data;
  },

  /**
   * Get requirements for a specific order
   */
  getRequirementsByOrderId: async (orderId: number): Promise<MaterialRequirement[]> => {
    const response = await api.get(`/material-requirements/order/${orderId}`);
    return response.data;
  },

  /**
   * Get single material requirement by ID
   */
  getRequirement: async (id: number): Promise<MaterialRequirement> => {
    const response = await api.get(`/material-requirements/${id}`);
    return response.data;
  },

  /**
   * Create new material requirement
   */
  createRequirement: async (
    data: CreateMaterialRequirementRequest
  ): Promise<MaterialRequirement> => {
    const response = await api.post('/material-requirements', data);
    return response.data;
  },

  /**
   * Update material requirement
   */
  updateRequirement: async (
    id: number,
    data: UpdateMaterialRequirementRequest
  ): Promise<MaterialRequirement> => {
    const response = await api.put(`/material-requirements/${id}`, data);
    return response.data;
  },

  /**
   * Delete material requirement
   */
  deleteRequirement: async (id: number): Promise<{ success: boolean }> => {
    const response = await api.delete(`/material-requirements/${id}`);
    return response.data;
  },

  /**
   * Receive quantity for a requirement (partial receipt support)
   */
  receiveQuantity: async (
    id: number,
    data: ReceiveQuantityRequest
  ): Promise<ReceiveQuantityResponse> => {
    const response = await api.put(`/material-requirements/${id}/receive`, data);
    return response.data;
  },

  /**
   * Bulk receive multiple requirements
   */
  bulkReceive: async (data: BulkReceiveRequest): Promise<BulkReceiveResponse> => {
    const response = await api.post('/material-requirements/bulk-receive', data);
    return response.data;
  },

  /**
   * Add requirements to shopping cart
   */
  addToCart: async (
    requirementIds: number[],
    cartId: string
  ): Promise<{ updated_count: number }> => {
    const response = await api.post('/material-requirements/add-to-cart', {
      requirement_ids: requirementIds,
      cart_id: cartId,
    });
    return response.data;
  },

  /**
   * Get status counts for dashboard badges
   */
  getStatusCounts: async (): Promise<StatusCountsResponse> => {
    const response = await api.get('/material-requirements/status-counts');
    return response.data;
  },

  /**
   * Get recent orders for dropdown
   */
  getRecentOrders: async (limit: number = 50): Promise<OrderDropdownOption[]> => {
    const response = await api.get('/material-requirements/recent-orders', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get pending/backordered requirements grouped by supplier
   * Used for supplier order generation
   */
  getGroupedBySupplier: async (): Promise<{
    groups: Array<{
      supplier_id: number;
      supplier_name: string;
      contact_email: string | null;
      contact_phone: string | null;
      item_count: number;
      total_quantity: number;
      requirements: Array<{
        requirement_id: number;
        entry_date: string;
        custom_product_type: string | null;
        archetype_name: string | null;
        size_description: string | null;
        quantity_ordered: number;
        unit_of_measure: string | null;
        order_number: string | null;
        order_name: string | null;
        is_stock_item: boolean;
        notes: string | null;
      }>;
    }>;
    total_requirements: number;
    total_suppliers: number;
  }> => {
    const response = await api.get('/material-requirements/grouped-by-supplier');
    return response.data;
  },
};

export default materialRequirementsApi;
