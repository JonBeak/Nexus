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
  DraftPOGroup,
  StockAvailabilityResponse,
  HoldDetailsResponse,
  VinylHold,
  VinylItemWithHolds,
  SupplierProductWithHolds,
  CreateVinylHoldRequest,
  CreateGeneralInventoryHoldRequest,
  ReceiveWithHoldRequest,
  ReceiveWithHoldResponse,
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
   * Get unassigned requirements (no supplier set)
   */
  getUnassigned: async (): Promise<MaterialRequirement[]> => {
    const response = await api.get('/material-requirements/unassigned');
    return response.data;
  },

  /**
   * Get draft PO groups — MRs grouped by supplier, not yet ordered.
   * Replaces old draft supplier_orders.
   */
  getDraftPOGroups: async (): Promise<DraftPOGroup[]> => {
    const response = await api.get('/material-requirements/draft-po-groups');
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

  // ===========================================================================
  // INVENTORY HOLD METHODS
  // ===========================================================================

  /**
   * Check stock availability for a material requirement
   */
  checkStockAvailability: async (params: {
    archetype_id?: number | null;
    vinyl_product_id?: number | null;
    supplier_product_id?: number | null;
  }): Promise<StockAvailabilityResponse> => {
    const response = await api.get('/material-requirements/check-stock', { params });
    return response.data;
  },

  /**
   * Get available vinyl items with holds for a vinyl product or raw specs
   * Accepts either vinylProductId OR brand+series
   */
  getAvailableVinylWithHolds: async (
    params: { vinylProductId: number } | { brand: string; series: string; colour_number?: string; colour_name?: string }
  ): Promise<VinylItemWithHolds[]> => {
    const queryParams = 'vinylProductId' in params
      ? { vinyl_product_id: params.vinylProductId }
      : {
          brand: params.brand,
          series: params.series,
          colour_number: params.colour_number,
          colour_name: params.colour_name,
        };
    const response = await api.get('/material-requirements/available-vinyl', { params: queryParams });
    return response.data;
  },

  /**
   * Get supplier products with holds for an archetype
   */
  getSupplierProductsWithHolds: async (archetypeId: number): Promise<SupplierProductWithHolds[]> => {
    const response = await api.get('/material-requirements/available-products', {
      params: { archetype_id: archetypeId },
    });
    return response.data;
  },

  /**
   * Get hold details for a requirement
   */
  getHoldForRequirement: async (requirementId: number): Promise<HoldDetailsResponse> => {
    const response = await api.get(`/material-requirements/${requirementId}/hold`);
    return response.data;
  },

  /**
   * Get other holds on the same vinyl (for multi-hold receive flow)
   */
  getOtherHoldsOnVinyl: async (requirementId: number, vinylId: number): Promise<VinylHold[]> => {
    const response = await api.get(`/material-requirements/${requirementId}/other-holds`, {
      params: { vinyl_id: vinylId },
    });
    return response.data;
  },

  /**
   * Create a vinyl hold for a material requirement
   */
  createVinylHold: async (
    requirementId: number,
    data: CreateVinylHoldRequest
  ): Promise<{ hold_id: number }> => {
    const response = await api.post(`/material-requirements/${requirementId}/vinyl-hold`, data);
    return response.data;
  },

  /**
   * Create a general inventory hold for a material requirement
   */
  createGeneralInventoryHold: async (
    requirementId: number,
    data: CreateGeneralInventoryHoldRequest
  ): Promise<{ hold_id: number }> => {
    const response = await api.post(`/material-requirements/${requirementId}/general-hold`, data);
    return response.data;
  },

  /**
   * Release a hold from a material requirement
   */
  releaseHold: async (requirementId: number): Promise<void> => {
    await api.delete(`/material-requirements/${requirementId}/hold`);
  },

  /**
   * Receive a requirement with a vinyl hold
   * Handles multi-hold scenario
   */
  receiveRequirementWithHold: async (
    requirementId: number,
    data: ReceiveWithHoldRequest = {}
  ): Promise<ReceiveWithHoldResponse> => {
    const response = await api.post(`/material-requirements/${requirementId}/receive-with-hold`, data);
    return response.data;
  },
};

export default materialRequirementsApi;
