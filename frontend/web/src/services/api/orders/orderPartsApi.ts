import { api } from '../../apiClient';

/**
 * Order Parts API
 * Manages order parts, specifications, and part-level updates
 */
export const orderPartsApi = {
  /**
   * Update order parts in bulk
   */
  async updateOrderParts(
    orderNumber: number,
    parts: Array<{
      part_id: number;
      product_type?: string;
      specifications?: any;
      invoice_description?: string;
      quantity?: number;
      unit_price?: number;
      extended_price?: number;
      production_notes?: string;
    }>
  ): Promise<void> {
    await api.put(`/orders/${orderNumber}/parts`, { parts });
  },

  /**
   * Update specs display name and regenerate specifications
   */
  async updateSpecsDisplayName(
    orderNumber: number,
    partId: number,
    specsDisplayName: string
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    const response = await api.put(
      `/orders/${orderNumber}/parts/${partId}/specs-display-name`,
      { specs_display_name: specsDisplayName }
    );
    return response.data;
  },

  /**
   * Update specs quantity for a part
   */
  async updatePartSpecsQty(
    orderNumber: number,
    partId: number,
    specsQty: number
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    const response = await api.patch(
      `/orders/${orderNumber}/parts/${partId}/specs-qty`,
      { specs_qty: specsQty }
    );
    return response.data;
  },

  /**
   * Toggle is_parent status for an order part
   */
  async toggleIsParent(orderNumber: number, partId: number): Promise<void> {
    await api.patch(`/orders/${orderNumber}/parts/${partId}/toggle-parent`);
  },
};
