import api from './api';

export interface FieldPrompts {
  [key: string]: string | boolean;  // field1: "Label", field1_enabled: true, etc.
}

export interface SimpleProductTemplate {
  field_prompts: FieldPrompts;
  static_options: Record<string, string[]>;
}

/**
 * API service for field prompts functionality
 */
export const fieldPromptsApi = {
  /**
   * Get field prompts for all product types in a single call
   */
  async getAllTemplates(): Promise<Record<number, SimpleProductTemplate>> {
    const response = await api.get('/job-estimation/templates/all');

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to fetch all templates');
    }

    return response.data.data;
  },

  /**
   * Get field prompts for a product type
   */
  async getFieldPrompts(productTypeId: number): Promise<SimpleProductTemplate> {
    const response = await api.get(`/job-estimation/product-types/${productTypeId}/field-prompts`);

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to fetch field prompts');
    }

    return response.data.data;
  }
};