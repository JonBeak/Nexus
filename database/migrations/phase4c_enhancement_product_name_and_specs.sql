-- Phase 4.c Enhancement: Add Product Name and Specification Templates
-- Date: 2025-12-19
-- Purpose:
--   1. Add product_name field to supplier_products for display purposes
--   2. Add specifications_v2 field to product_archetypes for template-based specs
--   3. Migrate existing archetype specifications from objects to arrays (keys only)

-- ============================================================================
-- Part 1: Add product_name to supplier_products
-- ============================================================================

ALTER TABLE supplier_products
ADD COLUMN product_name VARCHAR(200) DEFAULT NULL
COMMENT 'Display name for this product (can differ from archetype name)';

-- Add index for efficient searching by product name
CREATE INDEX idx_product_name ON supplier_products(product_name);

-- ============================================================================
-- Part 2: Add specifications_v2 for archetype templates (array format)
-- ============================================================================

ALTER TABLE product_archetypes
ADD COLUMN specifications_v2 JSON DEFAULT NULL
COMMENT 'Specification keys template (array format) - keys only, no values';

-- ============================================================================
-- Part 3: Migrate existing archetype specifications
-- ============================================================================
-- This script extracts keys from existing specification objects and creates
-- an array of keys in the new specifications_v2 column.
-- Example: {"thickness": "3mm", "color": "red"} → ["thickness", "color"]

UPDATE product_archetypes
SET specifications_v2 = JSON_KEYS(specifications)
WHERE specifications IS NOT NULL
  AND JSON_VALID(specifications)
  AND JSON_TYPE(specifications) = 'OBJECT';

-- ============================================================================
-- Verification Queries (Run these to verify migration success)
-- ============================================================================

-- Check that specifications_v2 was populated correctly
-- SELECT COUNT(*) as total_archetypes,
--        COUNT(CASE WHEN specifications IS NOT NULL THEN 1 END) as with_specs,
--        COUNT(CASE WHEN specifications_v2 IS NOT NULL THEN 1 END) as with_specs_v2,
--        COUNT(CASE WHEN specifications IS NOT NULL AND specifications_v2 IS NULL THEN 1 END) as failed_migration
-- FROM product_archetypes;

-- View sample specifications migration
-- SELECT archetype_id, name,
--        JSON_LENGTH(JSON_KEYS(specifications)) as original_keys_count,
--        JSON_LENGTH(specifications_v2) as new_spec_keys_count,
--        specifications as original_format,
--        specifications_v2 as new_format
-- FROM product_archetypes
-- WHERE specifications IS NOT NULL
-- LIMIT 5;

-- Verify product_name column exists
-- SELECT supplier_product_id, product_name, brand_name, sku
-- FROM supplier_products
-- LIMIT 10;

-- Check the new index
-- SHOW INDEX FROM supplier_products WHERE Key_name = 'idx_product_name';

-- ============================================================================
-- Rollback Plan (if needed)
-- ============================================================================
-- ALTER TABLE supplier_products DROP COLUMN product_name;
-- DROP INDEX idx_product_name ON supplier_products;
-- ALTER TABLE product_archetypes DROP COLUMN specifications_v2;
