-- Tax Data Validation Script
-- Date: 2025-10-07
-- Purpose: Validate tax system after overhaul migration

USE sign_manufacturing;

-- ============================================
-- CHECK 1: Provinces without tax coverage
-- ============================================
SELECT
  'Provinces without tax_rules' as check_name,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) = 0 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status
FROM provinces_tax pt
LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE pt.is_active = 1 AND tr.tax_rule_id IS NULL;

-- Show which provinces are missing (if any)
SELECT
  pt.province_short,
  pt.province_long,
  pt.tax_name,
  'Missing tax rule' as issue
FROM provinces_tax pt
LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE pt.is_active = 1 AND tr.tax_rule_id IS NULL;

-- ============================================
-- CHECK 2: Verify BC shows 5% GST (not 12%)
-- ============================================
SELECT
  'BC Tax Rate Check' as check_name,
  pt.province_short,
  pt.tax_name,
  tr.tax_percent,
  CASE
    WHEN tr.tax_percent = 0.05 THEN '✓ PASS - Correct 5% GST'
    ELSE '✗ FAIL - Should be 5% GST'
  END as status
FROM provinces_tax pt
LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE pt.province_short = 'BC';

-- ============================================
-- CHECK 3: Verify territories have tax rates
-- ============================================
SELECT
  'Territories Tax Coverage' as check_name,
  COUNT(*) as territories_with_tax,
  CASE
    WHEN COUNT(*) = 4 THEN '✓ PASS - All 4 territories covered'
    ELSE '✗ FAIL - Some territories missing'
  END as status
FROM provinces_tax pt
JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE pt.province_short IN ('NT', 'NU', 'YT', 'PE')
  AND pt.is_active = 1;

-- Show territory details
SELECT
  pt.province_short,
  pt.province_long,
  pt.tax_name,
  tr.tax_percent,
  CASE
    WHEN tr.tax_percent IS NOT NULL THEN '✓ Has tax rate'
    ELSE '✗ Missing tax rate'
  END as status
FROM provinces_tax pt
LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE pt.province_short IN ('NT', 'NU', 'YT', 'PE')
  AND pt.is_active = 1
ORDER BY pt.province_short;

-- ============================================
-- CHECK 4: Total tax coverage summary
-- ============================================
SELECT
  'Total Tax Coverage' as check_name,
  COUNT(*) as total_provinces,
  SUM(CASE WHEN tr.tax_percent IS NOT NULL THEN 1 ELSE 0 END) as provinces_with_tax,
  SUM(CASE WHEN tr.tax_percent IS NULL THEN 1 ELSE 0 END) as provinces_missing_tax,
  CASE
    WHEN SUM(CASE WHEN tr.tax_percent IS NULL THEN 1 ELSE 0 END) = 0 THEN '✓ PASS - Full coverage'
    ELSE '✗ FAIL - Incomplete coverage'
  END as status
FROM provinces_tax pt
LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE pt.is_active = 1;

-- ============================================
-- CHECK 5: Show any NULL tax_percent values
-- ============================================
SELECT
  'NULL Tax Rates in tax_rules' as check_name,
  COUNT(*) as null_count,
  CASE
    WHEN COUNT(*) = 0 THEN '✓ PASS - No NULL rates'
    ELSE '✗ FAIL - Found NULL rates'
  END as status
FROM tax_rules
WHERE is_active = 1 AND tax_percent IS NULL;

-- ============================================
-- CHECK 6: Sample of province → tax JOIN
-- ============================================
SELECT
  'Sample Province → Tax JOIN' as check_name;

SELECT
  pt.province_short,
  pt.province_long,
  pt.tax_name,
  tr.tax_percent,
  CONCAT(ROUND(tr.tax_percent * 100, 2), '%') as display_rate,
  CASE
    WHEN tr.tax_percent IS NULL THEN '✗ ERROR'
    ELSE '✓ OK'
  END as status
FROM provinces_tax pt
LEFT JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE pt.is_active = 1
ORDER BY
  tr.tax_percent IS NULL DESC,  -- Show errors first
  pt.province_short
LIMIT 15;

-- ============================================
-- CHECK 7: Verify customer addresses structure
-- ============================================
SELECT
  'Customer Addresses Schema Check' as check_name;

-- Verify use_province_tax column is removed
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✓ PASS - use_province_tax column removed'
    ELSE '✗ FAIL - use_province_tax column still exists'
  END as status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'sign_manufacturing'
  AND TABLE_NAME = 'customer_addresses'
  AND COLUMN_NAME = 'use_province_tax';

-- Verify tax_type column is removed
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✓ PASS - tax_type column removed'
    ELSE '✗ FAIL - tax_type column still exists'
  END as status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'sign_manufacturing'
  AND TABLE_NAME = 'customer_addresses'
  AND COLUMN_NAME = 'tax_type';

-- Verify tax_id column is removed
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✓ PASS - tax_id column removed'
    ELSE '✗ FAIL - tax_id column still exists'
  END as status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'sign_manufacturing'
  AND TABLE_NAME = 'customer_addresses'
  AND COLUMN_NAME = 'tax_id';

-- ============================================
-- SUMMARY
-- ============================================
SELECT '============================================' as '';
SELECT 'VALIDATION COMPLETE' as summary;
SELECT 'Review results above for any FAIL statuses' as next_steps;
SELECT '============================================' as '';
