-- Migration: Sync QuickBooks Tax Codes from QB API
-- Date: 2025-11-19
-- Purpose: Map all active QB tax codes and set default fallback to "Exempt"
--
-- This migration:
-- 1. Updates existing tax code mappings with correct QB IDs
-- 2. Adds missing tax codes (Out of Scope, Zero-rated, Exempt, HST BC, adjustments)
-- 3. Ensures all system tax names have QB mappings
-- 4. Sets "Exempt" (QB ID 2) as the universal fallback in qb_settings
--
-- Default Tax Code Logic:
-- When tax_name is NULL or not found in qb_tax_code_mappings,
-- the system will use the default_tax_code_id from qb_settings.

USE sign_manufacturing;

-- Update existing mappings with correct QB IDs and tax rates
UPDATE qb_tax_code_mappings SET qb_tax_code_id = '2', tax_rate = 0.0000 WHERE tax_name = 'Exempt';
UPDATE qb_tax_code_mappings SET qb_tax_code_id = '7', tax_rate = 0.0500 WHERE tax_name = 'GST';
UPDATE qb_tax_code_mappings SET qb_tax_code_id = '18', tax_rate = 0.1500 WHERE tax_name = 'HST NB 2016';
UPDATE qb_tax_code_mappings SET qb_tax_code_id = '20', tax_rate = 0.1500 WHERE tax_name = 'HST NS';
UPDATE qb_tax_code_mappings SET qb_tax_code_id = '6', tax_rate = 0.1300 WHERE tax_name = 'HST ON';

-- Insert missing active tax codes from QuickBooks
INSERT INTO qb_tax_code_mappings (tax_name, qb_tax_code_id, tax_rate, last_synced_at)
VALUES
  -- 0% Tax Codes
  ('Out of Scope', '4', 0.0000, NOW()),
  ('Zero-rated', '3', 0.0000, NOW()),

  -- Provincial HST (not yet in system but available in QB)
  ('HST BC', '14', 0.1200, NOW()),

  -- HST for other provinces (using system naming convention)
  ('HST NL', '20', 0.1500, NOW()),  -- Map to HST NS (same 15% rate) until specific QB code created
  ('HST PE', '18', 0.1500, NOW()),  -- Map to HST NB 2016 (same 15% rate) until specific QB code created

  -- Tax Adjustment Codes (for special cases)
  ('GST/HST Adjustment', '5', NULL, NOW()),
  ('PST BC Adjustment', '16', NULL, NOW()),
  ('PST MB Adjustment', '12', NULL, NOW())
ON DUPLICATE KEY UPDATE
  qb_tax_code_id = VALUES(qb_tax_code_id),
  tax_rate = VALUES(tax_rate),
  last_synced_at = NOW();

-- Verify all system tax names are now mapped
SELECT
  tr.tax_name,
  qtc.qb_tax_code_id,
  tr.tax_percent as system_rate,
  qtc.tax_rate as qb_rate,
  CASE
    WHEN qtc.qb_tax_code_id IS NULL THEN '❌ UNMAPPED'
    ELSE '✓ Mapped'
  END as mapping_status
FROM tax_rules tr
LEFT JOIN qb_tax_code_mappings qtc ON tr.tax_name = qtc.tax_name
WHERE tr.is_active = 1
ORDER BY mapping_status DESC, tr.tax_name;

-- Set default tax code fallback in qb_settings
-- This is used when tax_name is NULL or not found in qb_tax_code_mappings
INSERT INTO qb_settings (setting_key, setting_value, description)
VALUES
  ('default_tax_code_id', '2', 'Default QuickBooks tax code ID for unmapped taxes (Exempt)'),
  ('default_tax_code_name', 'Exempt', 'Default QuickBooks tax code name for unmapped taxes')
ON DUPLICATE KEY UPDATE
  setting_value = VALUES(setting_value),
  description = VALUES(description),
  updated_at = NOW();

-- Show summary
SELECT
  COUNT(*) as total_mappings,
  COUNT(CASE WHEN tax_rate = 0 THEN 1 END) as zero_rate_codes,
  COUNT(CASE WHEN tax_rate > 0 THEN 1 END) as taxable_codes,
  COUNT(CASE WHEN tax_rate IS NULL THEN 1 END) as adjustment_codes
FROM qb_tax_code_mappings;

-- Show default tax code setting
SELECT * FROM qb_settings WHERE setting_key LIKE 'default_tax%';
