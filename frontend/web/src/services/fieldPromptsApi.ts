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
    // API interceptor unwraps { success: true, data: templates } -> templates directly
    return response.data;
  },

  /**
   * Get field prompts for a product type
   */
  async getFieldPrompts(productTypeId: number): Promise<SimpleProductTemplate> {
    const response = await api.get(`/job-estimation/product-types/${productTypeId}/field-prompts`);
    // API interceptor unwraps { success: true, data: prompts } -> prompts directly
    return response.data;
  }
};