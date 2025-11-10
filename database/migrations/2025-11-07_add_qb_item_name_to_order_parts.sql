-- Migration: Add qb_item_name column to order_parts table
-- Date: 2025-11-07
-- Purpose: Allow storing QuickBooks item name selection for each order part

-- Add qb_item_name column to order_parts
ALTER TABLE order_parts
ADD COLUMN qb_item_name VARCHAR(255) DEFAULT NULL
COMMENT 'QuickBooks item name selected for this part (for invoice/QB sync)'
AFTER product_type;

-- Add index for faster lookups
ALTER TABLE order_parts
ADD INDEX idx_qb_item_name (qb_item_name);

-- Migration notes:
-- - Column is nullable to allow parts without QB item selection
-- - Defaults to NULL for existing records
-- - Should match item_name from qb_item_mappings table when set
