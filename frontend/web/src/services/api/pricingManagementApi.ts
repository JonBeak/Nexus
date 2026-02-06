/**
 * Pricing Management API - Generic CRUD for pricing tables
 *
 * All methods are parameterized by tableKey, matching the backend's
 * whitelist-based generic API.
 */

import { api } from '../apiClient';

export interface PricingRow {
  [key: string]: any;
}

export const pricingManagementApi = {
  /**
   * Get all rows for a pricing table
   */
  async getRows(tableKey: string, includeInactive = false): Promise<PricingRow[]> {
    const params = includeInactive ? { includeInactive: 'true' } : {};
    const response = await api.get(`/pricing-management/${tableKey}`, { params });
    return response.data;
  },

  /**
   * Create a new row in a pricing table
   */
  async createRow(tableKey: string, data: Record<string, any>): Promise<{ id: number | string }> {
    const response = await api.post(`/pricing-management/${tableKey}`, data);
    return response.data;
  },

  /**
   * Update an existing row
   */
  async updateRow(tableKey: string, id: number | string, data: Record<string, any>): Promise<void> {
    await api.put(`/pricing-management/${tableKey}/${id}`, data);
  },

  /**
   * Deactivate (soft delete) a row
   */
  async deactivateRow(tableKey: string, id: number | string): Promise<void> {
    await api.delete(`/pricing-management/${tableKey}/${id}`);
  },

  /**
   * Restore (reactivate) a row
   */
  async restoreRow(tableKey: string, id: number | string): Promise<void> {
    await api.put(`/pricing-management/${tableKey}/${id}/restore`);
  }
};
