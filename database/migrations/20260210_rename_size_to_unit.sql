-- Migration: Rename size_description → unit in material_requirements
-- Date: 2026-02-10
-- Purpose: Replace freeform "Size" with structured "Unit" from product archetypes

-- 1. Rename column
ALTER TABLE material_requirements CHANGE COLUMN size_description unit VARCHAR(50) DEFAULT 'each';

-- 2. Backfill from product archetype unit_of_measure
UPDATE material_requirements mr
  JOIN product_archetypes pa ON mr.archetype_id = pa.archetype_id
SET mr.unit = pa.unit_of_measure
WHERE mr.unit IS NULL OR mr.unit = '';

-- 3. Default remaining NULLs/empty to 'each'
UPDATE material_requirements SET unit = 'each' WHERE unit IS NULL OR unit = '';
