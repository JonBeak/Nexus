/**
 * Settings Repository
 * Data access layer for settings tables
 *
 * Created: 2025-12-15
 * Part of Phase 3: Settings & Templates UI
 */

import { query } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import {
  TaskDefinition,
  ProductionRole,
  SpecificationOption,
  SpecificationCategory,
  PaintingMatrixEntry,
  EmailTemplate,
  SettingsCategory,
  SettingsAuditLogEntry,
  AuditLogEntryInput,
  AuditLogFilters
} from '../types/settings';

export class SettingsRepository {
  // ==========================================================================
  // Task Definitions
  // ==========================================================================

  async getAllTaskDefinitions(includeInactive = false): Promise<TaskDefinition[]> {
    const sql = includeInactive
      ? 'SELECT * FROM task_definitions ORDER BY display_order'
      : 'SELECT * FROM task_definitions WHERE is_active = TRUE ORDER BY display_order';
    return await query(sql) as TaskDefinition[];
  }

  async getTaskDefinitionById(taskId: number): Promise<TaskDefinition | null> {
    const rows = await query(
      'SELECT * FROM task_definitions WHERE task_id = ?',
      [taskId]
    ) as TaskDefinition[];
    return rows[0] || null;
  }

  async updateTaskOrder(orders: Array<{ task_id: number; display_order: number }>): Promise<void> {
    for (const item of orders) {
      await query(
        'UPDATE task_definitions SET display_order = ? WHERE task_id = ?',
        [item.display_order, item.task_id]
      );
    }
  }

  async updateTaskRole(taskId: number, assignedRole: string): Promise<void> {
    await query(
      'UPDATE task_definitions SET assigned_role = ? WHERE task_id = ?',
      [assignedRole, taskId]
    );
  }

  async createTaskDefinition(data: {
    task_name: string;
    task_key: string;
    display_order: number;
    assigned_role: string;
    is_active?: boolean;
    is_system?: boolean;
    description?: string | null;
  }): Promise<number> {
    const result = await query(
      `INSERT INTO task_definitions (task_name, task_key, display_order, assigned_role, is_active, is_system, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.task_name,
        data.task_key,
        data.display_order,
        data.assigned_role,
        data.is_active ?? true,
        data.is_system ?? false,
        data.description ?? null
      ]
    ) as ResultSetHeader;
    return result.insertId;
  }

  async updateTaskDefinition(taskId: number, updates: {
    task_name?: string;
    assigned_role?: string;
    description?: string;
    is_active?: boolean;
  }): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.task_name !== undefined) {
      fields.push('task_name = ?');
      values.push(updates.task_name);
    }
    if (updates.assigned_role !== undefined) {
      fields.push('assigned_role = ?');
      values.push(updates.assigned_role);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active);
    }

    if (fields.length === 0) return;

    values.push(taskId);
    await query(`UPDATE task_definitions SET ${fields.join(', ')} WHERE task_id = ?`, values);
  }

  async getMaxTaskDisplayOrder(): Promise<number> {
    const rows = await query(
      'SELECT MAX(display_order) as max_order FROM task_definitions'
    ) as RowDataPacket[];
    return rows[0]?.max_order ?? 0;
  }

  // ==========================================================================
  // Production Roles
  // ==========================================================================

  async getAllProductionRoles(includeInactive = false): Promise<ProductionRole[]> {
    const sql = includeInactive
      ? 'SELECT * FROM production_roles ORDER BY display_order'
      : 'SELECT * FROM production_roles WHERE is_active = TRUE ORDER BY display_order';
    return await query(sql) as ProductionRole[];
  }

  async getProductionRoleById(roleId: number): Promise<ProductionRole | null> {
    const rows = await query(
      'SELECT * FROM production_roles WHERE role_id = ?',
      [roleId]
    ) as ProductionRole[];
    return rows[0] || null;
  }

  async getProductionRoleByKey(roleKey: string): Promise<ProductionRole | null> {
    const rows = await query(
      'SELECT * FROM production_roles WHERE role_key = ?',
      [roleKey]
    ) as ProductionRole[];
    return rows[0] || null;
  }

  async updateProductionRole(roleId: number, updates: Partial<ProductionRole>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.display_name !== undefined) {
      fields.push('display_name = ?');
      values.push(updates.display_name);
    }
    if (updates.display_order !== undefined) {
      fields.push('display_order = ?');
      values.push(updates.display_order);
    }
    if (updates.color_hex !== undefined) {
      fields.push('color_hex = ?');
      values.push(updates.color_hex);
    }
    if (updates.color_bg_class !== undefined) {
      fields.push('color_bg_class = ?');
      values.push(updates.color_bg_class);
    }
    if (updates.color_text_class !== undefined) {
      fields.push('color_text_class = ?');
      values.push(updates.color_text_class);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    if (fields.length === 0) return;

    values.push(roleId);
    await query(`UPDATE production_roles SET ${fields.join(', ')} WHERE role_id = ?`, values);
  }

  async updateRoleOrder(orders: Array<{ role_id: number; display_order: number }>): Promise<void> {
    for (const item of orders) {
      await query(
        'UPDATE production_roles SET display_order = ? WHERE role_id = ?',
        [item.display_order, item.role_id]
      );
    }
  }

  async createProductionRole(data: {
    role_key: string;
    display_name: string;
    display_order: number;
    color_hex?: string;
    color_bg_class?: string;
    color_text_class?: string;
    is_system?: boolean;
    description?: string | null;
  }): Promise<number> {
    const result = await query(
      `INSERT INTO production_roles (role_key, display_name, display_order, color_hex, color_bg_class, color_text_class, is_system, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.role_key,
        data.display_name,
        data.display_order,
        data.color_hex ?? '#6B7280',
        data.color_bg_class ?? 'bg-gray-100',
        data.color_text_class ?? 'text-gray-800',
        data.is_system ?? false,
        data.description ?? null
      ]
    ) as ResultSetHeader;
    return result.insertId;
  }

