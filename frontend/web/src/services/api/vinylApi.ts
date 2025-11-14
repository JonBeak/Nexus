import { api } from '../apiClient';

/**
 * Vinyl Inventory API
 * Manages vinyl inventory items and usage tracking
 */
export const vinylApi = {
  /**
   * Get all vinyl inventory items
   */
  getVinylItems: async (params: {
    disposition?: string;
    type?: string;
    search?: string;
  } = {}) => {
    const response = await api.get('/vinyl', { params });
    return response.data;
  },

  /**
   * Get single vinyl item
   */
  getVinylItem: async (id: number) => {
    const response = await api.get(`/vinyl/${id}`);
    return response.data;
  },

  /**
   * Create new vinyl item
   */
  createVinylItem: async (vinylData: any) => {
    const response = await api.post('/vinyl', vinylData);
    return response.data;
  },

  /**
   * Update vinyl item
   */
  updateVinylItem: async (id: number, updates: any) => {
    const response = await api.put(`/vinyl/${id}`, updates);
    return response.data;
  },

  /**
   * Mark vinyl as used
   */
  markVinylAsUsed: async (id: number, data: { usage_note?: string; job_ids?: number[] }) => {
    const response = await api.put(`/vinyl/${id}/use`, data);
    return response.data;
  },

  /**
   * Delete vinyl item
   */
  deleteVinylItem: async (id: number) => {
    const response = await api.delete(`/vinyl/${id}`);
    return response.data;
  },

  /**
   * Get recent vinyl items for copying
   */
  getRecentVinylForCopying: async () => {
    const response = await api.get('/vinyl/recent/for-copying');
    return response.data;
  },

  /**
   * Get vinyl statistics
   */
  getVinylStats: async () => {
    const response = await api.get('/vinyl/stats/summary');
    return response.data;
  },

  /**
   * Get suppliers available for a product combination
   */
  getSuppliersForProduct: async (params: {
    brand?: string;
    series?: string;
    colour_number?: string;
    colour_name?: string;
    type?: string;
  } = {}) => {
    const response = await api.get('/vinyl/suppliers/for-product', { params });
    return response.data;
  },

  /**
   * Update job links for a vinyl item (unified endpoint)
   */
  updateJobLinks: async (id: number, job_ids: number[]) => {
    const response = await api.put(`/vinyl/${id}/job-links`, { job_ids });
    return response.data;
  },

  /**
   * Get job links for a vinyl item (unified endpoint)
   */
  getJobLinks: async (id: number) => {
    const response = await api.get(`/vinyl/${id}/job-links`);
    return response.data;
  },
};
