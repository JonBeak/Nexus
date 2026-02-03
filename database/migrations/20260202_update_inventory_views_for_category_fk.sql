-- Migration: Update inventory views for category_id FK
-- Date: 2026-02-02
-- Description: Update views to join with material_categories instead of using pa.category
-- Dependencies: 20260202_product_archetypes_category_fk.sql must run first

-- ============================================
-- DROP EXISTING VIEWS
-- ============================================

DROP VIEW IF EXISTS v_supplier_product_stock;
DROP VIEW IF EXISTS v_archetype_stock_levels;
DROP VIEW IF EXISTS v_low_stock_alerts;

-- ============================================
-- RECREATE v_supplier_product_stock
-- ============================================

CREATE VIEW v_supplier_product_stock AS
SELECT
  sp.supplier_product_id,
  sp.product_name,
  sp.sku,
  sp.brand_name,
  sp.archetype_id,
  pa.name AS archetype_name,
  mc.name AS category,
  pa.subcategory,
  pa.unit_of_measure,
  sp.supplier_id,
  s.name AS supplier_name,
  sp.quantity_on_hand,
  sp.quantity_reserved,
  (sp.quantity_on_hand - sp.quantity_reserved) AS quantity_available,
  sp.location,
  sp.unit_cost,
  sp.last_count_date,
  COALESCE(sp.reorder_point, pa.reorder_point) AS reorder_point,
  sp.min_order_quantity,
  sp.lead_time_days,
  sp.is_preferred,
  sp.is_active,
  CASE
    WHEN (sp.quantity_on_hand - sp.quantity_reserved) <= 0 THEN 'out_of_stock'
    WHEN (sp.quantity_on_hand - sp.quantity_reserved) <= COALESCE(sp.reorder_point, pa.reorder_point, 0) THEN 'critical'
    WHEN (sp.quantity_on_hand - sp.quantity_reserved) <= COALESCE(sp.reorder_point, pa.reorder_point, 0) * 1.5 THEN 'low'
    ELSE 'ok'
  END AS stock_status
FROM supplier_products sp
JOIN product_archetypes pa ON sp.archetype_id = pa.archetype_id
JOIN material_categories mc ON pa.category_id = mc.id
JOIN suppliers s ON sp.supplier_id = s.supplier_id
WHERE sp.is_active = TRUE;

-- ============================================
-- RECREATE v_archetype_stock_levels
-- ============================================

CREATE VIEW v_archetype_stock_levels AS
SELECT
  pa.archetype_id,
  pa.name AS archetype_name,
  mc.name AS category,
  pa.subcategory,
  pa.unit_of_measure,
  pa.reorder_point AS default_reorder_point,
  pa.is_active,
  COUNT(DISTINCT sp.supplier_product_id) AS supplier_product_count,
  COUNT(DISTINCT sp.supplier_id) AS supplier_count,
  COALESCE(SUM(sp.quantity_on_hand), 0) AS total_on_hand,
  COALESCE(SUM(sp.quantity_reserved), 0) AS total_reserved,
  COALESCE(SUM(sp.quantity_on_hand - sp.quantity_reserved), 0) AS total_available,
  MIN(sp.unit_cost) AS min_unit_cost,
  MAX(sp.unit_cost) AS max_unit_cost,
  AVG(sp.unit_cost) AS avg_unit_cost,
  CASE
    WHEN COALESCE(SUM(sp.quantity_on_hand - sp.quantity_reserved), 0) <= 0 THEN 'out_of_stock'
    WHEN COALESCE(SUM(sp.quantity_on_hand - sp.quantity_reserved), 0) <= COALESCE(pa.reorder_point, 0) THEN 'critical'
    WHEN COALESCE(SUM(sp.quantity_on_hand - sp.quantity_reserved), 0) <= COALESCE(pa.reorder_point, 0) * 1.5 THEN 'low'
    ELSE 'ok'
  END AS stock_status
FROM product_archetypes pa
JOIN material_categories mc ON pa.category_id = mc.id
LEFT JOIN supplier_products sp ON pa.archetype_id = sp.archetype_id AND sp.is_active = TRUE
WHERE pa.is_active = TRUE
GROUP BY pa.archetype_id, mc.name;

-- ============================================
-- RECREATE v_low_stock_alerts
-- ============================================

CREATE VIEW v_low_stock_alerts AS
SELECT
  sp.supplier_product_id,
  sp.product_name,
  sp.sku,
  pa.archetype_id,
  pa.name AS archetype_name,
  mc.name AS category,
  s.supplier_id,
  s.name AS supplier_name,
  sp.quantity_on_hand,
  sp.quantity_reserved,
  (sp.quantity_on_hand - sp.quantity_reserved) AS quantity_available,
  COALESCE(sp.reorder_point, pa.reorder_point) AS reorder_point,
  sp.min_order_quantity,
  sp.unit_cost,
  sp.lead_time_days,
  CASE
    WHEN (sp.quantity_on_hand - sp.quantity_reserved) <= 0 THEN 'out_of_stock'
    WHEN (sp.quantity_on_hand - sp.quantity_reserved) <= COALESCE(sp.reorder_point, pa.reorder_point, 0) THEN 'critical'
    ELSE 'low'
  END AS alert_level
FROM supplier_products sp
JOIN product_archetypes pa ON sp.archetype_id = pa.archetype_id
JOIN material_categories mc ON pa.category_id = mc.id
JOIN suppliers s ON sp.supplier_id = s.supplier_id
WHERE sp.is_active = TRUE
  AND pa.is_active = TRUE
  AND (sp.quantity_on_hand - sp.quantity_reserved) <= COALESCE(sp.reorder_point, pa.reorder_point, 0) * 1.5
ORDER BY
  CASE
    WHEN (sp.quantity_on_hand - sp.quantity_reserved) <= 0 THEN 0
    WHEN (sp.quantity_on_hand - sp.quantity_reserved) <= COALESCE(sp.reorder_point, pa.reorder_point, 0) THEN 1
    ELSE 2
  END,
  mc.name,
  pa.name;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Inventory views updated for category_id FK' AS status;
