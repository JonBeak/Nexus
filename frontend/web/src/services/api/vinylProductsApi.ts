// File Clean up Finished: Nov 14, 2025

import { api } from '../apiClient';

/**
 * Vinyl Products API
 * Manages vinyl product catalog and specifications
 */
export const vinylProductsApi = {
  /**
   * Get all vinyl products
   */
  getVinylProducts: async (params: {
    search?: string;
    brand?: string;
    series?: string;
    colour_number?: string;
    colour_name?: string;
    supplier?: string;
    active_only?: boolean;
  } = {}) => {
    const response = await api.get('/vinyl-products', { params });
    return response.data;
  },

  /**
   * Get single vinyl product
   */
  getVinylProduct: async (id: number) => {
    const response = await api.get(`/vinyl-products/${id}`);
    return response.data;
  },

  /**
   * Create new vinyl product
   */
  createVinylProduct: async (productData: any) => {
    const response = await api.post('/vinyl-products', productData);
    return response.data;
  },

  /**
   * Update vinyl product
   */
  updateVinylProduct: async (id: number, updates: any) => {
    const response = await api.put(`/vinyl-products/${id}`, updates);
    return response.data;
  },

  /**
   * Delete vinyl product
   */
  deleteVinylProduct: async (id: number) => {
    const response = await api.delete(`/vinyl-products/${id}`);
    return response.data;
  },

  /**
   * Get product statistics
   */
  getVinylProductStats: async () => {
    const response = await api.get('/vinyl-products/stats/summary');
    return response.data;
  },

  /**
   * Get autofill suggestions
   */
  getAutofillSuggestions: async (params: {
    brand?: string;
    series?: string;
    colour_number?: string;
    colour_name?: string;
  } = {}) => {
    const response = await api.get('/vinyl-products/autofill/suggestions', { params });
    return response.data;
  },

  /**
   * Get vinyl colour options for specification dropdown
   * Returns formatted strings: "{Series}-{ColourNumber} {ColourName}"
   */
  getVinylColourOptions: async (): Promise<string[]> => {
    const response = await api.get('/vinyl-products/colour-options');
    return response.data; // apiClient interceptor already unwraps {success, data} response
  },
};
