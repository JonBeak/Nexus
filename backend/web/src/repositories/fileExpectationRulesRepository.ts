/**
 * File Expectation Rules Repository
 * Data access layer for AI file expectation rules
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { FileExpectationRule, RuleConditionType } from '../types/aiFileValidation';

export class FileExpectationRulesRepository {
  /**
   * Get all active rules
   */
  async getAllActiveRules(): Promise<FileExpectationRule[]> {
    const rows = await query(
      `SELECT * FROM ai_file_expectation_rules
       WHERE is_active = TRUE
       ORDER BY condition_type, condition_value, expected_filename`
    ) as RowDataPacket[];

    return rows as FileExpectationRule[];
  }

  /**
   * Get rules by specific condition type and value
   */
  async getRulesByCondition(
    conditionType: RuleConditionType,
    conditionValue: string
  ): Promise<FileExpectationRule[]> {
    const rows = await query(
      `SELECT * FROM ai_file_expectation_rules
       WHERE is_active = TRUE
         AND condition_type = ?
         AND condition_value = ?
       ORDER BY expected_filename`,
      [conditionType, conditionValue]
    ) as RowDataPacket[];

    return rows as FileExpectationRule[];
  }

  /**
   * Get rules matching any of the provided condition values for a given type
   */
  async getRulesByConditionValues(
    conditionType: RuleConditionType,
    conditionValues: string[]
  ): Promise<FileExpectationRule[]> {
    if (conditionValues.length === 0) {
      return [];
    }

    const placeholders = conditionValues.map(() => '?').join(', ');
    const rows = await query(
      `SELECT * FROM ai_file_expectation_rules
       WHERE is_active = TRUE
         AND condition_type = ?
         AND condition_value IN (${placeholders})
       ORDER BY condition_value, expected_filename`,
      [conditionType, ...conditionValues]
    ) as RowDataPacket[];

    return rows as FileExpectationRule[];
  }

  /**
   * Create a new rule
   */
  async createRule(data: {
    rule_name: string;
    condition_type: RuleConditionType;
    condition_value: string;
    expected_filename: string;
    is_required?: boolean;
    description?: string;
  }): Promise<number> {
    const result = await query(
      `INSERT INTO ai_file_expectation_rules
        (rule_name, condition_type, condition_value, expected_filename, is_required, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.rule_name,
        data.condition_type,
        data.condition_value,
        data.expected_filename,
        data.is_required ?? true,
        data.description || null
      ]
    ) as ResultSetHeader;

    return result.insertId;
  }

  /**
   * Update an existing rule
   */
  async updateRule(
    ruleId: number,
    updates: Partial<{
      rule_name: string;
      condition_type: RuleConditionType;
      condition_value: string;
      expected_filename: string;
      is_required: boolean;
      description: string;
      is_active: boolean;
    }>
  ): Promise<void> {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.rule_name !== undefined) {
      updateFields.push('rule_name = ?');
      params.push(updates.rule_name);
    }
    if (updates.condition_type !== undefined) {
      updateFields.push('condition_type = ?');
      params.push(updates.condition_type);
    }
    if (updates.condition_value !== undefined) {
      updateFields.push('condition_value = ?');
      params.push(updates.condition_value);
    }
    if (updates.expected_filename !== undefined) {
      updateFields.push('expected_filename = ?');
      params.push(updates.expected_filename);
    }
    if (updates.is_required !== undefined) {
      updateFields.push('is_required = ?');
      params.push(updates.is_required);
    }
    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      params.push(updates.description);
    }
    if (updates.is_active !== undefined) {
      updateFields.push('is_active = ?');
      params.push(updates.is_active);
    }

    if (updateFields.length === 0) {
      return;
    }

    params.push(ruleId);

    await query(
      `UPDATE ai_file_expectation_rules SET ${updateFields.join(', ')} WHERE rule_id = ?`,
      params
    );
  }

  /**
   * Delete a rule (hard delete)
   */
  async deleteRule(ruleId: number): Promise<void> {
    await query(
      'DELETE FROM ai_file_expectation_rules WHERE rule_id = ?',
      [ruleId]
    );
  }

  /**
   * Soft delete (deactivate) a rule
   */
  async deactivateRule(ruleId: number): Promise<void> {
    await query(
      'UPDATE ai_file_expectation_rules SET is_active = FALSE WHERE rule_id = ?',
      [ruleId]
    );
  }

  /**
   * Get all rules (including inactive) for admin management
   */
  async getAllRules(): Promise<FileExpectationRule[]> {
    const rows = await query(
      `SELECT * FROM ai_file_expectation_rules
       ORDER BY is_active DESC, condition_type, condition_value, expected_filename`
    ) as RowDataPacket[];

    return rows as FileExpectationRule[];
  }

  /**
   * Get unique condition values currently in use
   */
  async getUniqueConditionValues(conditionType: RuleConditionType): Promise<string[]> {
    const rows = await query(
      `SELECT DISTINCT condition_value FROM ai_file_expectation_rules
       WHERE condition_type = ? AND is_active = TRUE
       ORDER BY condition_value`,
      [conditionType]
    ) as RowDataPacket[];

    return rows.map(row => row.condition_value);
  }
}

export const fileExpectationRulesRepository = new FileExpectationRulesRepository();
