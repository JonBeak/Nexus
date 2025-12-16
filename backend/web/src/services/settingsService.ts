/**
 * Settings Service
 * Business logic layer for settings management
 *
 * Created: 2025-12-15
 * Part of Phase 3: Settings & Templates UI
 */

import { settingsRepository } from '../repositories/settingsRepository';
import { ServiceResult } from '../types/serviceResults';
import {
  TaskDefinition,
  ProductionRole,
  SpecificationOption,
  SpecificationCategory,
  PaintingMatrixEntry,
  EmailTemplate,
  SettingsCategory,
  AuditLogFilters,
  AuditLogResponse
} from '../types/settings';

// =============================================================================
// Helper: Generate key from display name
// =============================================================================
function generateKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// =============================================================================
// Helper: Log audit entry
// =============================================================================
async function logAudit(
  tableName: string,
  recordId: number,
  action: 'create' | 'update' | 'delete' | 'restore',
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
  summary: string,
  userId: number
): Promise<void> {
  try {
    await settingsRepository.createAuditLogEntry({
      table_name: tableName,
      record_id: recordId,
      action,
      old_values: oldValues,
      new_values: newValues,
      change_summary: summary,
      changed_by: userId
    });
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    // Don't throw - audit logging should not fail the main operation
  }
}

export class SettingsService {
  // ==========================================================================
  // Task Configuration
  // ==========================================================================

  async getTaskConfiguration(includeInactive = false): Promise<ServiceResult<TaskDefinition[]>> {
    try {
      const tasks = await settingsRepository.getAllTaskDefinitions(includeInactive);
      return { success: true, data: tasks };
    } catch (error) {
      console.error('Error fetching task configuration:', error);
      return { success: false, error: 'Failed to fetch task configuration', code: 'FETCH_ERROR' };
    }
  }

  async updateTaskOrder(
    orders: Array<{ task_id: number; display_order: number }>,
    userId: number
  ): Promise<ServiceResult<void>> {
    try {
      await settingsRepository.updateTaskOrder(orders);
      await logAudit('task_definitions', 0, 'update', null, { orders }, 'Reordered tasks', userId);
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error updating task order:', error);
      return { success: false, error: 'Failed to update task order', code: 'UPDATE_ERROR' };
    }
  }

