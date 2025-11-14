import { api } from '../apiClient';

/**
 * Provinces/States API
 * Manages tax rules and provincial/state information
 */
export const provincesApi = {
  /**
   * Get provinces/states
   */
  getProvinces: async () => {
    const response = await api.get('/customers/provinces-states');
    return response.data;
  },

  /**
   * Get tax info for province
   */
  getTaxInfo: async (provinceCode: string) => {
    const response = await api.get(`/customers/tax-info/${provinceCode}`);
    return response.data;
  },

  /**
   * Get all tax rules
   */
  getTaxRules: async () => {
    const response = await api.get('/customers/tax-rules');
    return response.data;
  },
};
