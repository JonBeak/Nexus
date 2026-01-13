// File Clean up Finished: 2026-01-12
// Phase 4.c: Supplier Products API
// Purpose: API client for supplier products and pricing management
// Created: 2025-12-19

import { api } from '../apiClient';
import {
  SupplierProduct,
  PricingHistory,
  PriceRange,
  CreateSupplierProductRequest,
  UpdateSupplierProductRequest,
  AddPriceRequest
} from '../../types/supplyChain';

/**
 * Supplier Products API
 * Manages supplier products (link between archetypes and suppliers with pricing)
 */
export const supplierProductsApi = {
  /**
   * Get all supplier products with optional filtering
   */
  getSupplierProducts: async (params: {
    archetype_id?: number;
    supplier_id?: number;
    search?: string;
    active_only?: boolean;
    has_price?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<SupplierProduct[]> => {
    const response = await api.get('/supplier-products', { params });
    return response.data;
  },

  /**
   * Get supplier products for a specific archetype
   */
  getSupplierProductsByArchetype: async (archetypeId: number): Promise<SupplierProduct[]> => {
    const response = await api.get(`/supplier-products/archetype/${archetypeId}`);
    return response.data;
  },

  /**
   * Get single supplier product
   */
  getSupplierProduct: async (id: number): Promise<SupplierProduct> => {
    const response = await api.get(`/supplier-products/${id}`);
    return response.data;
  },

  /**
   * Create new supplier product
   * Returns the new supplier_product_id
   */
  createSupplierProduct: async (
    data: CreateSupplierProductRequest
  ): Promise<number> => {
    const response = await api.post('/supplier-products', data);
    return response.data;
  },

  /**
   * Update supplier product
   */
  updateSupplierProduct: async (
    id: number,
    updates: UpdateSupplierProductRequest
  ): Promise<{ success: boolean }> => {
    const response = await api.put(`/supplier-products/${id}`, updates);
    return response.data;
  },

  /**
   * Delete supplier product
   */
  deleteSupplierProduct: async (id: number): Promise<{ success: boolean }> => {
    const response = await api.delete(`/supplier-products/${id}`);
    return response.data;
  },

  /**
   * Get price range for an archetype (min/max across all suppliers)
   */
  getArchetypePriceRange: async (archetypeId: number): Promise<PriceRange | null> => {
    const response = await api.get(`/supplier-products/archetype/${archetypeId}/price-range`);
    return response.data;
  },

  /**
   * Get price ranges for multiple archetypes (batch operation)
   */
  getArchetypePriceRanges: async (archetypeIds: number[]): Promise<{
    [archetypeId: number]: PriceRange | null;
  }> => {
    const response = await api.post('/supplier-products/archetype/price-ranges/batch', {
      archetype_ids: archetypeIds
    });
    return response.data;
  },

  /**
   * Add new price to supplier product (creates pricing history entry)
   * Returns pricing_id, alert flag, and optional price_change_percent
   */
  addPrice: async (
    supplierProductId: number,
    priceData: AddPriceRequest
  ): Promise<{ pricing_id: number; alert: boolean; price_change_percent?: number }> => {
    const response = await api.post(
      `/supplier-products/${supplierProductId}/prices`,
      priceData
    );
    return response.data;
  },

  /**
   * Get complete price history for a supplier product
   */
  getPriceHistory: async (supplierProductId: number): Promise<PricingHistory[]> => {
    const response = await api.get(
      `/supplier-products/${supplierProductId}/prices/history`
    );
    return response.data;
  },

  /**
   * Create multiple supplier products (bulk operation)
   * Returns array of new supplier_product_ids
   */
  bulkCreateSupplierProducts: async (
    products: CreateSupplierProductRequest[]
  ): Promise<number[]> => {
    const response = await api.post('/supplier-products/bulk/create', {
      products
    });
    return response.data;
  }
};
