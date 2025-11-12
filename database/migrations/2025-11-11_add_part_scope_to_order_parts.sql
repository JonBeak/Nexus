-- Migration: Add part_scope field to order_parts table
-- Date: 2025-11-11
-- Purpose: Add a text identifier field for parts to distinguish different scopes/variations

ALTER TABLE order_parts
ADD COLUMN part_scope VARCHAR(255) NULL AFTER product_type;
