/**
 * Validation Rules API
 * Client for managing file expectation rules and standard file names
 */

import { api } from '../apiClient';
import { VectorValidationProfile } from '../../types/aiFileValidation';

// =============================================================================
// Types
// =============================================================================

export interface ConditionGroupNode {
  type: 'group';
  conditionId?: number;
  logicalOperator: 'AND' | 'OR';
  children: ConditionNode[];
}

export interface ConditionLeafNode {
  type: 'condition';
  conditionId?: number;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'exists';
  value: string;
}

export type ConditionNode = ConditionGroupNode | ConditionLeafNode;

export interface ExpectedFileRule {
  rule_id: number;
  rule_name: string;
  expected_filename: string;
  file_name_id: number | null;
  is_required: boolean;
  description: string | null;
  is_active: boolean;
  condition_type: string;
  condition_value: string;
  conditionTree: ConditionNode | null;
  created_at?: string;
}

export interface StandardFileName {
  file_name_id: number;
  name: string;
  description: string | null;
  category: 'working_file' | 'cutting_file' | 'other';
  display_order: number;
  is_active: boolean;
}

export interface ConditionFieldOptions {
  specs_display_names: string[];
  applications: string[];
}

// =============================================================================
// API
// =============================================================================

export const validationRulesApi = {
  // Expected File Rules
  async getRules(): Promise<ExpectedFileRule[]> {
    const response = await api.get('/settings/validation-rules/file-expectation-rules');
    return response.data;
  },

  async createRule(data: {
    rule_name: string;
    expected_filename: string;
    file_name_id?: number | null;
    is_required?: boolean;
    description?: string;
    conditionTree: ConditionNode | null;
  }): Promise<{ rule_id: number }> {
    const response = await api.post('/settings/validation-rules/file-expectation-rules', data);
    return response.data;
  },

  async updateRule(ruleId: number, data: {
    rule_name?: string;
    expected_filename?: string;
    file_name_id?: number | null;
    is_required?: boolean;
    description?: string | null;
    is_active?: boolean;
    conditionTree?: ConditionNode | null;
  }): Promise<void> {
    await api.put(`/settings/validation-rules/file-expectation-rules/${ruleId}`, data);
  },

  async deleteRule(ruleId: number): Promise<void> {
    await api.delete(`/settings/validation-rules/file-expectation-rules/${ruleId}`);
  },

  // Standard File Names
  async getStandardFileNames(): Promise<StandardFileName[]> {
    const response = await api.get('/settings/validation-rules/standard-file-names');
    return response.data;
  },

  async createStandardFileName(data: {
    name: string;
    description?: string;
    category?: string;
  }): Promise<{ file_name_id: number }> {
    const response = await api.post('/settings/validation-rules/standard-file-names', data);
    return response.data;
  },

  async updateStandardFileName(id: number, updates: {
    name?: string;
    description?: string;
    category?: string;
    is_active?: boolean;
  }): Promise<void> {
    await api.put(`/settings/validation-rules/standard-file-names/${id}`, updates);
  },

  // Condition Field Options
  async getConditionFieldOptions(): Promise<ConditionFieldOptions> {
    const response = await api.get('/settings/validation-rules/condition-field-options');
    return response.data;
  },

  // Vector Validation Profiles
  async getVectorProfiles(): Promise<VectorValidationProfile[]> {
    const response = await api.get('/settings/validation-rules/vector-profiles');
    return response.data;
  },

  async updateVectorProfile(
    profileId: number,
    data: { parameters?: Record<string, any>; description?: string | null; is_active?: boolean }
  ): Promise<VectorValidationProfile> {
    const response = await api.put(`/settings/validation-rules/vector-profiles/${profileId}`, data);
    return response.data;
  },
};
