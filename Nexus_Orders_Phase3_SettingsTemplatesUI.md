# Phase 3: Settings & Templates UI - Implementation Guide

**Status:** Ready for Implementation
**Priority:** Phase 3 Feature (Can run parallel to Phase 2.e)
**Created:** 2025-12-15
**Estimated Sessions:** 8-10 sessions total

---

## Executive Summary

Create an admin interface for managing system configuration that's currently hard-coded. This enables business rule changes without code deployments, provides audit trails, and separates business logic from application code.

**Key Principle:** Zero overlap with Phase 2.e (QB Invoice Automation). These phases can run fully in parallel.

---

## Table of Contents

1. [Phase 3.1: Database Foundation](#phase-31-database-foundation)
2. [Phase 3.2: Specification Options Manager](#phase-32-specification-options-manager)
3. [Phase 3.3: Task Configuration](#phase-33-task-configuration)
4. [Phase 3.4: Painting Matrix Editor](#phase-34-painting-matrix-editor)
5. [Phase 3.5: Production Roles Manager](#phase-35-production-roles-manager)
6. [Phase 3.6: Email Templates Editor](#phase-36-email-templates-editor)
7. [Phase 3.7: Settings Navigation & Polish](#phase-37-settings-navigation--polish)

---

## Currently Hard-Coded Configuration Summary

| Category | Location | Items |
|----------|----------|-------|
| Task Order | `taskRules.ts:23-50` | 26 tasks |
| Task→Role Map | `taskRules.ts:67-95` | 26 mappings |
| Painting Matrix | `paintingTaskMatrix.ts` | 18×7×4 matrix |
| Spec Dropdowns | `specificationConstants.ts` | ~20 categories, ~150 options |
| Production Roles | `types/orders.ts` | 15 roles |
| Email Templates | (to be created in 2.e) | 2-4 templates |

---

## Phase 3.1: Database Foundation

**Estimated Time:** 1-2 sessions
**Dependencies:** None
**Overlap Risk:** None

### Objectives
- Create all settings-related tables
- Seed with current hard-coded values
- Create generic settings repository with audit logging
- Create settings API routes

### Database Schema

```sql
-- =============================================================================
-- Migration: 001_create_settings_tables.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Task Definitions (replaces TASK_ORDER and TASK_ROLE_MAP)
-- -----------------------------------------------------------------------------
CREATE TABLE task_definitions (
  task_id INT PRIMARY KEY AUTO_INCREMENT,
  task_name VARCHAR(100) NOT NULL UNIQUE,
  task_key VARCHAR(100) NOT NULL UNIQUE,  -- Normalized key: 'vinyl_plotting'
  display_order INT NOT NULL,
  assigned_role VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,  -- TRUE = cannot delete, only deactivate
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_display_order (display_order),
  INDEX idx_active (is_active)
);

-- -----------------------------------------------------------------------------
-- 2. Painting Task Matrix
-- -----------------------------------------------------------------------------
CREATE TABLE painting_task_matrix (
  matrix_id INT PRIMARY KEY AUTO_INCREMENT,
  product_type VARCHAR(100) NOT NULL,
  product_type_key VARCHAR(100) NOT NULL,  -- Normalized: 'front_lit'
  component VARCHAR(50) NOT NULL,
  component_key VARCHAR(50) NOT NULL,  -- Normalized: 'face'
  timing VARCHAR(50) NOT NULL,
  timing_key VARCHAR(50) NOT NULL,  -- Normalized: 'before_cutting'
  material_variant VARCHAR(50) DEFAULT NULL,  -- For Substrate Cut, Backer
  task_numbers JSON NOT NULL,  -- Array of task numbers [2, 3] or null for "-"
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT,
  UNIQUE KEY uk_matrix_combo (product_type_key, component_key, timing_key, material_variant),
  FOREIGN KEY (updated_by) REFERENCES employees(employee_id),
  INDEX idx_product_type (product_type_key)
);

-- -----------------------------------------------------------------------------
-- 3. Specification Options (replaces specificationConstants.ts)
-- -----------------------------------------------------------------------------
CREATE TABLE specification_options (
  option_id INT PRIMARY KEY AUTO_INCREMENT,
  category VARCHAR(50) NOT NULL,
  category_display_name VARCHAR(100) NOT NULL,
  option_value VARCHAR(100) NOT NULL,
  option_key VARCHAR(100) NOT NULL,  -- Normalized key
  display_order INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,  -- TRUE = cannot delete
  metadata JSON DEFAULT NULL,  -- For additional properties if needed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_category_value (category, option_value),
  INDEX idx_category_active (category, is_active),
  INDEX idx_category_order (category, display_order)
);

-- -----------------------------------------------------------------------------
-- 4. Production Roles (replaces ProductionRole enum)
-- -----------------------------------------------------------------------------
CREATE TABLE production_roles (
  role_id INT PRIMARY KEY AUTO_INCREMENT,
  role_key VARCHAR(50) NOT NULL UNIQUE,  -- 'designer', 'painter', etc.
  display_name VARCHAR(100) NOT NULL,
  display_order INT NOT NULL,
  color_hex VARCHAR(7) DEFAULT '#6B7280',  -- Tailwind gray-500 default
  color_bg_class VARCHAR(50) DEFAULT 'bg-gray-100',
  color_text_class VARCHAR(50) DEFAULT 'text-gray-800',
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,  -- TRUE = cannot delete (manager, designer)
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_display_order (display_order),
  INDEX idx_active (is_active)
);

-- -----------------------------------------------------------------------------
-- 5. Email Templates
-- -----------------------------------------------------------------------------
CREATE TABLE email_templates (
  template_id INT PRIMARY KEY AUTO_INCREMENT,
  template_key VARCHAR(50) NOT NULL UNIQUE,
  template_name VARCHAR(100) NOT NULL,
  description TEXT,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  available_variables JSON NOT NULL,  -- ["orderNumber", "customerName", ...]
  is_active BOOLEAN DEFAULT TRUE,
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT,
  FOREIGN KEY (updated_by) REFERENCES employees(employee_id)
);

-- -----------------------------------------------------------------------------
-- 6. Settings Categories (for UI navigation)
-- -----------------------------------------------------------------------------
CREATE TABLE settings_categories (
  category_id INT PRIMARY KEY AUTO_INCREMENT,
  category_key VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_name VARCHAR(50),  -- Lucide icon name
  route_path VARCHAR(100) NOT NULL,
  display_order INT NOT NULL,
  required_role ENUM('owner', 'manager') DEFAULT 'owner',
  is_active BOOLEAN DEFAULT TRUE
);

-- -----------------------------------------------------------------------------
-- 7. Settings Audit Log
-- -----------------------------------------------------------------------------
CREATE TABLE settings_audit_log (
  log_id INT PRIMARY KEY AUTO_INCREMENT,
  table_name VARCHAR(50) NOT NULL,
  record_id INT NOT NULL,
  action ENUM('create', 'update', 'delete', 'restore') NOT NULL,
  old_values JSON,
  new_values JSON,
  change_summary VARCHAR(500),  -- Human-readable summary
  changed_by INT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  FOREIGN KEY (changed_by) REFERENCES employees(employee_id),
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_changed_at (changed_at),
  INDEX idx_changed_by (changed_by)
);
```

### Seed Data Script

```sql
-- =============================================================================
-- Migration: 002_seed_settings_data.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Seed Task Definitions (from taskRules.ts TASK_ORDER and TASK_ROLE_MAP)
-- -----------------------------------------------------------------------------
INSERT INTO task_definitions (task_name, task_key, display_order, assigned_role, is_system) VALUES
('Vinyl Plotting', 'vinyl_plotting', 1, 'designer', TRUE),
('Sanding (320) before cutting', 'sanding_before_cutting', 2, 'painter', TRUE),
('Scuffing before cutting', 'scuffing_before_cutting', 3, 'painter', TRUE),
('Paint before cutting', 'paint_before_cutting', 4, 'painter', TRUE),
('Vinyl Face Before Cutting', 'vinyl_face_before_cutting', 5, 'vinyl_applicator', TRUE),
('Vinyl Wrap Return/Trim', 'vinyl_wrap_return_trim', 6, 'vinyl_applicator', TRUE),
('CNC Router Cut', 'cnc_router_cut', 7, 'cnc_router_operator', TRUE),
('Laser Cut', 'laser_cut', 8, 'manager', TRUE),
('Cut & Bend Return', 'cut_bend_return', 9, 'cut_bender_operator', TRUE),
('Cut & Bend Trim', 'cut_bend_trim', 10, 'cut_bender_operator', TRUE),
('Sanding (320) after cutting', 'sanding_after_cutting', 11, 'painter', TRUE),
('Scuffing after cutting', 'scuffing_after_cutting', 12, 'painter', TRUE),
('Paint After Cutting', 'paint_after_cutting', 13, 'painter', TRUE),
('Backer / Raceway Bending', 'backer_raceway_bending', 14, 'backer_raceway_fabricator', TRUE),
('Paint After Bending', 'paint_after_bending', 15, 'painter', TRUE),
('Vinyl Face After Cutting', 'vinyl_face_after_cutting', 16, 'vinyl_applicator', TRUE),
('Trim Fabrication', 'trim_fabrication', 17, 'trim_fabricator', TRUE),
('Return Fabrication', 'return_fabrication', 18, 'return_fabricator', TRUE),
('Return Gluing', 'return_gluing', 19, 'return_gluer', TRUE),
('Mounting Hardware', 'mounting_hardware', 20, 'mounting_assembler', TRUE),
('Face Assembly', 'face_assembly', 21, 'face_assembler', TRUE),
('LEDs', 'leds', 22, 'led_installer', TRUE),
('Backer / Raceway Fabrication', 'backer_raceway_fabrication', 23, 'backer_raceway_fabricator', TRUE),
('Vinyl after Fabrication', 'vinyl_after_fabrication', 24, 'vinyl_applicator', TRUE),
('Paint after Fabrication', 'paint_after_fabrication', 25, 'painter', TRUE),
('Assembly', 'assembly', 26, 'backer_raceway_assembler', TRUE);

-- -----------------------------------------------------------------------------
-- Seed Production Roles (from types/orders.ts ProductionRole)
-- -----------------------------------------------------------------------------
INSERT INTO production_roles (role_key, display_name, display_order, color_hex, color_bg_class, color_text_class, is_system) VALUES
('designer', 'Designer', 1, '#3B82F6', 'bg-blue-100', 'text-blue-800', TRUE),
('vinyl_applicator', 'Vinyl Applicator', 2, '#8B5CF6', 'bg-violet-100', 'text-violet-800', TRUE),
('cnc_router_operator', 'CNC Router Operator', 3, '#10B981', 'bg-emerald-100', 'text-emerald-800', TRUE),
('cut_bender_operator', 'Cut & Bender Operator', 4, '#F59E0B', 'bg-amber-100', 'text-amber-800', TRUE),
('painter', 'Painter', 5, '#EF4444', 'bg-red-100', 'text-red-800', TRUE),
('led_installer', 'LED Installer', 6, '#06B6D4', 'bg-cyan-100', 'text-cyan-800', TRUE),
('trim_fabricator', 'Trim Fabricator', 7, '#84CC16', 'bg-lime-100', 'text-lime-800', TRUE),
('return_fabricator', 'Return Fabricator', 8, '#F97316', 'bg-orange-100', 'text-orange-800', TRUE),
('return_gluer', 'Return Gluer', 9, '#EC4899', 'bg-pink-100', 'text-pink-800', TRUE),
('mounting_assembler', 'Mounting Assembler', 10, '#6366F1', 'bg-indigo-100', 'text-indigo-800', TRUE),
('face_assembler', 'Face Assembler', 11, '#14B8A6', 'bg-teal-100', 'text-teal-800', TRUE),
('backer_raceway_fabricator', 'Backer/Raceway Fabricator', 12, '#A855F7', 'bg-purple-100', 'text-purple-800', TRUE),
('backer_raceway_assembler', 'Backer/Raceway Assembler', 13, '#0EA5E9', 'bg-sky-100', 'text-sky-800', TRUE),
('qc_packer', 'QC & Packer', 14, '#22C55E', 'bg-green-100', 'text-green-800', TRUE),
('manager', 'Manager', 15, '#6B7280', 'bg-gray-100', 'text-gray-800', TRUE);

-- -----------------------------------------------------------------------------
-- Seed Specification Options (from specificationConstants.ts)
-- Note: This is a subset - full seed would include all categories
-- -----------------------------------------------------------------------------

-- Prefinished Colors
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('prefinished_colors', 'Prefinished Colors', 'White', 'white', 1, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Black', 'black', 2, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Red', 'red', 3, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Orange', 'orange', 4, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Yellow', 'yellow', 5, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Green', 'green', 6, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Blue', 'blue', 7, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Gold', 'gold', 8, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Mill Finish', 'mill_finish', 9, TRUE);

-- Return Depths
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('return_depths', 'Return Depths', '3"', '3_inch', 1, TRUE),
('return_depths', 'Return Depths', '4"', '4_inch', 2, TRUE),
('return_depths', 'Return Depths', '5"', '5_inch', 3, TRUE),
('return_depths', 'Return Depths', 'Custom', 'custom', 4, TRUE);

-- Face Materials
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('face_materials', 'Face Materials', '2mm PC', '2mm_pc', 1, TRUE),
('face_materials', 'Face Materials', '3mm PC', '3mm_pc', 2, TRUE),
('face_materials', 'Face Materials', '3mm ACM', '3mm_acm', 3, TRUE),
('face_materials', 'Face Materials', '1mm Aluminum', '1mm_aluminum', 4, TRUE),
('face_materials', 'Face Materials', '12mm Acrylic', '12mm_acrylic', 5, TRUE),
('face_materials', 'Face Materials', '9mm Acrylic', '9mm_acrylic', 6, TRUE),
('face_materials', 'Face Materials', '4.5mm Acrylic', '4.5mm_acrylic', 7, TRUE);

-- Vinyl Applications
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('vinyl_applications', 'Vinyl Applications', 'Face, Full', 'face_full', 1, TRUE),
('vinyl_applications', 'Vinyl Applications', 'Face, White Keyline', 'face_white_keyline', 2, TRUE),
('vinyl_applications', 'Vinyl Applications', 'Face, Custom Cut', 'face_custom_cut', 3, TRUE),
('vinyl_applications', 'Vinyl Applications', 'Return Wrap', 'return_wrap', 4, TRUE),
('vinyl_applications', 'Vinyl Applications', 'Trim Wrap', 'trim_wrap', 5, TRUE),
('vinyl_applications', 'Vinyl Applications', 'Return & Trim Wrap', 'return_trim_wrap', 6, TRUE),
('vinyl_applications', 'Vinyl Applications', 'Face & Return Wrap', 'face_return_wrap', 7, TRUE);

-- Painting Components
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('painting_components', 'Painting Components', 'Face', 'face', 1, TRUE),
('painting_components', 'Painting Components', 'Return', 'return', 2, TRUE),
('painting_components', 'Painting Components', 'Trim', 'trim', 3, TRUE),
('painting_components', 'Painting Components', 'Return & Trim', 'return_trim', 4, TRUE),
('painting_components', 'Painting Components', 'Face & Return', 'face_return', 5, TRUE),
('painting_components', 'Painting Components', 'Frame', 'frame', 6, TRUE),
('painting_components', 'Painting Components', 'All Sides', 'all_sides', 7, TRUE);

-- Painting Timings
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('painting_timings', 'Painting Timings', 'Before Cutting', 'before_cutting', 1, TRUE),
('painting_timings', 'Painting Timings', 'After Cutting', 'after_cutting', 2, TRUE),
('painting_timings', 'Painting Timings', 'After Bending', 'after_bending', 3, TRUE),
('painting_timings', 'Painting Timings', 'After Fabrication', 'after_fabrication', 4, TRUE);

-- Mounting Types
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('mounting_types', 'Mounting Types', 'Pins', 'pins', 1, TRUE),
('mounting_types', 'Mounting Types', 'Pins + Spacers', 'pins_spacers', 2, TRUE),
('mounting_types', 'Mounting Types', 'Pins + Inserts', 'pins_inserts', 3, TRUE),
('mounting_types', 'Mounting Types', 'Pins + Spacers + Inserts', 'pins_spacers_inserts', 4, TRUE),
('mounting_types', 'Mounting Types', 'D-Tape', 'd_tape', 5, TRUE),
('mounting_types', 'Mounting Types', 'Nylon Pins', 'nylon_pins', 6, TRUE),
('mounting_types', 'Mounting Types', 'Nylon Pins + Spacers', 'nylon_pins_spacers', 7, TRUE),
('mounting_types', 'Mounting Types', 'SS Pins', 'ss_pins', 8, TRUE),
('mounting_types', 'Mounting Types', 'SS Pins + Spacers', 'ss_pins_spacers', 9, TRUE),
('mounting_types', 'Mounting Types', 'Stand offs', 'stand_offs', 10, TRUE);

-- Settings Categories (for navigation)
INSERT INTO settings_categories (category_key, display_name, description, icon_name, route_path, display_order, required_role) VALUES
('specifications', 'Specification Options', 'Manage dropdown options for order specifications', 'List', '/settings/specifications', 1, 'manager'),
('tasks', 'Task Configuration', 'Configure task order and role assignments', 'CheckSquare', '/settings/tasks', 2, 'owner'),
('painting_matrix', 'Painting Matrix', 'Configure painting task rules by product type', 'Grid3X3', '/settings/painting-matrix', 3, 'owner'),
('roles', 'Production Roles', 'Manage production roles and colors', 'Users', '/settings/roles', 4, 'owner'),
('email_templates', 'Email Templates', 'Customize email templates for orders', 'Mail', '/settings/email-templates', 5, 'manager'),
('audit_log', 'Audit Log', 'View history of settings changes', 'History', '/settings/audit-log', 6, 'owner');
```

### Backend Files to Create

#### `/backend/web/src/repositories/settingsRepository.ts`

```typescript
/**
 * Settings Repository
 * Generic CRUD operations for settings tables with audit logging
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Types
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
}

export interface AuditLogEntry {
  table_name: string;
  record_id: number;
  action: 'create' | 'update' | 'delete' | 'restore';
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  change_summary: string;
  changed_by: number;
  ip_address?: string;
}

export class SettingsRepository {
  // =========================================================================
  // Task Definitions
  // =========================================================================

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

  async updateTaskOrder(taskOrders: { task_id: number; display_order: number }[]): Promise<void> {
    for (const item of taskOrders) {
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

  async createTaskDefinition(task: Omit<TaskDefinition, 'task_id'>): Promise<number> {
    const result = await query(
      `INSERT INTO task_definitions (task_name, task_key, display_order, assigned_role, is_active, is_system, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [task.task_name, task.task_key, task.display_order, task.assigned_role, task.is_active, task.is_system, task.description]
    ) as ResultSetHeader;
    return result.insertId;
  }

  // =========================================================================
  // Production Roles
  // =========================================================================

  async getAllProductionRoles(includeInactive = false): Promise<ProductionRole[]> {
    const sql = includeInactive
      ? 'SELECT * FROM production_roles ORDER BY display_order'
      : 'SELECT * FROM production_roles WHERE is_active = TRUE ORDER BY display_order';
    return await query(sql) as ProductionRole[];
  }

  async updateProductionRole(roleId: number, updates: Partial<ProductionRole>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.display_name !== undefined) { fields.push('display_name = ?'); values.push(updates.display_name); }
    if (updates.display_order !== undefined) { fields.push('display_order = ?'); values.push(updates.display_order); }
    if (updates.color_hex !== undefined) { fields.push('color_hex = ?'); values.push(updates.color_hex); }
    if (updates.color_bg_class !== undefined) { fields.push('color_bg_class = ?'); values.push(updates.color_bg_class); }
    if (updates.color_text_class !== undefined) { fields.push('color_text_class = ?'); values.push(updates.color_text_class); }
    if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active); }

    if (fields.length === 0) return;

    values.push(roleId);
    await query(`UPDATE production_roles SET ${fields.join(', ')} WHERE role_id = ?`, values);
  }

  // =========================================================================
  // Specification Options
  // =========================================================================

  async getSpecificationCategories(): Promise<{ category: string; category_display_name: string; count: number }[]> {
    return await query(`
      SELECT category, category_display_name, COUNT(*) as count
      FROM specification_options
      WHERE is_active = TRUE
      GROUP BY category, category_display_name
      ORDER BY category_display_name
    `) as any[];
  }

  async getSpecificationOptionsByCategory(category: string, includeInactive = false): Promise<SpecificationOption[]> {
    const sql = includeInactive
      ? 'SELECT * FROM specification_options WHERE category = ? ORDER BY display_order'
      : 'SELECT * FROM specification_options WHERE category = ? AND is_active = TRUE ORDER BY display_order';
    return await query(sql, [category]) as SpecificationOption[];
  }

  async createSpecificationOption(option: Omit<SpecificationOption, 'option_id'>): Promise<number> {
    const result = await query(
      `INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_active, is_system)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [option.category, option.category_display_name, option.option_value, option.option_key, option.display_order, option.is_active, option.is_system]
    ) as ResultSetHeader;
    return result.insertId;
  }

  async updateSpecificationOption(optionId: number, updates: Partial<SpecificationOption>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.option_value !== undefined) { fields.push('option_value = ?'); values.push(updates.option_value); }
    if (updates.display_order !== undefined) { fields.push('display_order = ?'); values.push(updates.display_order); }
    if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active); }

    if (fields.length === 0) return;

    values.push(optionId);
    await query(`UPDATE specification_options SET ${fields.join(', ')} WHERE option_id = ?`, values);
  }

  async updateSpecificationOptionsOrder(updates: { option_id: number; display_order: number }[]): Promise<void> {
    for (const item of updates) {
      await query(
        'UPDATE specification_options SET display_order = ? WHERE option_id = ?',
        [item.display_order, item.option_id]
      );
    }
  }

  // =========================================================================
  // Painting Matrix
  // =========================================================================

  async getPaintingMatrixByProductType(productTypeKey: string): Promise<PaintingMatrixEntry[]> {
    return await query(
      'SELECT * FROM painting_task_matrix WHERE product_type_key = ? AND is_active = TRUE',
      [productTypeKey]
    ) as PaintingMatrixEntry[];
  }

  async getAllPaintingMatrixProductTypes(): Promise<{ product_type: string; product_type_key: string }[]> {
    return await query(`
      SELECT DISTINCT product_type, product_type_key
      FROM painting_task_matrix
      WHERE is_active = TRUE
      ORDER BY product_type
    `) as any[];
  }

  async updatePaintingMatrixEntry(
    matrixId: number,
    taskNumbers: number[] | null,
    updatedBy: number
  ): Promise<void> {
    await query(
      'UPDATE painting_task_matrix SET task_numbers = ?, updated_by = ? WHERE matrix_id = ?',
      [JSON.stringify(taskNumbers), updatedBy, matrixId]
    );
  }

  // =========================================================================
  // Audit Log
  // =========================================================================

  async createAuditLogEntry(entry: AuditLogEntry): Promise<void> {
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

  async getAuditLog(options: {
    tableName?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    const { tableName, limit = 50, offset = 0 } = options;

    let sql = `
      SELECT sal.*, e.first_name, e.last_name
      FROM settings_audit_log sal
      JOIN employees e ON sal.changed_by = e.employee_id
    `;
    const params: any[] = [];

    if (tableName) {
      sql += ' WHERE sal.table_name = ?';
      params.push(tableName);
    }

    sql += ' ORDER BY sal.changed_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await query(sql, params) as any[];
  }

  // =========================================================================
  // Settings Categories
  // =========================================================================

  async getSettingsCategories(userRole: string): Promise<any[]> {
    return await query(`
      SELECT * FROM settings_categories
      WHERE is_active = TRUE
        AND (required_role = ? OR required_role = 'manager')
      ORDER BY display_order
    `, [userRole]) as any[];
  }
}

export const settingsRepository = new SettingsRepository();
```

### Deliverables Checklist

- [ ] Create migration file `001_create_settings_tables.sql`
- [ ] Create seed file `002_seed_settings_data.sql`
- [ ] Create `settingsRepository.ts` (~300 lines)
- [ ] Create `settingsService.ts` (~200 lines)
- [ ] Create `settingsController.ts` (~200 lines)
- [ ] Create `settings.ts` routes (~60 lines)
- [ ] Run migrations and verify data
- [ ] Test all repository methods

---

## Phase 3.2: Specification Options Manager

**Estimated Time:** 1 session
**Dependencies:** Phase 3.1
**Overlap Risk:** None

### Objectives
- Create UI to manage all specification dropdown options
- Support add/edit/reorder/deactivate operations
- Update frontend components to fetch options from API

### UI Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings > Specification Options                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Categories                      │  Prefinished Colors (9 options)         │
│  ─────────────────────────────  │  ───────────────────────────────────────  │
│  ▸ Prefinished Colors (9)       │                                          │
│    Return Depths (4)            │  ☑ Active │ Value        │ Order │ 🗑    │
│    Face Materials (7)           │  ─────────┼──────────────┼───────┼──────  │
│    Face Colors (6)              │  ⋮⋮ ☑    │ White        │ 1     │ 🗑    │
│    Vinyl Applications (7)       │  ⋮⋮ ☑    │ Black        │ 2     │ 🗑    │
│    Painting Components (7)      │  ⋮⋮ ☑    │ Red          │ 3     │ 🗑    │
│    Painting Timings (4)         │  ⋮⋮ ☑    │ Orange       │ 4     │ 🗑    │
│    Mounting Types (10)          │  ⋮⋮ ☑    │ Yellow       │ 5     │ 🗑    │
│    Pin Types (8)                │  ⋮⋮ ☑    │ Green        │ 6     │ 🗑    │
│    Spacer Types (10)            │  ⋮⋮ ☑    │ Blue         │ 7     │ 🗑    │
│    Wire Gauges (2)              │  ⋮⋮ ☑    │ Gold         │ 8     │ 🗑    │
│    Cutting Methods (2)          │  ⋮⋮ ☑    │ Mill Finish  │ 9     │ 🗑    │
│    ...                          │                                          │
│                                 │  [+ Add Option]                          │
│                                 │                                          │
│                                 │  ℹ️ Drag rows to reorder. Deactivated    │
│                                 │     options won't appear in dropdowns.   │
│                                 │                                          │
│                                 │  [Save Order]                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### API Endpoints

```
GET    /api/settings/specifications/categories
       → List all categories with counts

GET    /api/settings/specifications/:category
       → Get options for a category

POST   /api/settings/specifications/:category
       → Add new option to category
       Body: { option_value, display_order? }

PUT    /api/settings/specifications/:category/:optionId
       → Update option (value, active status)
       Body: { option_value?, is_active? }

PUT    /api/settings/specifications/:category/order
       → Reorder options
       Body: { orders: [{ option_id, display_order }] }

DELETE /api/settings/specifications/:category/:optionId
       → Deactivate option (soft delete)
```

### Frontend Files

```
/frontend/web/src/components/settings/
├── specifications/
│   ├── SpecificationOptionsPage.tsx      (~200 lines)
│   ├── CategoryList.tsx                  (~80 lines)
│   ├── OptionsTable.tsx                  (~150 lines)
│   ├── AddOptionModal.tsx                (~100 lines)
│   └── EditOptionModal.tsx               (~100 lines)
```

### Update Existing Components

After this phase, update these files to fetch options from API instead of constants:

- `/frontend/web/src/config/specificationConstants.ts` → Add API fetching
- All spec form components that use dropdown constants

### Deliverables Checklist

- [ ] Create `SpecificationOptionsPage.tsx`
- [ ] Create `CategoryList.tsx`
- [ ] Create `OptionsTable.tsx` with drag-and-drop
- [ ] Create `AddOptionModal.tsx`
- [ ] Create `EditOptionModal.tsx`
- [ ] Add routes to `settingsController.ts`
- [ ] Create `useSpecificationOptions` hook for caching
- [ ] Update `specificationConstants.ts` to fetch from API
- [ ] Test all CRUD operations

---

## Phase 3.3: Task Configuration

**Estimated Time:** 1-2 sessions
**Dependencies:** Phase 3.1
**Overlap Risk:** None

### Objectives
- Create UI to manage task execution order (drag-and-drop)
- Create UI to assign roles to tasks
- Update task generation to read from database

### UI Design - Task Order Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings > Task Configuration                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Task Order]  [Role Assignments]                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Task Execution Order                                    [Reset to Default] │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Drag tasks to change execution order. Tasks are performed in this         │
│  sequence during production.                                                │
│                                                                             │
│  ⋮⋮  1.  Vinyl Plotting                              🔵 Designer           │
│  ⋮⋮  2.  Sanding (320) before cutting                🔴 Painter            │
│  ⋮⋮  3.  Scuffing before cutting                     🔴 Painter            │
│  ⋮⋮  4.  Paint before cutting                        🔴 Painter            │
│  ⋮⋮  5.  Vinyl Face Before Cutting                   🟣 Vinyl Applicator   │
│  ⋮⋮  6.  Vinyl Wrap Return/Trim                      🟣 Vinyl Applicator   │
│  ⋮⋮  7.  CNC Router Cut                              🟢 CNC Router Op      │
│  ⋮⋮  8.  Laser Cut                                   ⚫ Manager            │
│  ...                                                                        │
│  ⋮⋮  26. Assembly                                    🔵 Backer Assembler   │
│                                                                             │
│  [+ Add Custom Task]                        [Save Order]                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### UI Design - Role Assignments Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings > Task Configuration                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Task Order]  [Role Assignments]                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Task Role Assignments                                                      │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Assign which role is responsible for each task.                            │
│                                                                             │
│  Task Name                         │  Assigned Role                         │
│  ──────────────────────────────────┼───────────────────────────────────────  │
│  Vinyl Plotting                    │  [Designer              ▼]             │
│  Sanding (320) before cutting      │  [Painter               ▼]             │
│  Scuffing before cutting           │  [Painter               ▼]             │
│  Paint before cutting              │  [Painter               ▼]             │
│  Vinyl Face Before Cutting         │  [Vinyl Applicator      ▼]             │
│  CNC Router Cut                    │  [CNC Router Operator   ▼]             │
│  Laser Cut                         │  [Manager               ▼]             │
│  ...                                                                        │
│                                                                             │
│  [Save Assignments]                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### API Endpoints

```
GET    /api/settings/tasks
       → Get all task definitions

PUT    /api/settings/tasks/order
       → Update task order
       Body: { orders: [{ task_id, display_order }] }

PUT    /api/settings/tasks/:taskId/role
       → Update task role assignment
       Body: { assigned_role }

POST   /api/settings/tasks
       → Create custom task
       Body: { task_name, assigned_role }

PUT    /api/settings/tasks/:taskId
       → Update task (name, description, active)
       Body: { task_name?, description?, is_active? }
```

### Backend Update Required

Update `/backend/web/src/services/taskGeneration/taskRules.ts`:

```typescript
// Before: Hard-coded arrays
export const TASK_ORDER: string[] = [...];
export const TASK_ROLE_MAP: Record<string, ProductionRole> = {...};

// After: Fetch from database with caching
import { settingsRepository } from '../../repositories/settingsRepository';

let taskOrderCache: string[] | null = null;
let taskRoleMapCache: Record<string, string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 1 minute

export async function getTaskOrder(): Promise<string[]> {
  if (taskOrderCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return taskOrderCache;
  }

  const tasks = await settingsRepository.getAllTaskDefinitions();
  taskOrderCache = tasks.map(t => t.task_name);
  cacheTimestamp = Date.now();
  return taskOrderCache;
}

export async function getTaskRoleMap(): Promise<Record<string, string>> {
  if (taskRoleMapCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return taskRoleMapCache;
  }

  const tasks = await settingsRepository.getAllTaskDefinitions();
  taskRoleMapCache = Object.fromEntries(tasks.map(t => [t.task_name, t.assigned_role]));
  cacheTimestamp = Date.now();
  return taskRoleMapCache;
}

export function invalidateTaskCache(): void {
  taskOrderCache = null;
  taskRoleMapCache = null;
}
```

### Frontend Files

```
/frontend/web/src/components/settings/
├── tasks/
│   ├── TaskConfigurationPage.tsx         (~150 lines)
│   ├── TaskOrderEditor.tsx               (~200 lines)
│   ├── TaskRoleAssignmentGrid.tsx        (~180 lines)
│   └── AddTaskModal.tsx                  (~120 lines)
```

### Deliverables Checklist

- [ ] Create `TaskConfigurationPage.tsx` with tabs
- [ ] Create `TaskOrderEditor.tsx` with drag-and-drop
- [ ] Create `TaskRoleAssignmentGrid.tsx`
- [ ] Create `AddTaskModal.tsx`
- [ ] Add API endpoints to controller
- [ ] Update `taskRules.ts` to use database
- [ ] Add cache invalidation on updates
- [ ] Test task generation still works

---

## Phase 3.4: Painting Matrix Editor

**Estimated Time:** 1-2 sessions
**Dependencies:** Phase 3.1, Phase 3.3
**Overlap Risk:** None

### Objectives
- Create 3D matrix editor UI
- Support material variants for Substrate Cut and Backer
- Update painting task generator to read from database

### UI Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings > Painting Matrix                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Product Type: [Front Lit                    ▼]                             │
│                                                                             │
│  ℹ️ Select which painting tasks are auto-generated for each component       │
│     and timing combination. Numbers refer to task legend below.             │
│                                                                             │
│  ┌─────────────┬────────────┬────────────┬────────────┬────────────────┐   │
│  │             │  Before    │  After     │  After     │  After         │   │
│  │  Component  │  Cutting   │  Cutting   │  Bending   │  Fabrication   │   │
│  ├─────────────┼────────────┼────────────┼────────────┼────────────────┤   │
│  │  Face       │  ☑2 ☑3    │  ☑2 ☑6    │  -         │  -             │   │
│  │  Return     │  ☑2 ☑3    │  -         │  -         │  ☑2 ☑8        │   │
│  │  Trim       │  ☑2 ☑3    │  -         │  -         │  ☑2 ☑8        │   │
│  │  Return & T │  ☑2 ☑3    │  -         │  -         │  ☑2 ☑8        │   │
│  │  Face & Ret │  ☑2 ☑3    │  ☑2 ☑3 ☑6 │  -         │  ☑2 ☑8        │   │
│  │  Frame      │  -         │  -         │  -         │  -             │   │
│  │  All Sides  │  -         │  -         │  -         │  -             │   │
│  └─────────────┴────────────┴────────────┴────────────┴────────────────┘   │
│                                                                             │
│  Task Legend:                                                               │
│  1 = Sanding (320) before cutting    5 = Scuffing after cutting            │
│  2 = Scuffing before cutting         6 = Paint After Cutting               │
│  3 = Paint before cutting            7 = Paint After Bending               │
│  4 = Sanding (320) after cutting     8 = Paint after Fabrication           │
│                                                                             │
│  [Reset to Defaults]                               [Save Matrix]            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cell Editor Modal

When user clicks a cell:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Edit Painting Tasks                                                   [X]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Product: Front Lit                                                         │
│  Component: Face                                                            │
│  Timing: After Cutting                                                      │
│                                                                             │
│  Select tasks to auto-generate:                                             │
│                                                                             │
│  Surface Preparation:                                                       │
│  ☐ 1. Sanding (320) before cutting                                         │
│  ☑ 2. Scuffing before cutting                                              │
│  ☐ 4. Sanding (320) after cutting                                          │
│  ☐ 5. Scuffing after cutting                                               │
│                                                                             │
│  Paint Application:                                                         │
│  ☐ 3. Paint before cutting                                                 │
│  ☑ 6. Paint After Cutting                                                  │
│  ☐ 7. Paint After Bending                                                  │
│  ☐ 8. Paint after Fabrication                                              │
│                                                                             │
│  ☐ No tasks (mark as "-")                                                  │
│                                                                             │
│                                      [Cancel]  [Save]                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### API Endpoints

```
GET    /api/settings/painting-matrix/product-types
       → List all product types in matrix

GET    /api/settings/painting-matrix/:productTypeKey
       → Get matrix entries for product type

PUT    /api/settings/painting-matrix/:matrixId
       → Update matrix entry
       Body: { task_numbers: [2, 3] | null }

POST   /api/settings/painting-matrix/reset/:productTypeKey
       → Reset product type to defaults
```

### Seed Painting Matrix Data

Create migration to seed the full painting matrix from `Nexus_Orders_PaintingTasksMatrix.md`:

```sql
-- Front Lit matrix entries
INSERT INTO painting_task_matrix (product_type, product_type_key, component, component_key, timing, timing_key, task_numbers) VALUES
('Front Lit', 'front_lit', 'Face', 'face', 'Before Cutting', 'before_cutting', '[2,3]'),
('Front Lit', 'front_lit', 'Face', 'face', 'After Cutting', 'after_cutting', '[2,6]'),
('Front Lit', 'front_lit', 'Face', 'face', 'After Bending', 'after_bending', NULL),
('Front Lit', 'front_lit', 'Face', 'face', 'After Fabrication', 'after_fabrication', NULL),
('Front Lit', 'front_lit', 'Return', 'return', 'Before Cutting', 'before_cutting', '[2,3]'),
-- ... (full matrix ~300 rows)
```

### Frontend Files

```
/frontend/web/src/components/settings/
├── paintingMatrix/
│   ├── PaintingMatrixPage.tsx            (~150 lines)
│   ├── ProductTypeSelector.tsx           (~80 lines)
│   ├── MatrixGrid.tsx                    (~250 lines)
│   ├── MatrixCell.tsx                    (~100 lines)
│   ├── CellEditorModal.tsx               (~180 lines)
│   └── TaskLegend.tsx                    (~60 lines)
```

### Backend Update Required

Update `/backend/web/src/services/taskGeneration/paintingTaskMatrix.ts`:

```typescript
// Before: Hard-coded matrix object
const PAINTING_MATRIX = { ... };

// After: Fetch from database with caching
import { settingsRepository } from '../../repositories/settingsRepository';

let matrixCache: Map<string, PaintingMatrixEntry[]> = new Map();
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000;

export async function getPaintingMatrix(productTypeKey: string): Promise<PaintingMatrixEntry[]> {
  if (matrixCache.has(productTypeKey) && Date.now() - cacheTimestamp < CACHE_TTL) {
    return matrixCache.get(productTypeKey)!;
  }

  const entries = await settingsRepository.getPaintingMatrixByProductType(productTypeKey);
  matrixCache.set(productTypeKey, entries);
  cacheTimestamp = Date.now();
  return entries;
}

export function invalidatePaintingMatrixCache(): void {
  matrixCache.clear();
}
```

### Deliverables Checklist

- [ ] Create seed migration for painting matrix (~300 rows)
- [ ] Create `PaintingMatrixPage.tsx`
- [ ] Create `MatrixGrid.tsx` with cell editing
- [ ] Create `CellEditorModal.tsx`
- [ ] Add API endpoints to controller
- [ ] Update `paintingTaskMatrix.ts` to use database
- [ ] Add cache invalidation on updates
- [ ] Test painting task generation still works

---

## Phase 3.5: Production Roles Manager

**Estimated Time:** 1 session
**Dependencies:** Phase 3.1
**Overlap Risk:** None

### Objectives
- Create UI to manage production roles
- Support color customization
- Update Tasks Table to read colors from database

### UI Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings > Production Roles                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Production Roles                                          [+ Add Role]     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Configure roles that appear in the Tasks Table and task assignments.       │
│                                                                             │
│  ⋮⋮ │ Role Name              │ Color  │ Tasks │ Status   │ Actions        │
│  ───┼────────────────────────┼────────┼───────┼──────────┼────────────────│
│  ⋮⋮ │ Designer               │ 🔵     │ 2     │ Active   │ ✎             │
│  ⋮⋮ │ Vinyl Applicator       │ 🟣     │ 4     │ Active   │ ✎             │
│  ⋮⋮ │ CNC Router Operator    │ 🟢     │ 2     │ Active   │ ✎             │
│  ⋮⋮ │ Cut & Bender Operator  │ 🟡     │ 2     │ Active   │ ✎             │
│  ⋮⋮ │ Painter                │ 🔴     │ 8     │ Active   │ ✎             │
│  ⋮⋮ │ LED Installer          │ 🔵     │ 1     │ Active   │ ✎             │
│  ...                                                                        │
│  ⋮⋮ │ Manager                │ ⚫     │ 1     │ Active   │ 🔒            │
│                                                                             │
│  ℹ️ Drag to reorder. Order determines column position in Tasks Table.       │
│  🔒 System roles cannot be deleted.                                         │
│                                                                             │
│  [Save Order]                                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Edit Role Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Edit Role: Painter                                                    [X]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Display Name:                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Painter                                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Color:                                                                     │
│  ┌──────────────────────────────────────┐                                  │
│  │  🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪            │                                  │
│  │  [Custom: #EF4444]                   │                                  │
│  └──────────────────────────────────────┘                                  │
│                                                                             │
│  Preview:                                                                   │
│  ┌──────────────────────────────────────┐                                  │
│  │  Painter  (bg-red-100 text-red-800)  │                                  │
│  └──────────────────────────────────────┘                                  │
│                                                                             │
│  Status:                                                                    │
│  ◉ Active    ○ Inactive                                                    │
│                                                                             │
│  ⚠️ Deactivating this role will reassign its 8 tasks to Manager.           │
│                                                                             │
│                                      [Cancel]  [Save]                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### API Endpoints

```
GET    /api/settings/roles
       → Get all production roles

PUT    /api/settings/roles/:roleId
       → Update role
       Body: { display_name?, color_hex?, is_active? }

PUT    /api/settings/roles/order
       → Reorder roles
       Body: { orders: [{ role_id, display_order }] }

POST   /api/settings/roles
       → Create new role
       Body: { role_key, display_name, color_hex }
```

### Frontend Files

```
/frontend/web/src/components/settings/
├── roles/
│   ├── ProductionRolesPage.tsx           (~180 lines)
│   ├── RoleTable.tsx                     (~150 lines)
│   ├── EditRoleModal.tsx                 (~200 lines)
│   └── ColorPicker.tsx                   (~80 lines)
```

### Update Tasks Table

Update `/frontend/web/src/components/orders/tasksTable/roleColors.ts`:

```typescript
// Before: Hard-coded colors
export const ROLE_COLORS = { ... };

// After: Fetch from settings API
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/services/settingsApi';

export function useRoleColors() {
  return useQuery({
    queryKey: ['productionRoles'],
    queryFn: settingsApi.getProductionRoles,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (roles) => Object.fromEntries(
      roles.map(r => [r.role_key, {
        bg: r.color_bg_class,
        text: r.color_text_class,
        hex: r.color_hex
      }])
    )
  });
}
```

### Deliverables Checklist

- [ ] Create `ProductionRolesPage.tsx`
- [ ] Create `RoleTable.tsx` with drag-and-drop
- [ ] Create `EditRoleModal.tsx` with color picker
- [ ] Add API endpoints to controller
- [ ] Create `useRoleColors` hook
- [ ] Update Tasks Table to use dynamic colors
- [ ] Test role deactivation flow

---

## Phase 3.6: Email Templates Editor

**Status:** ⏸️ DEFERRED - Simplified approach adopted
**Estimated Time:** 1 session (when needed)
**Dependencies:** Phase 3.1

### Decision (2025-12-15)

After researching QuickBooks API limitations, we adopted a **Hybrid Approach**:
- QB handles invoice creation/storage/payments
- We handle email sending with custom templates (via Gmail API)
- Templates edited directly in database for now (no UI needed initially)

See `Nexus_Orders_Phase2e_QBInvoiceAutomation.md` for full details.

### Future UI (When Needed)

The following UI design is preserved for future implementation when template editing frequency warrants a dedicated UI.

### Original Objectives (Deferred)
- ~~Create UI to edit email template subject and body~~
- ~~Support merge variable insertion~~
- ~~Preview with sample data~~

### UI Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings > Email Templates                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Template: [50% Deposit Request                               ▼]            │
│                                                                             │
│  Subject:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Invoice #{orderNumber} - Deposit Required | {customerName}          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Body:                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Dear {pointPersonName},                                             │   │
│  │                                                                     │   │
│  │ Thank you for your order #{orderNumber} with SignHouse.             │   │
│  │                                                                     │   │
│  │ Before we begin production, a 50% deposit of {depositAmount} is     │   │
│  │ required.                                                           │   │
│  │                                                                     │   │
│  │ Please remit payment at your earliest convenience.                  │   │
│  │                                                                     │   │
│  │ View Invoice: {qbInvoiceUrl}                                        │   │
│  │                                                                     │   │
│  │ Thank you for your business!                                        │   │
│  │                                                                     │   │
│  │ SignHouse Team                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Available Variables:  [Click to insert]                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {orderNumber} {customerName} {pointPersonName} {invoiceTotal}       │   │
│  │ {depositAmount} {dueDate} {qbInvoiceUrl} {orderName}                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Preview]  [Reset to Default]                           [Save Changes]     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Preview Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Preview: 50% Deposit Request                                          [X]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Subject: Invoice #200543 - Deposit Required | ABC Sign Company             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Dear John Smith,                                                           │
│                                                                             │
│  Thank you for your order #200543 with SignHouse.                           │
│                                                                             │
│  Before we begin production, a 50% deposit of $2,125.00 is required.        │
│                                                                             │
│  Please remit payment at your earliest convenience.                         │
│                                                                             │
│  View Invoice: https://qbo.intuit.com/...                                   │
│                                                                             │
│  Thank you for your business!                                               │
│                                                                             │
│  SignHouse Team                                                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  ℹ️ Preview uses sample data. Actual emails will use real order data.       │
│                                                                             │
│                                                          [Close]            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### API Endpoints

```
GET    /api/settings/email-templates
       → List all templates

GET    /api/settings/email-templates/:templateKey
       → Get template details

PUT    /api/settings/email-templates/:templateKey
       → Update template
       Body: { subject, body }

POST   /api/settings/email-templates/:templateKey/preview
       → Generate preview with sample data
       Body: { subject, body }
       Response: { renderedSubject, renderedBody }

POST   /api/settings/email-templates/:templateKey/reset
       → Reset to default
```

### Frontend Files

```
/frontend/web/src/components/settings/
├── emailTemplates/
│   ├── EmailTemplatesPage.tsx            (~200 lines)
│   ├── TemplateEditor.tsx                (~180 lines)
│   ├── VariableInserter.tsx              (~80 lines)
│   └── PreviewModal.tsx                  (~120 lines)
```

### Deliverables Checklist

- [ ] Create `EmailTemplatesPage.tsx`
- [ ] Create `TemplateEditor.tsx` with variable insertion
- [ ] Create `PreviewModal.tsx`
- [ ] Add API endpoints to controller
- [ ] Coordinate with Phase 2.e on email_templates table
- [ ] Test template rendering with real data

---

## Phase 3.7: Settings Navigation & Polish

**Estimated Time:** 0.5 session
**Dependencies:** Phases 3.2-3.6
**Overlap Risk:** None

### Objectives
- Create settings index page with card navigation
- Add to main app navigation
- Create audit log viewer
- Final polish and testing

### UI Design - Settings Index

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Configure system settings and business rules.                              │
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │  📋                 │  │  ✅                 │  │  🎨                 │ │
│  │  Specification      │  │  Task               │  │  Painting           │ │
│  │  Options            │  │  Configuration      │  │  Matrix             │ │
│  │                     │  │                     │  │                     │ │
│  │  Manage dropdown    │  │  Task order and     │  │  Auto-generated     │ │
│  │  options for specs  │  │  role assignments   │  │  painting tasks     │ │
│  │                     │  │                     │  │                     │ │
│  │  Manager+           │  │  Owner only         │  │  Owner only         │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │  👥                 │  │  ✉️                  │  │  📜                 │ │
│  │  Production         │  │  Email              │  │  Audit              │ │
│  │  Roles              │  │  Templates          │  │  Log                │ │
│  │                     │  │                     │  │                     │ │
│  │  Role colors and    │  │  Customize email    │  │  View settings      │ │
│  │  display order      │  │  templates          │  │  change history     │ │
│  │                     │  │                     │  │                     │ │
│  │  Owner only         │  │  Manager+           │  │  Owner only         │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Audit Log Viewer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings > Audit Log                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Filter: [All Tables            ▼]  [All Users          ▼]                 │
│                                                                             │
│  Date/Time           │ User       │ Table           │ Action │ Summary     │
│  ────────────────────┼────────────┼─────────────────┼────────┼─────────────│
│  Dec 15, 2:30 PM     │ Jon        │ task_definitions│ update │ Changed     │
│                      │            │                 │        │ Vinyl Plot..│
│  Dec 15, 2:15 PM     │ Jon        │ painting_matrix │ update │ Front Lit   │
│                      │            │                 │        │ Face/After..│
│  Dec 14, 4:00 PM     │ Manager    │ spec_options    │ create │ Added "Teal"│
│                      │            │                 │        │ to colors   │
│  Dec 14, 3:45 PM     │ Manager    │ spec_options    │ update │ Reordered   │
│                      │            │                 │        │ 3 options   │
│  ...                                                                        │
│                                                                             │
│  [Load More]                                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Frontend Files

```
/frontend/web/src/
├── pages/
│   └── SettingsPage.tsx                  (~100 lines)
├── components/settings/
│   ├── SettingsIndex.tsx                 (~150 lines)
│   ├── SettingsCard.tsx                  (~60 lines)
│   ├── AuditLogViewer.tsx                (~180 lines)
│   └── SettingsLayout.tsx                (~80 lines)
```

### Add to App Navigation

Update `/frontend/web/src/App.tsx`:

```tsx
// Add settings routes
<Route path="/settings" element={<SettingsPage />}>
  <Route index element={<SettingsIndex />} />
  <Route path="specifications" element={<SpecificationOptionsPage />} />
  <Route path="tasks" element={<TaskConfigurationPage />} />
  <Route path="painting-matrix" element={<PaintingMatrixPage />} />
  <Route path="roles" element={<ProductionRolesPage />} />
  <Route path="email-templates" element={<EmailTemplatesPage />} />
  <Route path="audit-log" element={<AuditLogViewer />} />
</Route>
```

### Deliverables Checklist

- [ ] Create `SettingsPage.tsx` with layout
- [ ] Create `SettingsIndex.tsx` with cards
- [ ] Create `AuditLogViewer.tsx`
- [ ] Add settings to main navigation
- [ ] Add permission checks on all routes
- [ ] Test all settings pages end-to-end
- [ ] Update CLAUDE.md with new routes

---

## Summary: File Count & Line Estimates

### Backend (~1,100 lines)
| File | Lines |
|------|-------|
| `settingsRepository.ts` | ~300 |
| `settingsService.ts` | ~250 |
| `settingsController.ts` | ~250 |
| `settings.ts` (routes) | ~80 |
| Migrations (2 files) | ~220 |

### Frontend (~2,800 lines)
| Component | Lines |
|-----------|-------|
| `SettingsPage.tsx` | ~100 |
| `SettingsIndex.tsx` | ~150 |
| Specifications components | ~630 |
| Task configuration components | ~650 |
| Painting matrix components | ~820 |
| Production roles components | ~610 |
| Email templates components | ~580 |
| Audit log viewer | ~180 |
| Shared components | ~100 |

### Total: ~3,900 lines across ~25 files

---

## Testing Checklist

### Phase 3.1: Database
- [ ] Migrations run without errors
- [ ] Seed data populates correctly
- [ ] All repository methods work
- [ ] Audit logging captures changes

### Phase 3.2: Specification Options
- [ ] Categories list correctly
- [ ] Options CRUD works
- [ ] Reordering persists
- [ ] Deactivation hides from dropdowns
- [ ] Frontend dropdowns use API

### Phase 3.3: Task Configuration
- [ ] Task order saves correctly
- [ ] Role assignments update
- [ ] Task generation uses database
- [ ] Cache invalidation works

### Phase 3.4: Painting Matrix
- [ ] All product types display
- [ ] Matrix cells editable
- [ ] Changes save correctly
- [ ] Painting task generation uses database

### Phase 3.5: Production Roles
- [ ] Role list displays correctly
- [ ] Colors update in Tasks Table
- [ ] Reordering changes column order
- [ ] Deactivation reassigns tasks

### Phase 3.6: Email Templates
- [ ] Templates load correctly
- [ ] Variable insertion works
- [ ] Preview renders correctly
- [ ] Saved templates used in emails

### Phase 3.7: Navigation
- [ ] All routes accessible
- [ ] Permission checks work
- [ ] Audit log displays history
- [ ] Back navigation works

---

## Appendix: Full Specification Options Seed

For the complete seed data of all specification options, run this additional migration:

```sql
-- Full seed available in: /database/migrations/003_seed_all_spec_options.sql
-- Categories to seed:
-- - face_colors (6 options)
-- - drain_hole_sizes (2 options)
-- - digital_print_types (4 options)
-- - wire_gauges (2 options)
-- - cutting_methods (2 options)
-- - pin_lengths (3 options)
-- - spacer_lengths (3 options)
-- - material_colours (8 options)
-- - extrusion_colours (3 options)
-- - back_materials (4 options)
-- - box_materials (2 options)
-- - box_colours (3 options)
-- - box_fabrication (2 options)
-- - push_thru_thicknesses (4 options)
-- - push_thru_colours (2 options)
-- - neon_base_thicknesses (3 options)
-- - neon_base_materials (2 options)
-- - neon_base_colours (6 options)
-- - neon_led_stroke_widths (2 options)
-- - neon_led_colours (8 options)
-- - d_tape_thicknesses (3 options)
-- - pin_types (8 options)
-- - spacer_types (10 options)
```

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-12-15
**Owner:** Jon (with Claude Code assistance)
**Parallel Safe:** Yes - No overlap with Phase 2.e (QB Invoice Automation)
