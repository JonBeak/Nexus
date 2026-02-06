-- Migration: Backfill accounting_emails from legacy invoice_email column
-- Date: 2025-12-17
-- Purpose: Migrate historical orders with invoice_email to the new accounting_emails JSON array format
--
-- This migration should be run AFTER the new accounting_emails system is deployed.
-- It converts legacy invoice_email values into the new accounting_emails JSON format.
-- Orders that already have accounting_emails populated will NOT be affected.
--
-- Run with credentials from .env file (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME):
-- mysql -h localhost -u signhouse_user -p sign_manufacturing < 2025-12-17_backfill_accounting_emails.sql
-- CRITICAL: Never use root user. Always use a dedicated non-root database user.

-- =============================================
-- Step 1: Backfill orders with invoice_email but no accounting_emails
-- =============================================

UPDATE orders
SET accounting_emails = JSON_ARRAY(
  JSON_OBJECT('email', invoice_email, 'email_type', 'to', 'label', 'Accounting')
)
WHERE invoice_email IS NOT NULL
  AND invoice_email != ''
  AND (accounting_emails IS NULL OR accounting_emails = '[]' OR accounting_emails = 'null');

-- =============================================
-- Step 2: Report migration results
-- =============================================

SELECT
  COUNT(*) as total_orders,
  SUM(CASE WHEN accounting_emails IS NOT NULL AND accounting_emails != '[]' THEN 1 ELSE 0 END) as orders_with_accounting_emails,
  SUM(CASE WHEN invoice_email IS NOT NULL AND invoice_email != '' THEN 1 ELSE 0 END) as orders_with_legacy_invoice_email
FROM orders;

-- =============================================
-- Note: The invoice_email column can be safely dropped in a future migration
-- after confirming all data has been migrated and the new system is working.
-- For now, we keep the column for backwards compatibility.
-- =============================================
-- To drop the column later (NOT part of this migration):
-- ALTER TABLE orders DROP COLUMN invoice_email;
