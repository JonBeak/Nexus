-- Add Country Column to provinces_tax
-- Date: 2025-10-07
-- Purpose: Store country in database instead of hardcoding in code

USE sign_manufacturing;

-- ============================================
-- STEP 1: Add country column (nullable first)
-- ============================================

ALTER TABLE provinces_tax
ADD COLUMN country VARCHAR(50) AFTER province_long;

-- ============================================
-- STEP 2: Populate country based on province codes
-- ============================================

-- Canadian provinces and territories
UPDATE provinces_tax
SET country = 'Canada'
WHERE province_short IN (
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'
);

-- US states
UPDATE provinces_tax
SET country = 'United States'
WHERE province_short IN (
  'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI',
  'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN',
  'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH',
  'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'USA', 'UT', 'VA', 'VT',
  'WA', 'WI', 'WV', 'WY'
);

-- Special entries (EXEMPT, ZERO)
UPDATE provinces_tax
SET country = 'N/A'
WHERE province_short IN ('EXEMPT', 'ZERO');

-- ============================================
-- STEP 3: Make country NOT NULL
-- ============================================

ALTER TABLE provinces_tax
MODIFY COLUMN country VARCHAR(50) NOT NULL;

-- ============================================
-- VALIDATION
-- ============================================

-- Check for any NULL countries (should be 0)
SELECT
  'Countries with NULL values' as check_name,
  COUNT(*) as null_count,
  CASE
    WHEN COUNT(*) = 0 THEN '✓ PASS'
    ELSE '✗ FAIL - Found NULL countries'
  END as status
FROM provinces_tax
WHERE country IS NULL;

-- Show country distribution
SELECT
  country,
  COUNT(*) as province_count
FROM provinces_tax
GROUP BY country
ORDER BY country;

COMMIT;
