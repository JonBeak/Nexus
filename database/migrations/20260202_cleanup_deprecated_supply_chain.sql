-- Supply Chain Management - Phase 0: Cleanup Deprecated System
-- Date: 2026-02-02
-- Description: Remove old Phase 1 supply chain system based on product_standards
-- Note: This system was never fully implemented and has been replaced by
--       the product_archetypes-based system

USE sign_manufacturing;

-- ============================================
-- VERIFICATION - Before Cleanup
-- ============================================
-- Run this first to verify what will be removed:

SELECT 'CLEANUP VERIFICATION - Row counts before deletion:' AS note;

SELECT 'material_categories' AS table_name, COUNT(*) AS row_count FROM material_categories
UNION ALL SELECT 'product_standards', COUNT(*) FROM product_standards
UNION ALL SELECT 'category_fields', COUNT(*) FROM category_fields
UNION ALL SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL SELECT 'inventory_reservations', COUNT(*) FROM inventory_reservations
UNION ALL SELECT 'job_material_requirements', COUNT(*) FROM job_material_requirements;

-- ============================================
-- 1. DROP VIEW FIRST (depends on product_standards)
-- ============================================

DROP VIEW IF EXISTS low_stock_items;
SELECT 'Dropped view: low_stock_items' AS status;

-- ============================================
-- 2. DROP FOREIGN KEY CONSTRAINTS FIRST
-- ============================================

-- job_invoice_items has a FK to job_material_requirements (column: material_requirement_id)
-- This constraint must be dropped before we can drop job_material_requirements
ALTER TABLE job_invoice_items DROP FOREIGN KEY job_invoice_items_ibfk_3;
SELECT 'Dropped FK: job_invoice_items_ibfk_3 (material_requirement_id)' AS status;

-- Also drop the column since it references a table we're removing
ALTER TABLE job_invoice_items DROP COLUMN material_requirement_id;
SELECT 'Dropped column: job_invoice_items.material_requirement_id' AS status;

-- ============================================
-- 3. DROP TABLES WITH FK DEPENDENCIES (in correct order)
-- ============================================

-- inventory_reservations depends on inventory
DROP TABLE IF EXISTS inventory_reservations;
SELECT 'Dropped table: inventory_reservations' AS status;

-- job_material_requirements depends on product_standards and orders
DROP TABLE IF EXISTS job_material_requirements;
SELECT 'Dropped table: job_material_requirements' AS status;

-- inventory depends on product_standards
DROP TABLE IF EXISTS inventory;
SELECT 'Dropped table: inventory' AS status;

-- category_fields depends on material_categories
DROP TABLE IF EXISTS category_fields;
SELECT 'Dropped table: category_fields' AS status;

-- product_standards depends on material_categories
DROP TABLE IF EXISTS product_standards;
SELECT 'Dropped table: product_standards' AS status;

-- material_categories is the base table
DROP TABLE IF EXISTS material_categories;
SELECT 'Dropped table: material_categories' AS status;

-- ============================================
-- VERIFICATION - After Cleanup
-- ============================================

SELECT 'CLEANUP COMPLETE - Tables remaining:' AS note;

SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'sign_manufacturing'
AND TABLE_NAME IN (
  'low_stock_items',
  'inventory_reservations',
  'job_material_requirements',
  'inventory',
  'category_fields',
  'product_standards',
  'material_categories'
);

SELECT 'Phase 0 cleanup migration complete' AS status;