  async getMaxRoleDisplayOrder(): Promise<number> {
    const rows = await query(
      'SELECT MAX(display_order) as max_order FROM production_roles'
    ) as RowDataPacket[];
    return rows[0]?.max_order ?? 0;
  }

  // ==========================================================================
  // Specification Options
  // ==========================================================================

  async getSpecificationCategories(): Promise<SpecificationCategory[]> {
    return await query(`
      SELECT category, category_display_name, COUNT(*) as count
      FROM specification_options
      WHERE is_active = TRUE
      GROUP BY category, category_display_name
      ORDER BY category_display_name
    `) as SpecificationCategory[];
  }

  async getSpecificationOptionsByCategory(category: string, includeInactive = false): Promise<SpecificationOption[]> {
    const sql = includeInactive
      ? 'SELECT * FROM specification_options WHERE category = ? ORDER BY display_order'
      : 'SELECT * FROM specification_options WHERE category = ? AND is_active = TRUE ORDER BY display_order';
    return await query(sql, [category]) as SpecificationOption[];
  }

  async getSpecificationOptionById(optionId: number): Promise<SpecificationOption | null> {
    const rows = await query(
      'SELECT * FROM specification_options WHERE option_id = ?',
      [optionId]
    ) as SpecificationOption[];
    return rows[0] || null;
  }

