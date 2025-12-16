-- Migration: Add accounting_emails JSON column to orders table
-- Date: 2025-12-17
-- Purpose: Store snapshot of accounting emails at order creation for invoice sending

ALTER TABLE orders ADD COLUMN accounting_emails JSON NULL;
