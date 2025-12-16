/**
 * Settings API - Core Operations for Phase 3 Settings UI
 * Handles specification options, tasks, roles, painting matrix, email templates, and audit log
 */

import { api } from '../../apiClient';

// =============================================================================
// Types (Frontend-optimized versions)
// =============================================================================

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
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SettingsCategory {
  category_id: number;
  category_key: string;
  display_name: string;
  description: string | null;
  icon_name: string | null;
  route_path: string;
  display_order: number;
  required_role: 'owner' | 'manager';
  is_active: boolean;
}

export interface TaskDefinition {
  task_id: number;
  task_name: string;
  task_key: string;
  display_order: number;
  assigned_role: string;
  is_active: boolean;
  is_system: boolean;
  description: string | null;
}

export interface ProductionRole {
  role_id: number;
  role_key: string;
  display_name: string;
  display_order: number;
  color_hex: string;
  color_bg_class: string;
  color_text_class: string;
  is_active: boolean;
  is_system: boolean;
  description: string | null;
}

export interface EmailTemplate {
  id: number;
  template_key: string;
  template_name: string;
  subject: string;
  body: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaintingMatrixEntry {
  matrix_id: number;
  product_type: string;
  product_type_key: string;
  component: string;
  component_key: string;
  timing: string;
  timing_key: string;
  material_variant: string | null;
  task_numbers: number[] | null;
  is_active: boolean;
  notes: string | null;
}

export interface ProductType {
  product_type_key: string;
  product_type: string;
}

export interface AuditLogEntry {
  log_id: number;
  table_name: string;
  record_id: number;
  action: 'create' | 'update' | 'delete' | 'restore';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  change_summary: string | null;
  changed_by: number;
  changed_at: string;
  first_name?: string;
  last_name?: string;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

// =============================================================================
// Settings API
// =============================================================================

export const settingsApi = {
  // -------------------------------------------------------------------------
  // Settings Categories (for navigation)
  // -------------------------------------------------------------------------

  /**
   * Get available settings categories based on user role
   */
  async getCategories(): Promise<SettingsCategory[]> {
    const response = await api.get('/settings/categories');
    return response.data;
  },

  // -------------------------------------------------------------------------
  // Specification Options
  // -------------------------------------------------------------------------

  /**
   * Get all specification categories with counts
   */
  async getSpecificationCategories(): Promise<SpecificationCategory[]> {
    const response = await api.get('/settings/specifications/categories');
    return response.data;
  },

  /**
   * Get options for a specific category
   */
  async getOptionsByCategory(category: string, includeInactive = false): Promise<SpecificationOption[]> {
    const params = includeInactive ? { includeInactive: 'true' } : {};
    const response = await api.get(`/settings/specifications/${category}`, { params });
    return response.data;
  },

  /**
   * Create a new option in a category
   */
  async createOption(category: string, optionValue: string): Promise<number> {
    const response = await api.post(`/settings/specifications/${category}`, {
      option_value: optionValue
    });
    return response.data;
  },

  /**
   * Update an existing option
   */
  async updateOption(
    category: string,
    optionId: number,
    updates: { option_value?: string; is_active?: boolean }
  ): Promise<void> {
    await api.put(`/settings/specifications/${category}/${optionId}`, updates);
  },

  /**
   * Reorder options in a category
   */
  async reorderOptions(
    category: string,
    orders: Array<{ option_id: number; display_order: number }>
  ): Promise<void> {
    await api.put(`/settings/specifications/${category}/order`, { orders });
  },

  /**
   * Deactivate an option (soft delete)
   */
  async deactivateOption(category: string, optionId: number): Promise<void> {
    await api.delete(`/settings/specifications/${category}/${optionId}`);
  },

  // -------------------------------------------------------------------------
  // Task Definitions
  // -------------------------------------------------------------------------

  /**
   * Get all task definitions
   */
  async getTasks(includeInactive = false): Promise<TaskDefinition[]> {
    const params = includeInactive ? { includeInactive: 'true' } : {};
    const response = await api.get('/settings/tasks', { params });
    return response.data;
  },

  /**
   * Reorder tasks
   */
  async reorderTasks(orders: Array<{ task_id: number; display_order: number }>): Promise<void> {
    await api.put('/settings/tasks/order', { orders });
  },

  /**
   * Update task role assignment
   */
  async updateTaskRole(taskId: number, assignedRole: string): Promise<void> {
    await api.put(`/settings/tasks/${taskId}/role`, { assigned_role: assignedRole });
  },

  /**
   * Create a new task
   */
  async createTask(data: { task_name: string; assigned_role: string; description?: string }): Promise<number> {
    const response = await api.post('/settings/tasks', data);
    return response.data;
  },

  /**
   * Update task
   */
  async updateTask(taskId: number, updates: {
    task_name?: string;
    assigned_role?: string;
    description?: string;
    is_active?: boolean;
  }): Promise<void> {
    await api.put(`/settings/tasks/${taskId}`, updates);
  },

  // -------------------------------------------------------------------------
  // Production Roles
  // -------------------------------------------------------------------------

  /**
   * Get all production roles
   */
  async getRoles(includeInactive = false): Promise<ProductionRole[]> {
    const params = includeInactive ? { includeInactive: 'true' } : {};
    const response = await api.get('/settings/roles', { params });
    return response.data;
  },

  /**
   * Reorder production roles
   */
  async reorderRoles(orders: Array<{ role_id: number; display_order: number }>): Promise<void> {
    await api.put('/settings/roles/order', { orders });
  },

  /**
   * Update a production role
   */
  async updateRole(roleId: number, updates: {
    display_name?: string;
    color_hex?: string;
    color_bg_class?: string;
    color_text_class?: string;
    is_active?: boolean;
    description?: string;
  }): Promise<void> {
    await api.put(`/settings/roles/${roleId}`, updates);
  },

  /**
   * Create a new production role
   */
  async createRole(data: {
    role_key: string;
    display_name: string;
    color_hex?: string;
    color_bg_class?: string;
    color_text_class?: string;
    description?: string;
  }): Promise<number> {
    const response = await api.post('/settings/roles', data);
    return response.data;
  },

  // -------------------------------------------------------------------------
  // Email Templates
  // -------------------------------------------------------------------------

  /**
   * Get all email templates
   */
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    const response = await api.get('/settings/email-templates');
    return response.data;
  },

