-- Migration: Add is_header_row column to order_parts
-- Date: 2025-12-16
-- Purpose: Support storing invoice header as first row (part_number=0) for 1:1 QB sync

-- Add is_header_row column to order_parts table
ALTER TABLE order_parts
  ADD COLUMN is_header_row TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'True for auto-generated invoice header row (part_number=0)'
  AFTER part_number;

-- Index for efficient header row lookup
CREATE INDEX idx_order_parts_header ON order_parts(order_id, is_header_row);

-- Verification
-- SELECT * FROM order_parts WHERE is_header_row = 1 LIMIT 5;
-- DESCRIBE order_parts;
