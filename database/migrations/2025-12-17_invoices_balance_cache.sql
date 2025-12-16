-- =============================================
-- INVOICES PAGE: Balance Cache Migration
-- Created: 2025-12-17
--
-- Adds columns to cache QB invoice balances locally for the invoices page.
-- Balance caching is optimistic - once paid, stays paid.
-- Deposit paid is derived: deposit_required = 1 AND cached_balance < cached_invoice_total
-- =============================================

-- Add balance cache columns to orders table
ALTER TABLE orders
  ADD COLUMN cached_balance DECIMAL(15,2) DEFAULT NULL COMMENT 'Cached QB invoice balance (optimistic)',
  ADD COLUMN cached_balance_at DATETIME DEFAULT NULL COMMENT 'When balance was last fetched from QB',
  ADD COLUMN cached_invoice_total DECIMAL(15,2) DEFAULT NULL COMMENT 'Cached QB invoice total';

-- Index for invoice listing page queries
CREATE INDEX idx_orders_invoice_listing ON orders(qb_invoice_id, status, deposit_required);

-- Verification
SELECT 'Migration complete. New columns added:' AS message;
DESCRIBE orders;
