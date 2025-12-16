-- Phase 2: Bi-Directional Invoice Sync
-- Adds columns to track QB-side modifications for conflict detection
--
-- Run: mysql -u webuser -pwebpass123 sign_manufacturing < 20251217_003_phase2_bidirectional_invoice_sync.sql

-- Add QB modification tracking columns
ALTER TABLE orders
  ADD COLUMN qb_invoice_last_updated_time DATETIME DEFAULT NULL
    COMMENT 'QB MetaData.LastUpdatedTime at last sync - for QB change detection'
    AFTER qb_invoice_synced_at,
  ADD COLUMN qb_invoice_sync_token VARCHAR(20) DEFAULT NULL
    COMMENT 'QB SyncToken at last sync - for optimistic locking and change detection'
    AFTER qb_invoice_last_updated_time,
  ADD COLUMN qb_invoice_content_hash VARCHAR(64) DEFAULT NULL
    COMMENT 'SHA256 of QB invoice line items at last sync - for content comparison'
    AFTER qb_invoice_sync_token;

-- Verify columns added
SELECT 'Phase 2 columns added successfully' AS status;
SHOW COLUMNS FROM orders LIKE 'qb_invoice%';
