-- Add Vinyl as a real product archetype
-- Date: 2026-02-03
-- Description: Convert vinyl from special -1 ID to real archetype
--              This eliminates NULL conversion logic and special case handling

-- ============================================
-- GET CATEGORY ID
-- ============================================

-- Use 'Print Media' category for vinyl products (or create Vinyl category if needed)
-- Check if Vinyl category exists, if not use Print Media
SET @vinyl_category_id = (SELECT id FROM material_categories WHERE name = 'Vinyl' LIMIT 1);

-- If no Vinyl category, create it
INSERT INTO material_categories (name, description, icon, sort_order, is_active)
SELECT 'Vinyl', 'Vinyl products - adhesive vinyl materials', 'layers', 20, TRUE
WHERE NOT EXISTS (SELECT 1 FROM material_categories WHERE name = 'Vinyl');

-- Get the category_id (either existing or newly created)
SET @vinyl_category_id = (SELECT id FROM material_categories WHERE name = 'Vinyl' LIMIT 1);

-- ============================================
-- INSERT VINYL ARCHETYPE
-- ============================================

-- Insert Vinyl as a real archetype
INSERT INTO product_archetypes (name, category_id, unit_of_measure, description, is_active, created_by, updated_by)
VALUES (
  'Vinyl',
  @vinyl_category_id,
  'sq_ft',
  'Vinyl products - adhesive vinyl materials for sign manufacturing',
  TRUE,
  1,
  1
);

-- Get the archetype_id that was just created
SET @vinyl_archetype_id = LAST_INSERT_ID();

-- ============================================
-- UPDATE EXISTING RECORDS
-- ============================================

-- Update existing material_requirements that have archetype_id = NULL and vinyl_product_id IS NOT NULL
-- These are the "vinyl" rows that were using the -1 convention
UPDATE material_requirements
SET archetype_id = @vinyl_archetype_id
WHERE archetype_id IS NULL
  AND vinyl_product_id IS NOT NULL;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Vinyl archetype created successfully' AS status;
SELECT pa.archetype_id, pa.name, mc.name as category_name
FROM product_archetypes pa
JOIN material_categories mc ON pa.category_id = mc.id
WHERE pa.name = 'Vinyl';
SELECT COUNT(*) AS vinyl_requirements_updated FROM material_requirements WHERE archetype_id = @vinyl_archetype_id;
