import { api } from '../apiClient';

/**
 * Materials API
 * Manages substrate materials catalog for sign specifications
 */
export const materialsApi = {
  /**
   * Get all active substrate materials for specification dropdowns
   */
  async getActiveSubstrates(): Promise<string[]> {
    const response = await api.get('/materials/substrates');
    // Interceptor unwraps { success: true, data: [...] } to just [...]
    return response.data;
  }
};
