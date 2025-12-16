/**
 * Settings Types
 * TypeScript interfaces for Phase 3 Settings & Templates UI
 *
 * Created: 2025-12-15
 */

// =============================================================================
// Entity Types (Database Table Representations)
// =============================================================================

export interface TaskDefinition {
  task_id: number;
  task_name: string;
  task_key: string;
  display_order: number;
  assigned_role: string;
  is_active: boolean;
  is_system: boolean;
  description: string | null;
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
  updated_at: Date;
}

export interface SpecificationCategory {
  category: string;
  category_display_name: string;
  count: number;
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
  updated_at: Date;
  updated_by: number | null;
}

export interface EmailTemplate {
  id: number;
  template_key: string;
  template_name: string;
  subject: string;
  body: string;
  variables: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
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

export interface SettingsAuditLogEntry {
  log_id: number;
  table_name: string;
  record_id: number;
  action: 'create' | 'update' | 'delete' | 'restore';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  change_summary: string | null;
  changed_by: number;
  changed_at: Date;
  ip_address: string | null;
  // Joined fields from employees table
  first_name?: string;
  last_name?: string;
}

// =============================================================================
// Request Types (API Input DTOs)
// =============================================================================

export interface UpdateTaskOrderRequest {
  orders: Array<{ task_id: number; display_order: number }>;
}

export interface UpdateTaskRoleRequest {
  assigned_role: string;
}

export interface CreateTaskRequest {
  task_name: string;
  assigned_role: string;
  description?: string;
}

export interface UpdateTaskRequest {
  task_name?: string;
  assigned_role?: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateRoleRequest {
  display_name?: string;
  color_hex?: string;
  color_bg_class?: string;
  color_text_class?: string;
  is_active?: boolean;
  description?: string;
}

export interface UpdateRoleOrderRequest {
  orders: Array<{ role_id: number; display_order: number }>;
}

export interface CreateRoleRequest {
  role_key: string;
  display_name: string;
  color_hex?: string;
  color_bg_class?: string;
  color_text_class?: string;
  description?: string;
}

export interface CreateOptionRequest {
  option_value: string;
  display_order?: number;
}

export interface UpdateOptionRequest {
  option_value?: string;
  is_active?: boolean;
}

export interface ReorderOptionsRequest {
  orders: Array<{ option_id: number; display_order: number }>;
}

export interface UpdateMatrixEntryRequest {
  task_numbers: number[] | null;
}

export interface UpdateEmailTemplateRequest {
  subject: string;
  body: string;
}

export interface PreviewEmailTemplateRequest {
  subject: string;
  body: string;
}

export interface AuditLogFilters {
  tableName?: string;
  userId?: number;
  limit?: number;
  offset?: number;
}

// =============================================================================
// Audit Log Types
// =============================================================================

export interface AuditLogEntryInput {
  table_name: string;
  record_id: number;
  action: 'create' | 'update' | 'delete' | 'restore';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  change_summary: string;
  changed_by: number;
  ip_address?: string;
}
