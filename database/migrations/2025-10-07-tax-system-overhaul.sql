-- Tax System Overhaul - Schema Restructuring
-- Phase 3: Separate province data from tax rate data using tax_name as join key
-- Date: 2025-10-07

USE sign_manufacturing;

-- ============================================
-- STEP 1: Add tax_name column to tax_rules
-- ============================================

-- Add new column if it doesn't exist
SET @add_tax_name = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA='sign_manufacturing'
   AND TABLE_NAME='tax_rules'
   AND COLUMN_NAME='tax_name') = 0,
  'ALTER TABLE tax_rules ADD COLUMN tax_name VARCHAR(50) AFTER tax_rule_id',
  'SELECT "tax_name already exists" as status'
);
PREPARE stmt FROM @add_tax_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Populate from tax_type if needed (only if tax_type column still exists)
SET @tax_type_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA='sign_manufacturing'
  AND TABLE_NAME='tax_rules'
  AND COLUMN_NAME='tax_type'
);

SET @populate_tax_name = IF(@tax_type_exists > 0,
  'UPDATE tax_rules SET tax_name = tax_type WHERE tax_name IS NULL OR tax_name = \'\'',
  'SELECT "tax_type already dropped, skipping populate" as status'
);

PREPARE stmt FROM @populate_tax_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make it NOT NULL after populating
ALTER TABLE tax_rules
MODIFY COLUMN tax_name VARCHAR(50) NOT NULL;

-- ============================================
-- STEP 2: Remove tax data from provinces_tax
-- ============================================

-- Remove tax_percent (data now lives in tax_rules)
-- Check if column exists before dropping
SET @drop_tax_percent = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA='sign_manufacturing'
   AND TABLE_NAME='provinces_tax'
   AND COLUMN_NAME='tax_percent') > 0,
  'ALTER TABLE provinces_tax DROP COLUMN tax_percent',
  'SELECT "tax_percent already dropped" as status'
);
PREPARE stmt FROM @drop_tax_percent;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Remove tax_description (not needed)
SET @drop_tax_desc = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA='sign_manufacturing'
   AND TABLE_NAME='provinces_tax'
   AND COLUMN_NAME='tax_description') > 0,
  'ALTER TABLE provinces_tax DROP COLUMN tax_description',
  'SELECT "tax_description already dropped" as status'
);
PREPARE stmt FROM @drop_tax_desc;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- STEP 3: Clean up customer_addresses
-- ============================================

-- Drop all foreign keys related to tax_id and tax_type
SET @fk_tax_id = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = 'sign_manufacturing'
    AND TABLE_NAME = 'customer_addresses'
    AND CONSTRAINT_NAME = 'fk_customer_address_tax'
);

SET @drop_fk_tax = IF(@fk_tax_id > 0,
  'ALTER TABLE customer_addresses DROP FOREIGN KEY fk_customer_address_tax',
  'SELECT "fk_customer_address_tax does not exist" as status'
);

PREPARE stmt FROM @drop_fk_tax;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop old foreign key if it exists
SET @fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = 'sign_manufacturing'
    AND TABLE_NAME = 'customer_addresses'
    AND CONSTRAINT_NAME = 'customer_addresses_ibfk_2'
);

SET @drop_fk = IF(@fk_exists > 0,
  'ALTER TABLE customer_addresses DROP FOREIGN KEY customer_addresses_ibfk_2',
  'SELECT "customer_addresses_ibfk_2 does not exist" as status'
);

PREPARE stmt FROM @drop_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Remove tax_type (now derived from province → tax_name)
SET @drop_tax_type = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA='sign_manufacturing'
   AND TABLE_NAME='customer_addresses'
   AND COLUMN_NAME='tax_type') > 0,
  'ALTER TABLE customer_addresses DROP COLUMN tax_type',
  'SELECT "tax_type already dropped" as status'
);
PREPARE stmt FROM @drop_tax_type;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Remove tax_id (redundant - we join via province)
SET @drop_tax_id = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA='sign_manufacturing'
   AND TABLE_NAME='customer_addresses'
   AND COLUMN_NAME='tax_id') > 0,
  'ALTER TABLE customer_addresses DROP COLUMN tax_id',
  'SELECT "tax_id already dropped" as status'
);
PREPARE stmt FROM @drop_tax_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Remove use_province_tax (redundant - logic is: override exists ? use override : use province)
SET @drop_use_prov_tax = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA='sign_manufacturing'
   AND TABLE_NAME='customer_addresses'
   AND COLUMN_NAME='use_province_tax') > 0,
  'ALTER TABLE customer_addresses DROP COLUMN use_province_tax',
  'SELECT "use_province_tax already dropped" as status'
);
PREPARE stmt FROM @drop_use_prov_tax;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Note: Invalid province codes should be fixed manually before running this migration

-- Add proper foreign key to provinces_tax (only if not exists)
SET @fk_prov_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = 'sign_manufacturing'
    AND TABLE_NAME = 'customer_addresses'
    AND CONSTRAINT_NAME = 'fk_address_province'
);

SET @add_fk_prov = IF(@fk_prov_exists = 0,
  'ALTER TABLE customer_addresses ADD CONSTRAINT fk_address_province FOREIGN KEY (province_state_short) REFERENCES provinces_tax(province_short)',
  'SELECT "fk_address_province already exists" as status'
);

PREPARE stmt FROM @add_fk_prov;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- STEP 4: Remove province columns from tax_rules
-- ============================================

