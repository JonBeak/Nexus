-- =====================================================================
-- Configurable Validation Rules System - Phase 1
-- Creates standard_file_names catalog, validation_rule_conditions tree,
-- alters ai_file_expectation_rules, migrates existing rules, adds settings category
-- =====================================================================

-- 1. Standard file names catalog
CREATE TABLE IF NOT EXISTS standard_file_names (
  file_name_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT NULL,
  category ENUM('working_file', 'cutting_file', 'other') DEFAULT 'cutting_file',
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed standard file names
INSERT INTO standard_file_names (name, description, category, display_order) VALUES
  ('Working File.ai', 'Main working file with all layers', 'working_file', 1),
  ('Return.ai', 'Return cutting file', 'cutting_file', 2),
  ('Trimcap.ai', 'Trim cap cutting file', 'cutting_file', 3),
  ('cutting_face.ai', 'Face cutting file', 'cutting_file', 4),
  ('Back.ai', 'Back cutting file', 'cutting_file', 5),
  ('Vinyl.ai', 'Vinyl cutting file', 'cutting_file', 6),
  ('Backer.ai', 'Backer cutting file', 'cutting_file', 7),
  ('Face.ai', 'Face cutting file (alternate name)', 'cutting_file', 8)
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 2. Validation rule conditions (AND/OR tree - shared by expected files + geometry profiles)
CREATE TABLE IF NOT EXISTS validation_rule_conditions (
  condition_id INT AUTO_INCREMENT PRIMARY KEY,
  rule_type VARCHAR(30) NOT NULL,
  rule_id INT NOT NULL,
  parent_id INT DEFAULT NULL,
  node_type ENUM('group', 'condition') NOT NULL,
  logical_operator ENUM('AND', 'OR') DEFAULT NULL,
  field VARCHAR(100) DEFAULT NULL,
  operator ENUM('equals', 'not_equals', 'contains', 'in', 'exists') DEFAULT 'equals',
  value VARCHAR(500) DEFAULT NULL,
  sort_order INT DEFAULT 0,

  CONSTRAINT fk_condition_parent FOREIGN KEY (parent_id)
    REFERENCES validation_rule_conditions(condition_id) ON DELETE CASCADE,
  INDEX idx_rule (rule_type, rule_id),
  INDEX idx_parent (parent_id),
  INDEX idx_field_value (field, value(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Add file_name_id FK to ai_file_expectation_rules
ALTER TABLE ai_file_expectation_rules
  ADD COLUMN file_name_id INT DEFAULT NULL AFTER expected_filename,
  ADD CONSTRAINT fk_expectation_file_name FOREIGN KEY (file_name_id)
    REFERENCES standard_file_names(file_name_id);

-- 4. Populate file_name_id for existing rules by matching expected_filename
UPDATE ai_file_expectation_rules r
  JOIN standard_file_names sf ON sf.name = r.expected_filename
SET r.file_name_id = sf.file_name_id;

-- 5. Migrate existing rules to condition tree format
-- Each existing rule gets a root AND group with a single specs_display_name condition

-- Rule 1: Front Lit - Return (rule_id=1)
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, logical_operator, sort_order)
VALUES ('expected_file', 1, NULL, 'group', 'AND', 0);
SET @root1 = LAST_INSERT_ID();
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, field, operator, value, sort_order)
VALUES ('expected_file', 1, @root1, 'condition', 'specs_display_name', 'equals', 'Front Lit', 0);

-- Rule 2: Front Lit - Trimcap (rule_id=2)
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, logical_operator, sort_order)
VALUES ('expected_file', 2, NULL, 'group', 'AND', 0);
SET @root2 = LAST_INSERT_ID();
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, field, operator, value, sort_order)
VALUES ('expected_file', 2, @root2, 'condition', 'specs_display_name', 'equals', 'Front Lit', 0);

-- Rule 3: Front Lit - Cutting Face (rule_id=3)
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, logical_operator, sort_order)
VALUES ('expected_file', 3, NULL, 'group', 'AND', 0);
SET @root3 = LAST_INSERT_ID();
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, field, operator, value, sort_order)
VALUES ('expected_file', 3, @root3, 'condition', 'specs_display_name', 'equals', 'Front Lit', 0);

-- Rule 4: Front Lit - Working File (rule_id=4)
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, logical_operator, sort_order)
VALUES ('expected_file', 4, NULL, 'group', 'AND', 0);
SET @root4 = LAST_INSERT_ID();
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, field, operator, value, sort_order)
VALUES ('expected_file', 4, @root4, 'condition', 'specs_display_name', 'equals', 'Front Lit', 0);

-- Rule 5: Halo Lit - Return (rule_id=5)
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, logical_operator, sort_order)
VALUES ('expected_file', 5, NULL, 'group', 'AND', 0);
SET @root5 = LAST_INSERT_ID();
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, field, operator, value, sort_order)
VALUES ('expected_file', 5, @root5, 'condition', 'specs_display_name', 'equals', 'Halo Lit', 0);

-- Rule 6: Halo Lit - Back (rule_id=6)
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, logical_operator, sort_order)
VALUES ('expected_file', 6, NULL, 'group', 'AND', 0);
SET @root6 = LAST_INSERT_ID();
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, field, operator, value, sort_order)
VALUES ('expected_file', 6, @root6, 'condition', 'specs_display_name', 'equals', 'Halo Lit', 0);

-- Rule 7: Halo Lit - Working File (rule_id=7)
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, logical_operator, sort_order)
VALUES ('expected_file', 7, NULL, 'group', 'AND', 0);
SET @root7 = LAST_INSERT_ID();
INSERT INTO validation_rule_conditions (rule_type, rule_id, parent_id, node_type, field, operator, value, sort_order)
VALUES ('expected_file', 7, @root7, 'condition', 'specs_display_name', 'equals', 'Halo Lit', 0);

-- 6. Add settings category for validation rules
INSERT INTO settings_categories (category_key, display_name, description, icon_name, route_path, display_order, required_role, is_active)
VALUES ('validation_rules', 'Validation Rules', 'Configure file expectations and validation profiles', 'ShieldCheck', '/settings/validation-rules', 8, 'manager', 1)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);
