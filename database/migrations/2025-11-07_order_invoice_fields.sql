-- Migration: Add Invoice Fields to Orders and Customers
-- Purpose: Support per-order invoice customization while maintaining customer defaults
-- Date: 2025-11-07

-- =============================================
-- CUSTOMERS TABLE: Add missing default field
-- =============================================

ALTER TABLE customers
ADD COLUMN deposit_required DECIMAL(10,2) DEFAULT NULL
COMMENT 'Default deposit amount for new orders'
AFTER payment_terms;

-- =============================================
-- ORDERS TABLE: Add per-order invoice fields
-- =============================================

ALTER TABLE orders
ADD COLUMN invoice_email VARCHAR(255) DEFAULT NULL
COMMENT 'Accounting email for this order (initialized from customers.invoice_email)'
AFTER internal_note;

ALTER TABLE orders
ADD COLUMN terms VARCHAR(100) DEFAULT NULL
COMMENT 'Payment terms for this order (initialized from customers.payment_terms)'
AFTER invoice_email;

ALTER TABLE orders
ADD COLUMN deposit_required DECIMAL(10,2) DEFAULT NULL
COMMENT 'Deposit amount required for this order (initialized from customers.deposit_required)'
AFTER terms;

ALTER TABLE orders
ADD COLUMN invoice_notes TEXT DEFAULT NULL
COMMENT 'Invoice notes for this order (initialized from customers.invoice_email_preference)'
AFTER deposit_required;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Run these to verify the migration:
-- SHOW COLUMNS FROM customers WHERE Field = 'deposit_required';
-- SHOW COLUMNS FROM orders WHERE Field IN ('invoice_email', 'terms', 'deposit_required', 'invoice_notes');
