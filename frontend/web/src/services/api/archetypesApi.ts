/**
 * Archetypes (Product Types) API
 * API client for product archetypes used in material requirements
 * Created: 2026-02-02
 */

import { api } from '../apiClient';
import type { ProductArchetype } from '../../types/materialRequirements';

/**
 * Archetypes API
 * Provides access to product type catalog for dropdowns
 */
export const archetypesApi = {
  /**
   * Get all active archetypes for dropdown use
   * Grouped by category for UI organization
   */
  getArchetypes: async (params: {
    search?: string;
    category?: string;
    active_only?: boolean;
  } = {}): Promise<ProductArchetype[]> => {
    const response = await api.get('/product-types', {
      params: {
        active_only: true,
        ...params,
      },
    });
    return response.data;
  },

  /**
   * Get archetype categories
   */
  getCategories: async (): Promise<Array<{ category: string; count: number }>> => {
    const response = await api.get('/product-types/categories');
    return response.data;
  },
};

export default archetypesApi;
