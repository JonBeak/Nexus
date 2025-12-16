-- =============================================================================
-- Migration: Create Settings Tables for Phase 3
-- Date: 2025-12-15
-- Description: Tables for managing task definitions, painting matrix,
--              specification options, production roles, email templates,
--              settings categories, and audit logging.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Task Definitions (replaces TASK_ORDER and TASK_ROLE_MAP in taskRules.ts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_definitions (
  task_id INT PRIMARY KEY AUTO_INCREMENT,
  task_name VARCHAR(100) NOT NULL,
  task_key VARCHAR(100) NOT NULL,
  display_order INT NOT NULL,
  assigned_role VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_task_name (task_name),
  UNIQUE KEY uk_task_key (task_key),
  INDEX idx_display_order (display_order),
  INDEX idx_active (is_active)
);

-- -----------------------------------------------------------------------------
-- 2. Painting Task Matrix (replaces paintingTaskMatrix.ts hard-coded object)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS painting_task_matrix (
  matrix_id INT PRIMARY KEY AUTO_INCREMENT,
  product_type VARCHAR(100) NOT NULL,
  product_type_key VARCHAR(100) NOT NULL,
  component VARCHAR(50) NOT NULL,
  component_key VARCHAR(50) NOT NULL,
  timing VARCHAR(50) NOT NULL,
  timing_key VARCHAR(50) NOT NULL,
  material_variant VARCHAR(50) DEFAULT NULL,
  task_numbers JSON DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT DEFAULT NULL,
  UNIQUE KEY uk_matrix_combo (product_type_key, component_key, timing_key, material_variant),
  INDEX idx_product_type (product_type_key),
  INDEX idx_active (is_active)
);

-- -----------------------------------------------------------------------------
-- 3. Specification Options (replaces specificationConstants.ts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS specification_options (
  option_id INT PRIMARY KEY AUTO_INCREMENT,
  category VARCHAR(50) NOT NULL,
  category_display_name VARCHAR(100) NOT NULL,
  option_value VARCHAR(100) NOT NULL,
  option_key VARCHAR(100) NOT NULL,
  display_order INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_category_value (category, option_value),
  INDEX idx_category_active (category, is_active),
  INDEX idx_category_order (category, display_order)
);

-- -----------------------------------------------------------------------------
-- 4. Production Roles (replaces ProductionRole enum in types/orders.ts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS production_roles (
  role_id INT PRIMARY KEY AUTO_INCREMENT,
  role_key VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  display_order INT NOT NULL,
  color_hex VARCHAR(7) DEFAULT '#6B7280',
  color_bg_class VARCHAR(50) DEFAULT 'bg-gray-100',
  color_text_class VARCHAR(50) DEFAULT 'text-gray-800',
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_key (role_key),
  INDEX idx_display_order (display_order),
  INDEX idx_active (is_active)
);

-- -----------------------------------------------------------------------------
-- 5. Email Templates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_templates (
  template_id INT PRIMARY KEY AUTO_INCREMENT,
  template_key VARCHAR(50) NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  description TEXT,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  available_variables JSON NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT DEFAULT NULL,
  UNIQUE KEY uk_template_key (template_key)
);

-- -----------------------------------------------------------------------------
-- 6. Settings Categories (for UI navigation)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings_categories (
  category_id INT PRIMARY KEY AUTO_INCREMENT,
  category_key VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_name VARCHAR(50),
  route_path VARCHAR(100) NOT NULL,
  display_order INT NOT NULL,
  required_role ENUM('owner', 'manager') DEFAULT 'owner',
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE KEY uk_category_key (category_key),
  INDEX idx_display_order (display_order)
);

-- -----------------------------------------------------------------------------
-- 7. Settings Audit Log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings_audit_log (
  log_id INT PRIMARY KEY AUTO_INCREMENT,
  table_name VARCHAR(50) NOT NULL,
  record_id INT NOT NULL,
  action ENUM('create', 'update', 'delete', 'restore') NOT NULL,
  old_values JSON DEFAULT NULL,
  new_values JSON DEFAULT NULL,
  change_summary VARCHAR(500),
  changed_by INT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45) DEFAULT NULL,
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_changed_at (changed_at),
  INDEX idx_changed_by (changed_by)
);
