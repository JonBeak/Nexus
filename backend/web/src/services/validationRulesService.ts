/**
 * Validation Rules Service
 * Business logic for managing file expectation rules and standard file names
 */

import { fileExpectationRulesRepository, RuleWithConditions, StandardFileName } from '../repositories/fileExpectationRulesRepository';
import { ConditionNode, buildConditionTree } from '../utils/conditionTree';
import { ServiceResult } from '../types/serviceResults';

/** Rule as returned to the frontend, with condition tree instead of flat rows */
export interface ExpectedFileRuleDTO {
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

class ValidationRulesService {
  // =============================================================================
  // EXPECTED FILE RULES
  // =============================================================================

  async getAllRules(): Promise<ServiceResult<ExpectedFileRuleDTO[]>> {
    try {
      const rules = await fileExpectationRulesRepository.getAllRulesWithConditions();
      const dtos = rules.map(this.ruleToDTO);
      return { success: true, data: dtos };
    } catch (error) {
      console.error('[ValidationRulesService] Error getting rules:', error);
      return { success: false, error: 'Failed to get rules', code: 'INTERNAL_ERROR' };
    }
  }

  async createRule(data: {
    rule_name: string;
    expected_filename: string;
    file_name_id?: number | null;
    is_required?: boolean;
    description?: string;
    conditionTree: ConditionNode | null;
  }): Promise<ServiceResult<{ rule_id: number }>> {
    try {
      // Derive condition_type/value from tree for backward compat
      const { conditionType, conditionValue } = this.extractLegacyCondition(data.conditionTree);

      const ruleId = await fileExpectationRulesRepository.saveRuleWithConditions(
        {
          rule_name: data.rule_name,
          expected_filename: data.expected_filename,
          file_name_id: data.file_name_id ?? null,
          is_required: data.is_required ?? true,
          description: data.description || null,
          condition_type: conditionType,
          condition_value: conditionValue,
        },
        data.conditionTree
      );

      return { success: true, data: { rule_id: ruleId } };
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return { success: false, error: 'A rule with this condition and filename already exists', code: 'DUPLICATE_ENTRY' };
      }
      console.error('[ValidationRulesService] Error creating rule:', error);
      return { success: false, error: 'Failed to create rule', code: 'INTERNAL_ERROR' };
    }
  }

  async updateRule(
    ruleId: number,
    data: {
      rule_name?: string;
      expected_filename?: string;
      file_name_id?: number | null;
      is_required?: boolean;
      description?: string | null;
      is_active?: boolean;
      conditionTree?: ConditionNode | null;
    }
  ): Promise<ServiceResult<void>> {
    try {
      await fileExpectationRulesRepository.updateRuleWithConditions(
        ruleId,
        {
          rule_name: data.rule_name,
          expected_filename: data.expected_filename,
          file_name_id: data.file_name_id,
          is_required: data.is_required,
          description: data.description,
          is_active: data.is_active,
        },
        data.conditionTree
      );
      return { success: true, data: undefined };
    } catch (error) {
      console.error('[ValidationRulesService] Error updating rule:', error);
      return { success: false, error: 'Failed to update rule', code: 'INTERNAL_ERROR' };
    }
  }

  async deleteRule(ruleId: number): Promise<ServiceResult<void>> {
    try {
      await fileExpectationRulesRepository.deleteRuleWithConditions(ruleId);
      return { success: true, data: undefined };
    } catch (error) {
      console.error('[ValidationRulesService] Error deleting rule:', error);
      return { success: false, error: 'Failed to delete rule', code: 'INTERNAL_ERROR' };
    }
  }

  // =============================================================================
  // STANDARD FILE NAMES
  // =============================================================================

  async getStandardFileNames(): Promise<ServiceResult<StandardFileName[]>> {
    try {
      const names = await fileExpectationRulesRepository.getStandardFileNames(true);
      return { success: true, data: names };
    } catch (error) {
      console.error('[ValidationRulesService] Error getting standard file names:', error);
      return { success: false, error: 'Failed to get file names', code: 'INTERNAL_ERROR' };
    }
  }

  async createStandardFileName(data: {
    name: string;
    description?: string;
    category?: 'working_file' | 'cutting_file' | 'other';
  }): Promise<ServiceResult<{ file_name_id: number }>> {
    try {
      const id = await fileExpectationRulesRepository.createStandardFileName(data);
      return { success: true, data: { file_name_id: id } };
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return { success: false, error: 'A file name with this name already exists', code: 'DUPLICATE_ENTRY' };
      }
      console.error('[ValidationRulesService] Error creating file name:', error);
      return { success: false, error: 'Failed to create file name', code: 'INTERNAL_ERROR' };
    }
  }

  async updateStandardFileName(
    id: number,
    updates: { name?: string; description?: string; category?: string; is_active?: boolean }
  ): Promise<ServiceResult<void>> {
    try {
      await fileExpectationRulesRepository.updateStandardFileName(id, updates);
      return { success: true, data: undefined };
    } catch (error) {
      console.error('[ValidationRulesService] Error updating file name:', error);
      return { success: false, error: 'Failed to update file name', code: 'INTERNAL_ERROR' };
    }
  }

  // =============================================================================
  // CONDITION FIELD OPTIONS (dropdowns)
  // =============================================================================

  async getConditionFieldOptions(): Promise<ServiceResult<{
    specs_display_names: string[];
    applications: string[];
  }>> {
    try {
      const [specsDisplayNames, applications] = await Promise.all([
        fileExpectationRulesRepository.getSpecsDisplayNames(),
        fileExpectationRulesRepository.getApplicationValues(),
      ]);
      return { success: true, data: { specs_display_names: specsDisplayNames, applications } };
    } catch (error) {
      console.error('[ValidationRulesService] Error getting field options:', error);
      return { success: false, error: 'Failed to get field options', code: 'INTERNAL_ERROR' };
    }
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private ruleToDTO(rule: RuleWithConditions): ExpectedFileRuleDTO {
    return {
      rule_id: rule.rule_id,
      rule_name: rule.rule_name,
      expected_filename: rule.expected_filename,
      file_name_id: rule.file_name_id,
      is_required: rule.is_required,
      description: rule.description || null,
      is_active: rule.is_active,
      condition_type: rule.condition_type,
      condition_value: rule.condition_value,
      conditionTree: buildConditionTree(rule.conditionRows),
      created_at: rule.created_at?.toString(),
    };
  }

  /** Extract a simple condition_type/value from a tree for backward compat columns */
  private extractLegacyCondition(tree: ConditionNode | null): {
    conditionType: 'specs_display_name' | 'product_type_id' | 'has_template';
    conditionValue: string;
  } {
    if (!tree) {
      return { conditionType: 'specs_display_name', conditionValue: '' };
    }

    // Walk the tree to find the first specs_display_name leaf
    const leaf = this.findFirstLeaf(tree);
    if (leaf && leaf.field === 'specs_display_name') {
      return { conditionType: 'specs_display_name', conditionValue: leaf.value };
    }
    if (leaf && leaf.field === 'application') {
      return { conditionType: 'specs_display_name', conditionValue: leaf.value };
    }

    return { conditionType: 'specs_display_name', conditionValue: '' };
  }

  private findFirstLeaf(node: ConditionNode): { field: string; value: string } | null {
    if (node.type === 'condition') {
      return { field: node.field, value: node.value };
    }
    for (const child of node.children) {
      const found = this.findFirstLeaf(child);
      if (found) return found;
    }
    return null;
  }
}

export const validationRulesService = new ValidationRulesService();
