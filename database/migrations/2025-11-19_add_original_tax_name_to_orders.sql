-- Migration: Add original_tax_name to orders table
-- Date: 2025-11-19
-- Purpose: Store original tax selection before Cash Job override
--
-- When cash job is checked: original_tax_name = current tax_name, tax_name = 'Out of Scope'
-- When cash job is unchecked: tax_name = original_tax_name
--
-- This preserves user's manual tax selection when toggling cash job status

USE sign_manufacturing;

-- Add original_tax_name column
ALTER TABLE orders
ADD COLUMN original_tax_name VARCHAR(50) NULL
  COMMENT 'Saved tax_name before cash job override - restored when cash job is unchecked'
  AFTER tax_name;

-- Verify the change
DESCRIBE orders;

-- Show sample data
SELECT order_number, tax_name, original_tax_name, cash
FROM orders
LIMIT 5;
