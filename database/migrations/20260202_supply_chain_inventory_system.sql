-- Supply Chain Management - Inventory System (Revised)
-- Date: 2026-02-02
-- Description: Inventory tracking at supplier_product level, with archetype aggregation
--
-- Data Model:
--   Archetype (concept) → Supplier Products (purchasable) → Inventory (stock)
--   Archetype stock = SUM of all its supplier products' stock

USE sign_manufacturing;

-- ============================================
-- 1. ADD INVENTORY FIELDS TO SUPPLIER_PRODUCTS
-- ============================================
-- Track stock at the supplier product level (what you actually buy/receive)

ALTER TABLE supplier_products
  ADD COLUMN quantity_on_hand DECIMAL(10,3) NOT NULL DEFAULT 0
    COMMENT 'Current stock quantity',
  ADD COLUMN quantity_reserved DECIMAL(10,3) NOT NULL DEFAULT 0
    COMMENT 'Reserved for orders in production',
  ADD COLUMN location VARCHAR(100) DEFAULT 'Main Storage'
    COMMENT 'Storage location',
  ADD COLUMN unit_cost DECIMAL(10,4) DEFAULT NULL
    COMMENT 'Current weighted average cost per unit',
  ADD COLUMN last_count_date DATE DEFAULT NULL
    COMMENT 'Last physical inventory count',
  ADD COLUMN reorder_point DECIMAL(10,3) DEFAULT NULL
    COMMENT 'Alert when qty falls below this (overrides archetype default)';

SELECT 'Added inventory columns to supplier_products' AS status;

-- Add index for stock queries
ALTER TABLE supplier_products
  ADD INDEX idx_sp_stock (quantity_on_hand, quantity_reserved);

SELECT 'Added stock index to supplier_products' AS status;

-- ============================================
-- 2. INVENTORY TRANSACTIONS - Movement History
-- ============================================
-- Tracks all inventory movements linked to supplier_products

CREATE TABLE IF NOT EXISTS inventory_transactions (
  transaction_id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_product_id INT NOT NULL,
  transaction_type ENUM('received', 'used', 'adjusted', 'returned', 'scrapped', 'transferred') NOT NULL,
  quantity DECIMAL(10,3) NOT NULL COMMENT 'Positive for in, negative for out',
  quantity_before DECIMAL(10,3) COMMENT 'Qty on hand before transaction',
  quantity_after DECIMAL(10,3) COMMENT 'Qty on hand after transaction',
  reference_type VARCHAR(50) COMMENT 'supplier_order, order, adjustment, transfer',
  reference_id INT COMMENT 'Related record ID (supplier_order_id, order_id, etc.)',
  unit_cost DECIMAL(10,4) COMMENT 'Cost per unit at time of transaction',
  total_cost DECIMAL(12,4) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  location_from VARCHAR(100) COMMENT 'Source location for transfers',
  location_to VARCHAR(100) COMMENT 'Destination location for transfers',
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_inv_trans_supplier_product FOREIGN KEY (supplier_product_id)
    REFERENCES supplier_products(supplier_product_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inv_trans_created_by FOREIGN KEY (created_by)
    REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_inv_trans_sp (supplier_product_id),
  INDEX idx_inv_trans_type (transaction_type),
  INDEX idx_inv_trans_reference (reference_type, reference_id),
  INDEX idx_inv_trans_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Inventory movement history - all stock changes logged here';

SELECT 'Created inventory_transactions table' AS status;

-- ============================================
-- 3. SUPPLIER PRODUCT STOCK VIEW
-- ============================================
-- Detailed view of each supplier product with stock status

CREATE OR REPLACE VIEW v_supplier_product_stock AS
SELECT
  sp.supplier_product_id,
  sp.product_name,
  sp.sku,
  sp.brand_name,
  sp.archetype_id,
  pa.name AS archetype_name,
  pa.category,
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
JOIN suppliers s ON sp.supplier_id = s.supplier_id
WHERE sp.is_active = TRUE;

SELECT 'Created v_supplier_product_stock view' AS status;

-- ============================================
-- 4. ARCHETYPE STOCK VIEW (Aggregated)
-- ============================================
-- Aggregates stock across all supplier products for each archetype

CREATE OR REPLACE VIEW v_archetype_stock_levels AS
SELECT
  pa.archetype_id,
  pa.name AS archetype_name,
  pa.category,
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
LEFT JOIN supplier_products sp ON pa.archetype_id = sp.archetype_id AND sp.is_active = TRUE
WHERE pa.is_active = TRUE
GROUP BY pa.archetype_id;

SELECT 'Created v_archetype_stock_levels view' AS status;

-- ============================================
-- 5. LOW STOCK ALERTS VIEW
-- ============================================
-- Items that need reordering

CREATE OR REPLACE VIEW v_low_stock_alerts AS
SELECT
  sp.supplier_product_id,
  sp.product_name,
  sp.sku,
  pa.archetype_id,
  pa.name AS archetype_name,
  pa.category,
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
JOIN suppliers s ON sp.supplier_id = s.supplier_id
WHERE sp.is_active = TRUE
  AND pa.is_active = TRUE
  AND (sp.quantity_on_hand - sp.quantity_reserved) <= COALESCE(sp.reorder_point, pa.reorder_point, 0) * 1.5
ORDER BY
  CASE WHEN (sp.quantity_on_hand - sp.quantity_reserved) <= 0 THEN 0
       WHEN (sp.quantity_on_hand - sp.quantity_reserved) <= COALESCE(sp.reorder_point, pa.reorder_point, 0) THEN 1
       ELSE 2
  END,
  pa.category,
  pa.name;

SELECT 'Created v_low_stock_alerts view' AS status;

-- ============================================
-- CLEANUP - Drop old tables if they exist
-- ============================================
DROP TABLE IF EXISTS archetype_inventory;
SELECT 'Dropped archetype_inventory (if existed)' AS status;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Supply Chain Inventory System migration complete' AS status;
SELECT COUNT(*) AS supplier_products_count FROM supplier_products;
SELECT * FROM v_archetype_stock_levels LIMIT 5;
