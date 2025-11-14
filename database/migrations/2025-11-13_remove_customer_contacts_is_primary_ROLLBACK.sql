/**
 * ROLLBACK Migration: Restore is_primary column to customer_contacts table
 * Date: November 13, 2025
 * Reason: Rollback for 2025-11-13_remove_customer_contacts_is_primary.sql
 *
 * This rollback migration:
 * 1. Re-adds the is_primary column to customer_contacts table
 * 2. Re-creates the idx_primary composite index
 * 3. Sets default value to 0 (false) for all existing contacts
 *
 * ONLY USE THIS IF YOU NEED TO ROLLBACK THE REMOVAL
 */

USE sign_manufacturing;

-- Step 1: Re-add the is_primary column
ALTER TABLE customer_contacts
ADD COLUMN is_primary TINYINT(1) DEFAULT 0 AFTER contact_role;

-- Step 2: Re-create the composite index
ALTER TABLE customer_contacts
ADD INDEX idx_primary (customer_id, is_primary);

-- Verify the changes
SHOW CREATE TABLE customer_contacts;

-- Expected output should include:
-- - is_primary TINYINT(1) DEFAULT '0'
-- - KEY `idx_primary` (`customer_id`,`is_primary`)
