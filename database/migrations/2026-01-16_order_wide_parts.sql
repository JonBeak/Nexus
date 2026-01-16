-- Migration: Add Order-Wide Parts Support
-- Date: 2026-01-16
-- Description: Adds is_order_wide column to order_parts table to support order-level tasks
--              (Pattern, Vinyl Stencil, UL) that apply to the entire order

-- Add is_order_wide column to order_parts
ALTER TABLE order_parts
ADD COLUMN is_order_wide TINYINT(1) DEFAULT 0 AFTER is_header_row;

-- Add index for filtering order-wide parts (frequently used in PDF generation and task queries)
CREATE INDEX idx_order_parts_is_order_wide ON order_parts(is_order_wide);

-- Verify the column was added
-- SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA = 'sign_manufacturing'
-- AND TABLE_NAME = 'order_parts'
-- AND COLUMN_NAME = 'is_order_wide';