-- Break the tight coupling - tax_rules no longer tied to specific provinces
SET @drop_prov_code = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA='sign_manufacturing'
   AND TABLE_NAME='tax_rules'
   AND COLUMN_NAME='province_state_code') > 0,
  'ALTER TABLE tax_rules DROP COLUMN province_state_code',
  'SELECT "province_state_code already dropped" as status'
);
PREPARE stmt FROM @drop_prov_code;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @drop_prov_name = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA='sign_manufacturing'
   AND TABLE_NAME='tax_rules'
   AND COLUMN_NAME='province_state_name') > 0,
  'ALTER TABLE tax_rules DROP COLUMN province_state_name',
  'SELECT "province_state_name already dropped" as status'
);
PREPARE stmt FROM @drop_prov_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Remove old tax_type column (replaced by tax_name)
SET @drop_old_tax_type = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA='sign_manufacturing'
   AND TABLE_NAME='tax_rules'
   AND COLUMN_NAME='tax_type') > 0,
  'ALTER TABLE tax_rules DROP COLUMN tax_type',
  'SELECT "tax_type already dropped" as status'
);
PREPARE stmt FROM @drop_old_tax_type;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- STEP 5: Add unique constraint on tax_name
-- ============================================

-- First, remove any duplicate active tax rules (keep only the first one)
DELETE t1 FROM tax_rules t1
INNER JOIN tax_rules t2
WHERE t1.tax_rule_id > t2.tax_rule_id
  AND t1.tax_name = t2.tax_name
  AND t1.is_active = 1
  AND t2.is_active = 1;

-- Ensure only one active tax rule per tax_name (add constraint if not exists)
SET @unique_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'sign_manufacturing'
    AND TABLE_NAME = 'tax_rules'
    AND INDEX_NAME = 'unique_active_tax_name'
);

SET @add_unique = IF(@unique_exists = 0,
  'ALTER TABLE tax_rules ADD UNIQUE KEY unique_active_tax_name (tax_name, is_active)',
  'SELECT "unique_active_tax_name already exists" as status'
);

PREPARE stmt FROM @add_unique;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- STEP 6: Recreate views with new JOIN structure
-- ============================================

-- Drop old view
DROP VIEW IF EXISTS customer_addresses_with_tax;

-- Create new view with province → tax_name → tax_percent JOIN
CREATE VIEW customer_addresses_with_tax AS
SELECT
  ca.address_id,
  ca.customer_id,
  c.company_name,
  ca.customer_address_sequence,
  ca.is_primary,
  ca.is_billing,
  ca.is_shipping,
  ca.is_jobsite,
  ca.is_mailing,
  ca.address_line1,
  ca.address_line2,
  ca.city,
  ca.province_state_short,
  ca.postal_zip,
  ca.is_active,

  -- Tax calculation logic
  pt.tax_name,
  CASE
    WHEN ca.tax_override_percent IS NOT NULL THEN ca.tax_override_percent
    WHEN tr.tax_percent IS NOT NULL THEN tr.tax_percent
    ELSE 1.0  -- 100% = ERROR indicator (missing tax data)
  END as applicable_tax_percent,

  CASE
    WHEN ca.tax_override_percent IS NOT NULL THEN 'Override'
    WHEN tr.tax_percent IS NOT NULL THEN pt.tax_name
    ELSE 'ERROR: Missing Tax Data'
  END as tax_source,

  tr.tax_percent as province_tax_percent,
  ca.tax_override_percent,
  ca.tax_override_reason,
  ca.comments
FROM customer_addresses ca
JOIN customers c ON ca.customer_id = c.customer_id
LEFT JOIN provinces_tax pt ON ca.province_state_short = pt.province_short AND pt.is_active = 1
LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE ca.is_active = 1
ORDER BY c.company_name, ca.customer_address_sequence;

-- Update primary addresses view
DROP VIEW IF EXISTS customer_primary_addresses;

CREATE VIEW customer_primary_addresses AS
SELECT
  ca.customer_id,
  c.company_name,
  ca.address_line1,
  ca.address_line2,
  ca.city,
  ca.province_state_short,
  ca.postal_zip,
  pt.tax_name,
  CASE
    WHEN ca.tax_override_percent IS NOT NULL THEN ca.tax_override_percent
    WHEN tr.tax_percent IS NOT NULL THEN tr.tax_percent
    ELSE 1.0
  END as tax_percent
FROM customer_addresses ca
JOIN customers c ON ca.customer_id = c.customer_id
LEFT JOIN provinces_tax pt ON ca.province_state_short = pt.province_short AND pt.is_active = 1
LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE ca.is_primary = 1 AND ca.is_active = 1
ORDER BY c.company_name;

-- ============================================
-- VALIDATION QUERIES
-- ============================================

-- Show schema changes
SELECT 'Schema restructure complete' as status;

-- Verify no provinces are missing tax rules
SELECT
  'Provinces without tax_rules' as check_name,
  COUNT(*) as count
FROM provinces_tax pt
LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE pt.is_active = 1 AND tr.tax_rule_id IS NULL;

-- Show sample of new JOIN structure
SELECT
  pt.province_short,
  pt.tax_name,
  tr.tax_percent,
  CASE WHEN tr.tax_percent IS NULL THEN 'ERROR' ELSE 'OK' END as status
FROM provinces_tax pt
LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE pt.is_active = 1
ORDER BY tr.tax_percent IS NULL DESC, pt.province_short
LIMIT 10;

COMMIT;
