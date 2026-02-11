/**
 * File Expectation Rules Repository
 * Data access layer for AI file expectation rules with condition tree support
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { FileExpectationRule, RuleConditionType } from '../types/aiFileValidation';
import { ConditionRow, ConditionNode, flattenConditionTree } from '../utils/conditionTree';

/** Rule with its condition tree rows attached */
export interface RuleWithConditions extends FileExpectationRule {
  file_name_id: number | null;
  conditionRows: ConditionRow[];
}

/** Standard file name catalog entry */
export interface StandardFileName {
  file_name_id: number;
  name: string;
  description: string | null;
  category: 'working_file' | 'cutting_file' | 'other';
  display_order: number;
  is_active: boolean;
}

export class FileExpectationRulesRepository {
  // =============================================================================
  // EXISTING METHODS (backward compat)
  // =============================================================================

  async getAllActiveRules(): Promise<FileExpectationRule[]> {
    const rows = await query(
      `SELECT * FROM ai_file_expectation_rules
       WHERE is_active = TRUE
       ORDER BY condition_type, condition_value, expected_filename`
    ) as RowDataPacket[];
    return rows as FileExpectationRule[];
  }

  async getRulesByConditionValues(
    conditionType: RuleConditionType,
    conditionValues: string[]
  ): Promise<FileExpectationRule[]> {
    if (conditionValues.length === 0) return [];
    const placeholders = conditionValues.map(() => '?').join(', ');
    const rows = await query(
      `SELECT * FROM ai_file_expectation_rules
       WHERE is_active = TRUE AND condition_type = ? AND condition_value IN (${placeholders})
       ORDER BY condition_value, expected_filename`,
      [conditionType, ...conditionValues]
    ) as RowDataPacket[];
    return rows as FileExpectationRule[];
  }

  // =============================================================================
  // CONDITION TREE METHODS
  // =============================================================================

  /**
   * Get all rules with their condition tree rows (for evaluation)
   */
  async getAllRulesWithConditions(): Promise<RuleWithConditions[]> {
    const rules = await query(
      `SELECT * FROM ai_file_expectation_rules
       ORDER BY is_active DESC, rule_name`
    ) as RowDataPacket[];

    if (rules.length === 0) return [];

    const ruleIds = rules.map((r: any) => r.rule_id);
    const placeholders = ruleIds.map(() => '?').join(', ');
    const conditionRows = await query(
      `SELECT * FROM validation_rule_conditions
       WHERE rule_type = 'expected_file' AND rule_id IN (${placeholders})
       ORDER BY rule_id, sort_order`,
      ruleIds
    ) as RowDataPacket[];

    // Group conditions by rule_id
    const conditionsByRule = new Map<number, ConditionRow[]>();
    for (const row of conditionRows as any[]) {
      const ruleId = row.rule_id;
      if (!conditionsByRule.has(ruleId)) conditionsByRule.set(ruleId, []);
      conditionsByRule.get(ruleId)!.push(row as ConditionRow);
    }

    return rules.map((r: any) => ({
      ...r,
      is_required: !!r.is_required,
      is_active: !!r.is_active,
      conditionRows: conditionsByRule.get(r.rule_id) || [],
    })) as RuleWithConditions[];
  }

  /**
   * Get only active rules with conditions (for validation-time evaluation)
   */
  async getActiveRulesWithConditions(): Promise<RuleWithConditions[]> {
    const all = await this.getAllRulesWithConditions();
    return all.filter(r => r.is_active);
  }

