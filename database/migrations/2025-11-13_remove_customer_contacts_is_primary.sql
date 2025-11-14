/**
 * Migration: Remove is_primary column from customer_contacts table
 * Date: November 13, 2025
 * Reason: The is_primary feature was never implemented and is dead code.
 *         Future implementation will use dynamic logic (if customer has 1 contact,
 *         treat as primary automatically) instead of a database column.
 *
 * This migration:
 * 1. Drops the is_primary column from customer_contacts table
 * 2. Drops the idx_primary composite index
 *
 * IMPORTANT: This is a safe migration as the feature was never used in production.
 *            All contacts in the database have is_primary = 0.
 */

USE sign_manufacturing;

-- Step 1: Drop the idx_primary index
-- This is a composite index on (customer_id, is_primary)
ALTER TABLE customer_contacts
DROP INDEX idx_primary;

-- Step 2: Drop the is_primary column
ALTER TABLE customer_contacts
DROP COLUMN is_primary;

-- Verify the changes
SHOW CREATE TABLE customer_contacts;

-- Expected output should NOT include:
-- - is_primary column
-- - idx_primary index
