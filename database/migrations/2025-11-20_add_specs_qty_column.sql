-- Migration: Extract specs_qty from specifications JSON to dedicated column
-- Date: 2025-11-20
-- Purpose: Move specs_qty (manufacturing quantity) from JSON to proper column for better data integrity

-- Add specs_qty column to order_parts table
ALTER TABLE order_parts
ADD COLUMN specs_qty DECIMAL(10,2) DEFAULT 0
COMMENT 'Manufacturing quantity (extracted from specifications.specs_qty)'
AFTER specs_display_name;

-- Add index for potential queries
CREATE INDEX idx_specs_qty ON order_parts(specs_qty);

-- Verify column was added
SHOW CREATE TABLE order_parts;