  async createSpecificationOption(data: {
    category: string;
    category_display_name: string;
    option_value: string;
    option_key: string;
    display_order: number;
    is_active?: boolean;
    is_system?: boolean;
    metadata?: Record<string, unknown> | null;
  }): Promise<number> {
    const result = await query(
      `INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_active, is_system, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.category,
        data.category_display_name,
        data.option_value,
        data.option_key,
        data.display_order,
        data.is_active ?? true,
        data.is_system ?? false,
        data.metadata ? JSON.stringify(data.metadata) : null
      ]
    ) as ResultSetHeader;
    return result.insertId;
  }

  async updateSpecificationOption(optionId: number, updates: {
    option_value?: string;
    display_order?: number;
    is_active?: boolean;
  }): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.option_value !== undefined) {
      fields.push('option_value = ?');
      values.push(updates.option_value);
    }
    if (updates.display_order !== undefined) {
      fields.push('display_order = ?');
      values.push(updates.display_order);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active);
    }

    if (fields.length === 0) return;

    values.push(optionId);
    await query(`UPDATE specification_options SET ${fields.join(', ')} WHERE option_id = ?`, values);
  }

  async updateSpecificationOptionsOrder(orders: Array<{ option_id: number; display_order: number }>): Promise<void> {
    for (const item of orders) {
      await query(
        'UPDATE specification_options SET display_order = ? WHERE option_id = ?',
        [item.display_order, item.option_id]
      );
    }
  }

  async getMaxOptionDisplayOrder(category: string): Promise<number> {
    const rows = await query(
      'SELECT MAX(display_order) as max_order FROM specification_options WHERE category = ?',
      [category]
    ) as RowDataPacket[];
    return rows[0]?.max_order ?? 0;
  }

  async getCategoryDisplayName(category: string): Promise<string | null> {
    const rows = await query(
      'SELECT category_display_name FROM specification_options WHERE category = ? LIMIT 1',
      [category]
    ) as RowDataPacket[];
    return rows[0]?.category_display_name ?? null;
  }

  // ==========================================================================
  // Painting Task Matrix
  // ==========================================================================

  async getPaintingMatrixByProductType(productTypeKey: string): Promise<PaintingMatrixEntry[]> {
    return await query(
      'SELECT * FROM painting_task_matrix WHERE product_type_key = ? AND is_active = TRUE ORDER BY component_key, timing_key',
      [productTypeKey]
    ) as PaintingMatrixEntry[];
  }

  async getAllPaintingMatrixProductTypes(): Promise<Array<{ product_type: string; product_type_key: string }>> {
    return await query(`
      SELECT DISTINCT product_type, product_type_key
      FROM painting_task_matrix
      WHERE is_active = TRUE
      ORDER BY product_type
    `) as Array<{ product_type: string; product_type_key: string }>;
  }

  async getPaintingMatrixEntryById(matrixId: number): Promise<PaintingMatrixEntry | null> {
    const rows = await query(
      'SELECT * FROM painting_task_matrix WHERE matrix_id = ?',
      [matrixId]
    ) as PaintingMatrixEntry[];
    return rows[0] || null;
  }

  async updatePaintingMatrixEntry(
    matrixId: number,
    taskNumbers: number[] | null,
    updatedBy: number
  ): Promise<void> {
    await query(
      'UPDATE painting_task_matrix SET task_numbers = ?, updated_by = ? WHERE matrix_id = ?',
      [taskNumbers ? JSON.stringify(taskNumbers) : null, updatedBy, matrixId]
    );
  }

  // ==========================================================================
  // Email Templates (uses existing schema from Phase 2.e)
  // ==========================================================================

  async getAllEmailTemplates(): Promise<EmailTemplate[]> {
    const rows = await query(
      'SELECT * FROM email_templates WHERE is_active = TRUE ORDER BY template_name'
    ) as RowDataPacket[];
    // Parse JSON fields
    return rows.map(row => ({
      ...row,
      variables: typeof row.variables === 'string'
        ? JSON.parse(row.variables)
        : row.variables
    })) as EmailTemplate[];
  }

  async getEmailTemplateByKey(templateKey: string): Promise<EmailTemplate | null> {
    const rows = await query(
      'SELECT * FROM email_templates WHERE template_key = ?',
      [templateKey]
    ) as RowDataPacket[];
    if (!rows[0]) return null;
    return {
      ...rows[0],
      variables: typeof rows[0].variables === 'string'
        ? JSON.parse(rows[0].variables)
        : rows[0].variables
    } as EmailTemplate;
  }

  async updateEmailTemplate(
    templateKey: string,
    subject: string,
    body: string,
    _updatedBy: number
  ): Promise<void> {
    await query(
      'UPDATE email_templates SET subject = ?, body = ? WHERE template_key = ?',
      [subject, body, templateKey]
    );
  }

  // ==========================================================================
  // Settings Categories
  // ==========================================================================

  async getSettingsCategories(userRole: string): Promise<SettingsCategory[]> {
    // Owner sees all, manager sees only manager-level categories
    const sql = userRole === 'owner'
      ? 'SELECT * FROM settings_categories WHERE is_active = TRUE ORDER BY display_order'
      : 'SELECT * FROM settings_categories WHERE is_active = TRUE AND required_role = ? ORDER BY display_order';
    const params = userRole === 'owner' ? [] : [userRole];
    return await query(sql, params) as SettingsCategory[];
  }

  // ==========================================================================
  // Settings Audit Log
  // ==========================================================================

  async createAuditLogEntry(entry: AuditLogEntryInput): Promise<void> {
    await query(
      `INSERT INTO settings_audit_log (table_name, record_id, action, old_values, new_values, change_summary, changed_by, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.table_name,
        entry.record_id,
        entry.action,
        entry.old_values ? JSON.stringify(entry.old_values) : null,
        entry.new_values ? JSON.stringify(entry.new_values) : null,
        entry.change_summary,
        entry.changed_by,
        entry.ip_address || null
      ]
    );
  }

  async getAuditLog(filters: AuditLogFilters = {}): Promise<SettingsAuditLogEntry[]> {
    const { tableName, userId, limit = 50, offset = 0 } = filters;

    let sql = `
      SELECT sal.*, e.first_name, e.last_name
      FROM settings_audit_log sal
      LEFT JOIN employees e ON sal.changed_by = e.employee_id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (tableName) {
      conditions.push('sal.table_name = ?');
      params.push(tableName);
    }
    if (userId) {
      conditions.push('sal.changed_by = ?');
      params.push(userId);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY sal.changed_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await query(sql, params) as RowDataPacket[];
    // Parse JSON fields
    return rows.map(row => ({
      ...row,
      old_values: typeof row.old_values === 'string' ? JSON.parse(row.old_values) : row.old_values,
      new_values: typeof row.new_values === 'string' ? JSON.parse(row.new_values) : row.new_values
    })) as SettingsAuditLogEntry[];
  }
}

// Export singleton instance
export const settingsRepository = new SettingsRepository();
