-- Migration: Add category_id FK to product_archetypes
-- Date: 2026-02-02
-- Description: Replace category VARCHAR with category_id FK pointing to material_categories
-- Dependencies: 20260202_fix_material_categories_schema.sql must run first

-- ============================================
-- STEP 1: Add category_id column
-- ============================================

ALTER TABLE product_archetypes
  ADD COLUMN category_id INT DEFAULT NULL AFTER category;

-- ============================================
-- STEP 2: Populate category_id from existing category name
-- ============================================

UPDATE product_archetypes pa
  JOIN material_categories mc ON pa.category = mc.name
  SET pa.category_id = mc.id;

-- ============================================
-- STEP 3: Check for any orphaned categories (should be none after migration 1)
-- ============================================

-- Show any archetypes with NULL category_id (shouldn't be any)
SELECT archetype_id, name, category
FROM product_archetypes
WHERE category_id IS NULL;

-- ============================================
-- STEP 4: Make category_id NOT NULL and add FK constraint
-- ============================================

-- Only proceed if all archetypes have category_id set
-- If this fails, it means there are orphaned categories that need to be handled

ALTER TABLE product_archetypes
  MODIFY COLUMN category_id INT NOT NULL;

ALTER TABLE product_archetypes
  ADD CONSTRAINT fk_archetype_category
    FOREIGN KEY (category_id) REFERENCES material_categories(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Add index for FK lookups
CREATE INDEX idx_archetype_category_id ON product_archetypes(category_id);

-- ============================================
-- STEP 5: Drop the old category VARCHAR column
-- ============================================

-- Drop the old index on category first
DROP INDEX idx_archetype_category ON product_archetypes;
DROP INDEX idx_archetype_category_active ON product_archetypes;

-- Drop the VARCHAR column
ALTER TABLE product_archetypes
  DROP COLUMN category;

-- Create new composite index with category_id
CREATE INDEX idx_archetype_category_id_active ON product_archetypes(category_id, is_active);

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'product_archetypes migrated to category_id FK' AS status;

-- Show updated structure
DESCRIBE product_archetypes;

-- Show archetypes with their category names via JOIN
SELECT
  pa.archetype_id,
  pa.name,
  pa.category_id,
  mc.name as category_name
FROM product_archetypes pa
JOIN material_categories mc ON pa.category_id = mc.id
ORDER BY mc.sort_order, pa.name
LIMIT 10;
