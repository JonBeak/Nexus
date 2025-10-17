-- Tax Data Conflict Resolution
-- Phase 2: Fix BC tax rate in provinces_tax
-- Date: 2025-10-07
-- Note: This runs BEFORE the schema overhaul migration

USE sign_manufacturing;

-- ============================================
-- CRITICAL FIX: BC Tax Conflict Resolution
-- ============================================
-- Problem: provinces_tax shows 12% HST, but production uses 5% GST
-- Solution: Update provinces_tax to show correct 5% GST

UPDATE provinces_tax
SET tax_name = 'GST',
    tax_percent = 5.00,
    updated_at = CURRENT_TIMESTAMP
WHERE province_short = 'BC';

-- ============================================
-- VALIDATION
-- ============================================

-- Verify BC shows 5% GST
SELECT
  'BC Tax Rate Check' as status,
  province_short,
  tax_name,
  tax_percent,
  CASE
    WHEN tax_percent = 5.00 AND tax_name = 'GST' THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as result
FROM provinces_tax
WHERE province_short = 'BC';

COMMIT;
