-- Migration: Drop unused 'type' column from vinyl_products table
-- Date: 2025-11-14
-- Reason: Column is completely unused (0/226 rows have data, not in any code)

-- Verification queries (run these first to confirm):
-- SELECT COUNT(*) as total, COUNT(type) as with_type FROM vinyl_products;
-- Expected: total=226, with_type=0

-- Drop the column
ALTER TABLE vinyl_products
DROP COLUMN type;

-- Verify column is dropped
-- SHOW CREATE TABLE vinyl_products;
