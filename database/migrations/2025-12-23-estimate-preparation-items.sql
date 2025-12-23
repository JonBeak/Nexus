-- Estimate Preparation Items Table
-- Stores editable snapshot of estimate line items after "Prepare to Send"
-- Replaces estimate_line_descriptions approach with full row editing

CREATE TABLE estimate_preparation_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estimate_id INT NOT NULL,
  display_order INT NOT NULL,

  -- Item identification (all editable)
  item_name VARCHAR(255) NOT NULL,
  qb_description TEXT,

  -- Pricing (editable, hidden for description-only rows)
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  extended_price DECIMAL(10,2) DEFAULT 0,

  -- Row type toggle
  is_description_only BOOLEAN DEFAULT FALSE,

  -- QB Item reference (from user dropdown selection)
  qb_item_id VARCHAR(50) NULL COMMENT 'QuickBooks Item ID selected by user',
  qb_item_name VARCHAR(255) NULL COMMENT 'QuickBooks Item name for display',

  -- Source tracking for audit trail
  source_row_id VARCHAR(50) NULL COMMENT 'Original row ID from input grid',
  source_product_type_id INT NULL COMMENT 'Original product type for audit',

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (estimate_id) REFERENCES job_estimates(id) ON DELETE CASCADE,
  INDEX idx_estimate_order (estimate_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add flag to job_estimates to distinguish new vs legacy estimates
ALTER TABLE job_estimates
ADD COLUMN uses_preparation_table TINYINT(1) DEFAULT 0
COMMENT '1 = uses new preparation table, 0 = uses legacy estimate_line_descriptions';

-- Rollback commands (for reference, do not run):
-- DROP TABLE IF EXISTS estimate_preparation_items;
-- ALTER TABLE job_estimates DROP COLUMN uses_preparation_table;
