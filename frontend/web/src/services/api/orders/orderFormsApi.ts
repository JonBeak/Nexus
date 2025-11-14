import { api } from '../../apiClient';

/**
 * Order Forms API
 * Handles PDF form generation and job image management
 */
export const orderFormsApi = {
  /**
   * Generate order forms (master, shop, customer, packing list)
   */
  async generateOrderForms(orderNumber: number, createNewVersion: boolean = false): Promise<void> {
    await api.post(`/orders/${orderNumber}/forms`, { createNewVersion });
  },

  /**
   * Get available images in order folder
   */
  async getAvailableImages(orderNumber: number): Promise<{
    success: boolean;
    images: Array<{
      filename: string;
      size: number;
      modifiedDate: string;
    }>;
  }> {
    const response = await api.get(`/orders/${orderNumber}/available-images`);
    return response.data;
  },

  /**
   * Set job image for order
   */
  async setJobImage(
    orderNumber: number,
    filename: string,
    cropCoords?: { top: number; right: number; bottom: number; left: number }
  ): Promise<{
    success: boolean;
    message: string;
    filename: string;
  }> {
    const response = await api.patch(`/orders/${orderNumber}/job-image`, {
      filename,
      cropCoords
    });
    return response.data;
  }
};
