-- Migration: Create AI File Expectation Rules Table
-- Date: 2026-02-03
-- Description: Rules that define expected files per product type for AI file validation

-- Rules that define expected files per product type
CREATE TABLE IF NOT EXISTS ai_file_expectation_rules (
  rule_id INT AUTO_INCREMENT PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL,

  -- Condition: what product type triggers this rule
  condition_type ENUM('specs_display_name', 'product_type_id', 'has_template') NOT NULL,
  condition_value VARCHAR(100) NOT NULL,  -- e.g., "Front Lit", "Halo Lit"

  -- Expected file
  expected_filename VARCHAR(255) NOT NULL,  -- e.g., "Return.ai", "Trimcap.ai"

  -- Metadata
  is_required BOOLEAN DEFAULT TRUE,  -- If false, missing = warning not error
  description VARCHAR(255) DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_rule_file (condition_type, condition_value, expected_filename),
  INDEX idx_condition (condition_type, condition_value),
  INDEX idx_active (is_active)
);

-- Example rules (commented out - uncomment to add sample data)
-- These demonstrate how to configure expected files for different sign types
--
-- INSERT INTO ai_file_expectation_rules (rule_name, condition_type, condition_value, expected_filename, is_required, description) VALUES
-- ('Front Lit - Return', 'specs_display_name', 'Front Lit', 'Return.ai', TRUE, 'Return file for front lit channel letters'),
-- ('Front Lit - Trimcap', 'specs_display_name', 'Front Lit', 'Trimcap.ai', TRUE, 'Trimcap file for front lit channel letters'),
-- ('Front Lit - Cutting Face', 'specs_display_name', 'Front Lit', 'cutting_face.ai', TRUE, 'Face cutting file for front lit channel letters'),
-- ('Front Lit - Working File', 'specs_display_name', 'Front Lit', 'Working File.ai', TRUE, 'Main working file for front lit channel letters'),
-- ('Halo Lit - Return', 'specs_display_name', 'Halo Lit', 'Return.ai', TRUE, 'Return file for halo lit channel letters'),
-- ('Halo Lit - Back', 'specs_display_name', 'Halo Lit', 'Back.ai', TRUE, 'Back file for halo lit channel letters'),
-- ('Halo Lit - Working File', 'specs_display_name', 'Halo Lit', 'Working File.ai', TRUE, 'Main working file for halo lit channel letters');