  async updateTaskRole(
    taskId: number,
    assignedRole: string,
    userId: number
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await settingsRepository.getTaskDefinitionById(taskId);
      if (!existing) {
        return { success: false, error: 'Task not found', code: 'NOT_FOUND' };
      }

      const oldRole = existing.assigned_role;
      await settingsRepository.updateTaskRole(taskId, assignedRole);
      await logAudit(
        'task_definitions',
        taskId,
        'update',
        { assigned_role: oldRole },
        { assigned_role: assignedRole },
        `Changed role for "${existing.task_name}" from ${oldRole} to ${assignedRole}`,
        userId
      );
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error updating task role:', error);
      return { success: false, error: 'Failed to update task role', code: 'UPDATE_ERROR' };
    }
  }

  async createTask(
    data: { task_name: string; assigned_role: string; description?: string },
    userId: number
  ): Promise<ServiceResult<number>> {
    try {
      const maxOrder = await settingsRepository.getMaxTaskDisplayOrder();
      const taskKey = generateKey(data.task_name);

      const taskId = await settingsRepository.createTaskDefinition({
        task_name: data.task_name,
        task_key: taskKey,
        display_order: maxOrder + 1,
        assigned_role: data.assigned_role,
        is_active: true,
        is_system: false,
        description: data.description || null
      });

      await logAudit(
        'task_definitions',
        taskId,
        'create',
        null,
        { task_name: data.task_name, assigned_role: data.assigned_role },
        `Created task "${data.task_name}"`,
        userId
      );

      return { success: true, data: taskId };
    } catch (error) {
      console.error('Error creating task:', error);
      return { success: false, error: 'Failed to create task', code: 'CREATE_ERROR' };
    }
  }

  async updateTask(
    taskId: number,
    updates: { task_name?: string; assigned_role?: string; description?: string; is_active?: boolean },
    userId: number
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await settingsRepository.getTaskDefinitionById(taskId);
      if (!existing) {
        return { success: false, error: 'Task not found', code: 'NOT_FOUND' };
      }

      await settingsRepository.updateTaskDefinition(taskId, updates);
      await logAudit(
        'task_definitions',
        taskId,
        'update',
        { task_name: existing.task_name, assigned_role: existing.assigned_role },
        updates,
        `Updated task "${existing.task_name}"`,
        userId
      );

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error updating task:', error);
      return { success: false, error: 'Failed to update task', code: 'UPDATE_ERROR' };
    }
  }

  // ==========================================================================
  // Production Roles
  // ==========================================================================

  async getProductionRoles(includeInactive = false): Promise<ServiceResult<ProductionRole[]>> {
    try {
      const roles = await settingsRepository.getAllProductionRoles(includeInactive);
      return { success: true, data: roles };
    } catch (error) {
      console.error('Error fetching production roles:', error);
      return { success: false, error: 'Failed to fetch production roles', code: 'FETCH_ERROR' };
    }
  }

  async updateProductionRole(
    roleId: number,
    updates: Partial<ProductionRole>,
    userId: number
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await settingsRepository.getProductionRoleById(roleId);
      if (!existing) {
        return { success: false, error: 'Role not found', code: 'NOT_FOUND' };
      }

      await settingsRepository.updateProductionRole(roleId, updates);
      await logAudit(
        'production_roles',
        roleId,
        'update',
        { display_name: existing.display_name, color_hex: existing.color_hex },
        updates,
        `Updated role "${existing.display_name}"`,
        userId
      );

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error updating production role:', error);
      return { success: false, error: 'Failed to update production role', code: 'UPDATE_ERROR' };
    }
  }

  async reorderProductionRoles(
    orders: Array<{ role_id: number; display_order: number }>,
    userId: number
  ): Promise<ServiceResult<void>> {
    try {
      await settingsRepository.updateRoleOrder(orders);
      await logAudit('production_roles', 0, 'update', null, { orders }, 'Reordered roles', userId);
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error reordering production roles:', error);
      return { success: false, error: 'Failed to reorder production roles', code: 'UPDATE_ERROR' };
    }
  }

  async createProductionRole(
    data: { role_key: string; display_name: string; color_hex?: string; color_bg_class?: string; color_text_class?: string; description?: string },
    userId: number
  ): Promise<ServiceResult<number>> {
    try {
      // Check if role_key already exists
      const existing = await settingsRepository.getProductionRoleByKey(data.role_key);
      if (existing) {
        return { success: false, error: 'Role key already exists', code: 'DUPLICATE_KEY' };
      }

      const maxOrder = await settingsRepository.getMaxRoleDisplayOrder();
      const roleId = await settingsRepository.createProductionRole({
        ...data,
        display_order: maxOrder + 1,
        is_system: false
      });

      await logAudit(
        'production_roles',
        roleId,
        'create',
        null,
        data,
        `Created role "${data.display_name}"`,
        userId
      );

      return { success: true, data: roleId };
    } catch (error) {
      console.error('Error creating production role:', error);
      return { success: false, error: 'Failed to create production role', code: 'CREATE_ERROR' };
    }
  }

  // ==========================================================================
  // Specification Options
  // ==========================================================================

  async getSpecificationCategories(): Promise<ServiceResult<SpecificationCategory[]>> {
    try {
      const categories = await settingsRepository.getSpecificationCategories();
      return { success: true, data: categories };
    } catch (error) {
      console.error('Error fetching specification categories:', error);
      return { success: false, error: 'Failed to fetch specification categories', code: 'FETCH_ERROR' };
    }
  }

  async getOptionsForCategory(category: string, includeInactive = false): Promise<ServiceResult<SpecificationOption[]>> {
    try {
      const options = await settingsRepository.getSpecificationOptionsByCategory(category, includeInactive);
      return { success: true, data: options };
    } catch (error) {
      console.error('Error fetching options for category:', error);
      return { success: false, error: 'Failed to fetch options', code: 'FETCH_ERROR' };
    }
  }

  async createOption(
    category: string,
    data: { option_value: string; display_order?: number },
    userId: number
  ): Promise<ServiceResult<number>> {
    try {
      // Get category display name from existing options
      const categoryDisplayName = await settingsRepository.getCategoryDisplayName(category);
      if (!categoryDisplayName) {
        return { success: false, error: 'Invalid category', code: 'INVALID_CATEGORY' };
      }

      const displayOrder = data.display_order ?? (await settingsRepository.getMaxOptionDisplayOrder(category) + 1);
      const optionKey = generateKey(data.option_value);

      const optionId = await settingsRepository.createSpecificationOption({
        category,
        category_display_name: categoryDisplayName,
        option_value: data.option_value,
        option_key: optionKey,
        display_order: displayOrder,
        is_active: true,
        is_system: false
      });

      await logAudit(
        'specification_options',
        optionId,
        'create',
        null,
        { category, option_value: data.option_value },
        `Added "${data.option_value}" to ${categoryDisplayName}`,
        userId
      );

      return { success: true, data: optionId };
    } catch (error) {
      console.error('Error creating option:', error);
      return { success: false, error: 'Failed to create option', code: 'CREATE_ERROR' };
    }
  }

  async updateOption(
    optionId: number,
    updates: { option_value?: string; is_active?: boolean },
    userId: number
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await settingsRepository.getSpecificationOptionById(optionId);
      if (!existing) {
        return { success: false, error: 'Option not found', code: 'NOT_FOUND' };
      }

      // Prevent deactivating system options
      if (updates.is_active === false && existing.is_system) {
        return { success: false, error: 'Cannot deactivate system options', code: 'SYSTEM_OPTION' };
      }

      await settingsRepository.updateSpecificationOption(optionId, updates);
      await logAudit(
        'specification_options',
        optionId,
        'update',
        { option_value: existing.option_value, is_active: existing.is_active },
        updates,
        `Updated option "${existing.option_value}" in ${existing.category_display_name}`,
        userId
      );

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error updating option:', error);
      return { success: false, error: 'Failed to update option', code: 'UPDATE_ERROR' };
    }
  }

  async reorderOptions(
    category: string,
    orders: Array<{ option_id: number; display_order: number }>,
    userId: number
  ): Promise<ServiceResult<void>> {
    try {
      await settingsRepository.updateSpecificationOptionsOrder(orders);
      await logAudit(
        'specification_options',
        0,
        'update',
        null,
        { category, orders },
        `Reordered options in ${category}`,
        userId
      );
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error reordering options:', error);
      return { success: false, error: 'Failed to reorder options', code: 'UPDATE_ERROR' };
    }
  }

  async deactivateOption(optionId: number, userId: number): Promise<ServiceResult<void>> {
    return this.updateOption(optionId, { is_active: false }, userId);
  }

  // ==========================================================================
  // Painting Matrix
  // ==========================================================================

  async getMatrixForProductType(productTypeKey: string): Promise<ServiceResult<PaintingMatrixEntry[]>> {
    try {
      const entries = await settingsRepository.getPaintingMatrixByProductType(productTypeKey);
      return { success: true, data: entries };
    } catch (error) {
      console.error('Error fetching painting matrix:', error);
      return { success: false, error: 'Failed to fetch painting matrix', code: 'FETCH_ERROR' };
    }
  }

  async getAvailableProductTypes(): Promise<ServiceResult<Array<{ product_type: string; product_type_key: string }>>> {
    try {
      const productTypes = await settingsRepository.getAllPaintingMatrixProductTypes();
      return { success: true, data: productTypes };
    } catch (error) {
      console.error('Error fetching product types:', error);
      return { success: false, error: 'Failed to fetch product types', code: 'FETCH_ERROR' };
    }
  }

  async updateMatrixCell(
    matrixId: number,
    taskNumbers: number[] | null,
    userId: number
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await settingsRepository.getPaintingMatrixEntryById(matrixId);
      if (!existing) {
        return { success: false, error: 'Matrix entry not found', code: 'NOT_FOUND' };
      }

      await settingsRepository.updatePaintingMatrixEntry(matrixId, taskNumbers, userId);
      await logAudit(
        'painting_task_matrix',
        matrixId,
        'update',
        { task_numbers: existing.task_numbers },
        { task_numbers: taskNumbers },
        `Updated ${existing.product_type} - ${existing.component}/${existing.timing}`,
        userId
      );

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error updating matrix cell:', error);
      return { success: false, error: 'Failed to update matrix cell', code: 'UPDATE_ERROR' };
    }
  }

  // ==========================================================================
  // Email Templates
  // ==========================================================================

  async getAllTemplates(): Promise<ServiceResult<EmailTemplate[]>> {
    try {
      const templates = await settingsRepository.getAllEmailTemplates();
      return { success: true, data: templates };
    } catch (error) {
      console.error('Error fetching email templates:', error);
      return { success: false, error: 'Failed to fetch email templates', code: 'FETCH_ERROR' };
    }
  }

  async getTemplate(templateKey: string): Promise<ServiceResult<EmailTemplate>> {
    try {
      const template = await settingsRepository.getEmailTemplateByKey(templateKey);
      if (!template) {
        return { success: false, error: 'Template not found', code: 'NOT_FOUND' };
      }
      return { success: true, data: template };
    } catch (error) {
      console.error('Error fetching email template:', error);
      return { success: false, error: 'Failed to fetch email template', code: 'FETCH_ERROR' };
    }
  }

  async updateTemplate(
    templateKey: string,
    subject: string,
    body: string,
    userId: number
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await settingsRepository.getEmailTemplateByKey(templateKey);
      if (!existing) {
        return { success: false, error: 'Template not found', code: 'NOT_FOUND' };
      }

      await settingsRepository.updateEmailTemplate(templateKey, subject, body, userId);
      await logAudit(
        'email_templates',
        existing.id,
        'update',
        { subject: existing.subject, body: existing.body },
        { subject, body },
        `Updated template "${existing.template_name}"`,
        userId
      );

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error updating email template:', error);
      return { success: false, error: 'Failed to update email template', code: 'UPDATE_ERROR' };
    }
  }

  async previewTemplate(
    templateKey: string,
    subject: string,
    body: string
  ): Promise<ServiceResult<{ renderedSubject: string; renderedBody: string }>> {
    try {
      const template = await settingsRepository.getEmailTemplateByKey(templateKey);
      if (!template) {
        return { success: false, error: 'Template not found', code: 'NOT_FOUND' };
      }

      // Sample data for preview (uses template.variables if available)
      const sampleData: Record<string, string> = {
        orderNumber: '200543',
        orderName: 'Sample Channel Letters',
        customerName: 'ABC Sign Company',
        pointPersonName: 'John Smith',
        invoiceTotal: '$4,250.00',
        depositAmount: '$2,125.00',
        dueDate: 'December 31, 2025',
        qbInvoiceUrl: 'https://qbo.intuit.com/app/invoice?txnId=12345'
      };

      // Replace variables in subject and body
      let renderedSubject = subject;
      let renderedBody = body;

      for (const [key, value] of Object.entries(sampleData)) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        renderedSubject = renderedSubject.replace(regex, value);
        renderedBody = renderedBody.replace(regex, value);
      }

      return { success: true, data: { renderedSubject, renderedBody } };
    } catch (error) {
      console.error('Error previewing email template:', error);
      return { success: false, error: 'Failed to preview email template', code: 'PREVIEW_ERROR' };
    }
  }

  // ==========================================================================
  // Settings Categories
  // ==========================================================================

  async getSettingsCategories(userRole: string): Promise<ServiceResult<SettingsCategory[]>> {
    try {
      const categories = await settingsRepository.getSettingsCategories(userRole);
      return { success: true, data: categories };
    } catch (error) {
      console.error('Error fetching settings categories:', error);
      return { success: false, error: 'Failed to fetch settings categories', code: 'FETCH_ERROR' };
    }
  }

  // ==========================================================================
  // Audit Log
  // ==========================================================================

  async getAuditLog(filters: AuditLogFilters = {}): Promise<ServiceResult<AuditLogResponse>> {
    try {
      const [entries, total] = await Promise.all([
        settingsRepository.getAuditLog(filters),
        settingsRepository.getAuditLogCount(filters)
      ]);
      return {
        success: true,
        data: {
          entries,
          total,
          limit: filters.limit ?? 50,
          offset: filters.offset ?? 0
        }
      };
    } catch (error) {
      console.error('Error fetching audit log:', error);
      return { success: false, error: 'Failed to fetch audit log', code: 'FETCH_ERROR' };
    }
  }
}

// Export singleton instance
export const settingsService = new SettingsService();
