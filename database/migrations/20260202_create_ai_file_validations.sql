-- AI File Validation Tables
-- Created: 2026-02-02
-- Purpose: Store validation results for AI files before production approval

-- Table to store validation results for each AI file
CREATE TABLE IF NOT EXISTS ai_file_validations (
  validation_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  order_number INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  validation_status ENUM('pending', 'passed', 'failed', 'warning', 'error') DEFAULT 'pending',
  validated_at DATETIME DEFAULT NULL,
  validated_by INT DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  approved_by INT DEFAULT NULL,
  issues JSON DEFAULT NULL,
  stats JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (validated_by) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_order_number (order_number),
  INDEX idx_validation_status (validation_status),
  INDEX idx_file_path (file_path(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configuration table for validation rules (expandable)
CREATE TABLE IF NOT EXISTS ai_validation_rules (
  rule_id INT AUTO_INCREMENT PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL,
  rule_type ENUM('stroke', 'overlap', 'holes', 'area', 'closure', 'custom') NOT NULL,
  rule_config JSON NOT NULL COMMENT 'Thresholds, formulas, parameters for the rule',
  severity ENUM('error', 'warning', 'info') DEFAULT 'error',
  is_active BOOLEAN DEFAULT TRUE,
  applies_to VARCHAR(255) DEFAULT NULL COMMENT 'File pattern or product type filter',
  description TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_rule_name (rule_name),
  INDEX idx_rule_type (rule_type),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default validation rules
INSERT INTO ai_validation_rules (rule_name, rule_type, rule_config, severity, is_active, description) VALUES
('no_duplicate_overlapping', 'overlap', JSON_OBJECT(
  'tolerance', 0.01,
  'check_same_path', true,
  'check_position', true
), 'error', TRUE, 'Detect duplicate objects at the same position'),

('stroke_requirements', 'stroke', JSON_OBJECT(
  'required_color', '#000000',
  'required_width', 1.0,
  'allow_fill', false,
  'tolerance', 0.1
), 'error', TRUE, 'All objects must have black stroke, 1pt width, no fill'),

('structural_mounting_holes', 'holes', JSON_OBJECT(
  'min_holes', 2,
  'holes_per_sq_inch', 0.01,
  'min_perimeter_for_holes', 48,
  'applies_to_backing', true
), 'warning', TRUE, 'Backing paths need mounting holes based on size/perimeter'),

('path_closure', 'closure', JSON_OBJECT(
  'tolerance', 0.5,
  'exclude_text_paths', true
), 'warning', FALSE, 'Check that all paths are properly closed');
