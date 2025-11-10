-- Migration: Fix Invoice Fields - deposit_required to boolean, add cash and discount
-- Purpose: Correct deposit_required type and add missing cash/discount fields
-- Date: 2025-11-07

-- =============================================
-- CUSTOMERS TABLE: Fix deposit_required type
-- =============================================

-- First, convert any existing decimal values to boolean (any value > 0 becomes 1)
UPDATE customers
SET deposit_required = IF(deposit_required > 0, 1, 0)
WHERE deposit_required IS NOT NULL;

ALTER TABLE customers
MODIFY COLUMN deposit_required TINYINT(1) DEFAULT 0
COMMENT 'Whether deposit is required for new orders (boolean)';

-- =============================================
-- ORDERS TABLE: Fix deposit_required and add cash/discount
-- =============================================

-- First, convert any existing decimal values to boolean (any value > 0 becomes 1)
UPDATE orders
SET deposit_required = IF(deposit_required > 0, 1, 0)
WHERE deposit_required IS NOT NULL;

ALTER TABLE orders
MODIFY COLUMN deposit_required TINYINT(1) DEFAULT 0
COMMENT 'Whether deposit is required for this order (initialized from customers.deposit_required)';

ALTER TABLE orders
ADD COLUMN cash TINYINT(1) DEFAULT 0
COMMENT 'Whether this is a cash customer order (initialized from customers.cash_yes_or_no)'
AFTER deposit_required;

ALTER TABLE orders
ADD COLUMN discount DECIMAL(10,5) DEFAULT 0.00000
COMMENT 'Discount percentage for this order (initialized from customers.discount)'
AFTER cash;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Run these to verify the migration:
-- SHOW COLUMNS FROM customers WHERE Field = 'deposit_required';
-- SHOW COLUMNS FROM orders WHERE Field IN ('invoice_email', 'terms', 'deposit_required', 'invoice_notes', 'cash', 'discount');
