-- Migration: Add specs_display_name to order_parts table
-- Purpose: Store mapped display names for Specs section (different from qb_item_name)
-- Date: 2025-11-07

USE sign_manufacturing;

-- Add specs_display_name column to order_parts
ALTER TABLE order_parts
ADD COLUMN specs_display_name VARCHAR(255) NULL
COMMENT 'Mapped display name for Specs section (derived from qb_item_name)'
AFTER qb_item_name;

-- Add index for specs_display_name for faster queries
ALTER TABLE order_parts
ADD INDEX idx_specs_display_name (specs_display_name);

-- Migration complete
SELECT 'Migration completed: Added specs_display_name to order_parts' AS status;
