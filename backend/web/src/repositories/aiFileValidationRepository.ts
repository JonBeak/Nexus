/**
 * AI File Validation Repository
 * Data access layer for AI file validation records and rules
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
  AiFileValidationRecord,
  AiValidationRule,
  ValidationStatus,
  ValidationIssue,
  ValidationStats,
} from '../types/aiFileValidation';

export class AiFileValidationRepository {
  /**
   * Create a new validation record
   */
  async createValidation(data: {
    order_id: number;
    order_number: number;
    file_path: string;
    file_name: string;
  }): Promise<number> {
    const result = await query(
      `INSERT INTO ai_file_validations
       (order_id, order_number, file_path, file_name, validation_status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [data.order_id, data.order_number, data.file_path, data.file_name]
    ) as ResultSetHeader;

    return result.insertId;
  }

  /**
   * Update validation result
   */
  async updateValidationResult(
    validationId: number,
    data: {
      status: ValidationStatus;
      issues: ValidationIssue[];
      stats: ValidationStats;
      validated_by: number;
    }
  ): Promise<void> {
    await query(
      `UPDATE ai_file_validations
       SET validation_status = ?,
           issues = ?,
           stats = ?,
           validated_at = NOW(),
           validated_by = ?
       WHERE validation_id = ?`,
      [
        data.status,
        JSON.stringify(data.issues),
        JSON.stringify(data.stats),
        data.validated_by,
        validationId,
      ]
    );
  }

  /**
   * Mark validation as approved
   */
  async approveValidation(validationId: number, userId: number): Promise<void> {
    await query(
      `UPDATE ai_file_validations
       SET approved_at = NOW(), approved_by = ?
       WHERE validation_id = ?`,
      [userId, validationId]
    );
  }

  /**
   * Approve all validations for an order
   */
  async approveAllForOrder(orderNumber: number, userId: number): Promise<number> {
    const result = await query(
      `UPDATE ai_file_validations
       SET approved_at = NOW(), approved_by = ?
       WHERE order_number = ? AND approved_at IS NULL`,
      [userId, orderNumber]
    ) as ResultSetHeader;

    return result.affectedRows;
  }

  /**
   * Get validation record by ID
   */
  async getById(validationId: number): Promise<AiFileValidationRecord | null> {
    const rows = await query(
      `SELECT * FROM ai_file_validations WHERE validation_id = ?`,
      [validationId]
    ) as RowDataPacket[];

    if (rows.length === 0) return null;

    return this.parseValidationRecord(rows[0]);
  }

  /**
   * Get validation by file path and order
   */
  async getByFileAndOrder(
    orderNumber: number,
    filePath: string
  ): Promise<AiFileValidationRecord | null> {
    const rows = await query(
      `SELECT * FROM ai_file_validations
       WHERE order_number = ? AND file_path = ?
       ORDER BY validation_id DESC LIMIT 1`,
      [orderNumber, filePath]
    ) as RowDataPacket[];

    if (rows.length === 0) return null;

    return this.parseValidationRecord(rows[0]);
  }

  /**
   * Get all validations for an order
   */
  async getByOrderNumber(orderNumber: number): Promise<AiFileValidationRecord[]> {
    const rows = await query(
      `SELECT * FROM ai_file_validations
       WHERE order_number = ?
       ORDER BY file_name ASC`,
      [orderNumber]
    ) as RowDataPacket[];

    return rows.map((row) => this.parseValidationRecord(row));
  }

  /**
   * Get latest validation for each file in an order
   * Using simpler query that doesn't require sorting large VARCHAR columns
   */
  async getLatestByOrderNumber(orderNumber: number): Promise<AiFileValidationRecord[]> {
    // Simpler approach: get all validations for the order, then dedupe in code
    // This avoids the GROUP BY on VARCHAR(500) which causes sort memory issues
    const rows = await query(
      `SELECT * FROM ai_file_validations
       WHERE order_number = ?
       ORDER BY validation_id DESC`,
      [orderNumber]
    ) as RowDataPacket[];

    // Keep only the latest validation per file_path (first occurrence since sorted DESC)
    const seen = new Set<string>();
    const latest: AiFileValidationRecord[] = [];

    for (const row of rows) {
      if (!seen.has(row.file_path)) {
        seen.add(row.file_path);
        latest.push(this.parseValidationRecord(row));
      }
    }

    // Sort by file_name for consistent display
    latest.sort((a, b) => a.file_name.localeCompare(b.file_name));

    return latest;
  }

  /**
   * Delete old validation records for a file (keep latest)
   */
  async deleteOldValidations(orderNumber: number, filePath: string): Promise<void> {
    await query(
      `DELETE FROM ai_file_validations
       WHERE order_number = ? AND file_path = ?
       AND validation_id NOT IN (
         SELECT * FROM (
           SELECT MAX(validation_id)
           FROM ai_file_validations
           WHERE order_number = ? AND file_path = ?
         ) as t
       )`,
      [orderNumber, filePath, orderNumber, filePath]
    );
  }

  /**
   * Get all active validation rules
   */
  async getActiveRules(): Promise<AiValidationRule[]> {
    const rows = await query(
      `SELECT * FROM ai_validation_rules WHERE is_active = TRUE ORDER BY rule_id ASC`
    ) as RowDataPacket[];

    return rows.map((row) => this.parseRuleRecord(row));
  }

  /**
   * Get rules by type
   */
  async getRulesByType(ruleType: string): Promise<AiValidationRule[]> {
    const rows = await query(
      `SELECT * FROM ai_validation_rules
       WHERE rule_type = ? AND is_active = TRUE
       ORDER BY rule_id ASC`,
      [ruleType]
    ) as RowDataPacket[];

    return rows.map((row) => this.parseRuleRecord(row));
  }

  /**
   * Get rule by name
   */
  async getRuleByName(ruleName: string): Promise<AiValidationRule | null> {
    const rows = await query(
      `SELECT * FROM ai_validation_rules WHERE rule_name = ?`,
      [ruleName]
    ) as RowDataPacket[];

    if (rows.length === 0) return null;

    return this.parseRuleRecord(rows[0]);
  }

  /**
   * Update rule configuration
   */
  async updateRule(
    ruleId: number,
    data: Partial<{
      rule_config: Record<string, any>;
      severity: string;
      is_active: boolean;
      description: string;
    }>
  ): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.rule_config !== undefined) {
      updates.push('rule_config = ?');
      params.push(JSON.stringify(data.rule_config));
    }
    if (data.severity !== undefined) {
      updates.push('severity = ?');
      params.push(data.severity);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(data.is_active);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }

    if (updates.length === 0) return;

    params.push(ruleId);
    await query(
      `UPDATE ai_validation_rules SET ${updates.join(', ')} WHERE rule_id = ?`,
      params
    );
  }

  /**
   * Parse database row to validation record
   */
  private parseValidationRecord(row: RowDataPacket): AiFileValidationRecord {
    // Handle JSON fields - MySQL may return as object or string depending on driver
    const parseJsonField = (field: any) => {
      if (!field) return null;
      if (typeof field === 'object') return field;
      if (typeof field === 'string') return JSON.parse(field);
      return null;
    };

    return {
      validation_id: row.validation_id,
      order_id: row.order_id,
      order_number: row.order_number,
      file_path: row.file_path,
      file_name: row.file_name,
      validation_status: row.validation_status,
      validated_at: row.validated_at,
      validated_by: row.validated_by,
      approved_at: row.approved_at,
      approved_by: row.approved_by,
      issues: parseJsonField(row.issues),
      stats: parseJsonField(row.stats),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Parse database row to rule record
   */
  private parseRuleRecord(row: RowDataPacket): AiValidationRule {
    return {
      rule_id: row.rule_id,
      rule_name: row.rule_name,
      rule_type: row.rule_type,
      rule_config: typeof row.rule_config === 'string'
        ? JSON.parse(row.rule_config)
        : row.rule_config,
      severity: row.severity,
      is_active: Boolean(row.is_active),
      applies_to: row.applies_to,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const aiFileValidationRepository = new AiFileValidationRepository();
