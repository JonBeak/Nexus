import { api } from '../apiClient';

/**
 * Specification Options API
 * Fetches dropdown options from database for order specifications
 *
 * Created: 2025-12-16
 * Part of: Settings to Database Migration
 */

export interface SpecificationCategory {
  category: string;
  category_display_name: string;
  count: number;
}

export interface SpecificationOption {
  option_id: number;
  category: string;
  category_display_name: string;
  option_value: string;
  option_key: string;
  display_order: number;
  is_active: boolean;
  is_system: boolean;
}

export const specificationOptionsApi = {
  /**
   * Get all specification categories
   */
  async getAllCategories(): Promise<SpecificationCategory[]> {
    const response = await api.get('/settings/specifications/categories');
    return response.data;
  },

  /**
   * Get options for a specific category
   */
  async getOptionsByCategory(category: string): Promise<SpecificationOption[]> {
    const response = await api.get(`/settings/specifications/${category}`);
    return response.data;
  },

  /**
   * Fetch all categories and their options in parallel
   * Returns a map of category -> option values (strings)
   */
  async getAllOptions(): Promise<Record<string, string[]>> {
    // First get all categories
    const categories = await this.getAllCategories();

    // Fetch all category options in parallel
    const optionsPromises = categories.map(async (cat) => {
      const options = await this.getOptionsByCategory(cat.category);
      return {
        category: cat.category,
        values: options
          .sort((a, b) => a.display_order - b.display_order)
          .map(opt => opt.option_value)
      };
    });

    const results = await Promise.all(optionsPromises);

    // Convert to Record<category, values[]>
    const optionsMap: Record<string, string[]> = {};
    for (const result of results) {
      optionsMap[result.category] = result.values;
    }

    return optionsMap;
  }
};