  /**
   * Get a specific email template
   */
  async getEmailTemplate(templateKey: string): Promise<EmailTemplate> {
    const response = await api.get(`/settings/email-templates/${templateKey}`);
    return response.data;
  },

  /**
   * Update an email template
   */
  async updateEmailTemplate(templateKey: string, updates: { subject: string; body: string }): Promise<void> {
    await api.put(`/settings/email-templates/${templateKey}`, updates);
  },

  /**
   * Preview an email template with sample data
   */
  async previewEmailTemplate(templateKey: string, data: { subject: string; body: string }): Promise<{ subject: string; body: string }> {
    const response = await api.post(`/settings/email-templates/${templateKey}/preview`, data);
    return response.data;
  },

  // -------------------------------------------------------------------------
  // Painting Matrix
  // -------------------------------------------------------------------------

  /**
   * Get available product types for painting matrix
   */
  async getProductTypes(): Promise<ProductType[]> {
    const response = await api.get('/settings/painting-matrix/product-types');
    return response.data;
  },

  /**
   * Get painting matrix for a product type
   */
  async getPaintingMatrix(productTypeKey: string): Promise<PaintingMatrixEntry[]> {
    const response = await api.get(`/settings/painting-matrix/${productTypeKey}`);
    return response.data;
  },

  /**
   * Update a painting matrix entry
   */
  async updatePaintingMatrixEntry(matrixId: number, taskNumbers: number[] | null): Promise<void> {
    await api.put(`/settings/painting-matrix/${matrixId}`, { task_numbers: taskNumbers });
  },

  // -------------------------------------------------------------------------
  // Audit Log
  // -------------------------------------------------------------------------

  /**
   * Get audit log entries with optional filters
   */
  async getAuditLog(filters?: {
    tableName?: string;
    userId?: number;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogResponse> {
    const response = await api.get('/settings/audit-log', { params: filters });
    return response.data;
  },
};