  /**
   * Save a rule with its condition tree (transactional)
   */
  async saveRuleWithConditions(
    ruleData: {
      rule_name: string;
      expected_filename: string;
      file_name_id: number | null;
      is_required: boolean;
      description: string | null;
      condition_type: RuleConditionType;
      condition_value: string;
    },
    conditionTree: ConditionNode | null
  ): Promise<number> {
    const result = await query(
      `INSERT INTO ai_file_expectation_rules
        (rule_name, condition_type, condition_value, expected_filename, file_name_id, is_required, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        ruleData.rule_name,
        ruleData.condition_type,
        ruleData.condition_value,
        ruleData.expected_filename,
        ruleData.file_name_id,
        ruleData.is_required,
        ruleData.description,
      ]
    ) as ResultSetHeader;

    const ruleId = result.insertId;

    if (conditionTree) {
      await this.insertConditionTree(ruleId, conditionTree);
    }

    return ruleId;
  }

  /**
   * Update a rule and replace its condition tree
   */
  async updateRuleWithConditions(
    ruleId: number,
    updates: {
      rule_name?: string;
      expected_filename?: string;
      file_name_id?: number | null;
      is_required?: boolean;
      description?: string | null;
      is_active?: boolean;
    },
    conditionTree?: ConditionNode | null
  ): Promise<void> {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.rule_name !== undefined) { updateFields.push('rule_name = ?'); params.push(updates.rule_name); }
    if (updates.expected_filename !== undefined) { updateFields.push('expected_filename = ?'); params.push(updates.expected_filename); }
    if (updates.file_name_id !== undefined) { updateFields.push('file_name_id = ?'); params.push(updates.file_name_id); }
    if (updates.is_required !== undefined) { updateFields.push('is_required = ?'); params.push(updates.is_required); }
    if (updates.description !== undefined) { updateFields.push('description = ?'); params.push(updates.description); }
    if (updates.is_active !== undefined) { updateFields.push('is_active = ?'); params.push(updates.is_active); }

    if (updateFields.length > 0) {
      params.push(ruleId);
      await query(
        `UPDATE ai_file_expectation_rules SET ${updateFields.join(', ')} WHERE rule_id = ?`,
        params
      );
    }

    // Replace condition tree if provided
    if (conditionTree !== undefined) {
      await query(
        `DELETE FROM validation_rule_conditions WHERE rule_type = 'expected_file' AND rule_id = ?`,
        [ruleId]
      );
      if (conditionTree) {
        await this.insertConditionTree(ruleId, conditionTree);
      }
    }
  }

  /**
   * Insert condition tree nodes for a rule
   */
  private async insertConditionTree(ruleId: number, tree: ConditionNode): Promise<void> {
    const flatRows = flattenConditionTree(tree, 'expected_file', ruleId);
    if (flatRows.length === 0) return;

    // Insert rows one by one to get auto-increment IDs for parent references
    const insertedIds: number[] = [];

    for (const row of flatRows) {
      // Map flat parent_id (index-based) to actual DB condition_id
      const parentId = row.parent_id !== null ? insertedIds[row.parent_id] : null;

      const result = await query(
        `INSERT INTO validation_rule_conditions
          (rule_type, rule_id, parent_id, node_type, logical_operator, field, operator, value, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.rule_type, row.rule_id, parentId, row.node_type,
          row.logical_operator, row.field, row.operator, row.value, row.sort_order,
        ]
      ) as ResultSetHeader;

      insertedIds.push(result.insertId);
    }
  }

  /**
   * Delete a rule and its conditions
   */
  async deleteRuleWithConditions(ruleId: number): Promise<void> {
    // Conditions cascade-delete via FK, but explicit for clarity
    await query(
      `DELETE FROM validation_rule_conditions WHERE rule_type = 'expected_file' AND rule_id = ?`,
      [ruleId]
    );
    await query('DELETE FROM ai_file_expectation_rules WHERE rule_id = ?', [ruleId]);
  }

  /**
   * Soft-delete (deactivate) a rule
   */
  async deactivateRule(ruleId: number): Promise<void> {
    await query(
      'UPDATE ai_file_expectation_rules SET is_active = FALSE WHERE rule_id = ?',
      [ruleId]
    );
  }

  // =============================================================================
  // STANDARD FILE NAMES CATALOG
  // =============================================================================

  async getStandardFileNames(includeInactive = false): Promise<StandardFileName[]> {
    const where = includeInactive ? '' : 'WHERE is_active = TRUE';
    const rows = await query(
      `SELECT * FROM standard_file_names ${where} ORDER BY display_order, name`
    ) as RowDataPacket[];
    return rows.map((r: any) => ({ ...r, is_active: !!r.is_active })) as StandardFileName[];
  }

  async createStandardFileName(data: {
    name: string;
    description?: string;
    category?: 'working_file' | 'cutting_file' | 'other';
  }): Promise<number> {
    const result = await query(
      `INSERT INTO standard_file_names (name, description, category)
       VALUES (?, ?, ?)`,
      [data.name, data.description || null, data.category || 'cutting_file']
    ) as ResultSetHeader;
    return result.insertId;
  }

  async updateStandardFileName(
    id: number,
    updates: { name?: string; description?: string; category?: string; is_active?: boolean }
  ): Promise<void> {
    const fields: string[] = [];
    const params: any[] = [];
    if (updates.name !== undefined) { fields.push('name = ?'); params.push(updates.name); }
    if (updates.description !== undefined) { fields.push('description = ?'); params.push(updates.description); }
    if (updates.category !== undefined) { fields.push('category = ?'); params.push(updates.category); }
    if (updates.is_active !== undefined) { fields.push('is_active = ?'); params.push(updates.is_active); }
    if (fields.length === 0) return;
    params.push(id);
    await query(`UPDATE standard_file_names SET ${fields.join(', ')} WHERE file_name_id = ?`, params);
  }

  // =============================================================================
  // CONDITION FIELD OPTIONS (for UI dropdowns)
  // =============================================================================

  async getSpecsDisplayNames(): Promise<string[]> {
    // specs_display_name values used in order_parts — pull distinct used + known values
    const rows = await query(
      `SELECT DISTINCT specs_display_name FROM order_parts
       WHERE specs_display_name IS NOT NULL AND specs_display_name != ''
       ORDER BY specs_display_name`
    ) as RowDataPacket[];
    const fromOrders = rows.map((r: any) => r.specs_display_name as string);

    // Also include known product types from the specs type mapper
    const known = [
      'Front Lit', 'Halo Lit', 'Front Lit Acrylic Face',
      'Dual Lit - Single Layer', 'Dual Lit - Double Layer',
      'Vinyl', 'LEDs', 'Power Supplies', 'Extra Wire', 'UL',
      '3D print', 'Blade Sign', 'Marquee Bulb', 'Neon LED',
      'Vinyl Cut', 'Front Lit Push Thru',
    ];

    const merged = Array.from(new Set([...known, ...fromOrders]));
    merged.sort();
    return merged;
  }

  async getApplicationValues(): Promise<string[]> {
    const rows = await query(
      `SELECT option_value FROM specification_options
       WHERE category = 'vinyl_applications' AND is_active = TRUE
       ORDER BY display_order`
    ) as RowDataPacket[];
    return rows.map((r: any) => r.option_value);
  }
}

export const fileExpectationRulesRepository = new FileExpectationRulesRepository();
