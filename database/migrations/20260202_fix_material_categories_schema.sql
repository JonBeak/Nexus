-- Migration: Fix material_categories schema
-- Date: 2026-02-02
-- Description: Create material_categories table with correct schema (id as PK, not category_id)
--              and populate with categories from existing product_archetypes

-- ============================================
-- CREATE material_categories TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS material_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT 'Display name: LED, Transformer, Substrate, etc.',
  description TEXT DEFAULT NULL COMMENT 'Optional description of the category',
  icon VARCHAR(50) DEFAULT 'box' COMMENT 'Lucide icon name: zap, cpu, layers, etc.',
  color VARCHAR(50) DEFAULT 'bg-gray-100 text-gray-700' COMMENT 'Tailwind color class',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_category_name (name),
  INDEX idx_category_active (is_active),
  INDEX idx_category_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Dynamic material categories for product archetypes';

-- ============================================
-- POPULATE FROM EXISTING ARCHETYPES
-- ============================================

-- Insert distinct categories from product_archetypes
-- Uses predefined colors for known categories, gray default for others
INSERT IGNORE INTO material_categories (name, icon, color, sort_order)
SELECT DISTINCT
  pa.category,
  CASE pa.category
    WHEN 'LED' THEN 'zap'
    WHEN 'led' THEN 'zap'
    WHEN 'Transformer' THEN 'cpu'
    WHEN 'Power Supply' THEN 'cpu'
    WHEN 'Substrate' THEN 'layers'
    WHEN 'Hardware' THEN 'wrench'
    WHEN 'Paint' THEN 'paintbrush'
    WHEN 'paint' THEN 'paintbrush'
    WHEN 'Vinyl' THEN 'package'
    WHEN 'Trim Cap' THEN 'box'
    WHEN 'trim_cap' THEN 'box'
    WHEN 'Electrical' THEN 'cable'
    WHEN 'Misc' THEN 'box'
    ELSE 'box'
  END as icon,
  CASE pa.category
    WHEN 'LED' THEN 'bg-yellow-100 text-yellow-700'
    WHEN 'led' THEN 'bg-yellow-100 text-yellow-700'
    WHEN 'Transformer' THEN 'bg-blue-100 text-blue-700'
    WHEN 'Power Supply' THEN 'bg-blue-100 text-blue-700'
    WHEN 'Substrate' THEN 'bg-green-100 text-green-700'
    WHEN 'Hardware' THEN 'bg-gray-100 text-gray-700'
    WHEN 'Paint' THEN 'bg-purple-100 text-purple-700'
    WHEN 'paint' THEN 'bg-purple-100 text-purple-700'
    WHEN 'Vinyl' THEN 'bg-pink-100 text-pink-700'
    WHEN 'Trim Cap' THEN 'bg-orange-100 text-orange-700'
    WHEN 'trim_cap' THEN 'bg-orange-100 text-orange-700'
    WHEN 'Electrical' THEN 'bg-red-100 text-red-700'
    WHEN 'Misc' THEN 'bg-slate-100 text-slate-700'
    ELSE 'bg-gray-100 text-gray-700'
  END as color,
  CASE pa.category
    WHEN 'LED' THEN 1
    WHEN 'led' THEN 1
    WHEN 'Transformer' THEN 2
    WHEN 'Power Supply' THEN 2
    WHEN 'Substrate' THEN 3
    WHEN 'Hardware' THEN 4
    WHEN 'Paint' THEN 5
    WHEN 'paint' THEN 5
    WHEN 'Vinyl' THEN 6
    WHEN 'Trim Cap' THEN 7
    WHEN 'trim_cap' THEN 7
    WHEN 'Electrical' THEN 8
    WHEN 'Misc' THEN 9
    ELSE 99
  END as sort_order
FROM product_archetypes pa
WHERE pa.category IS NOT NULL AND pa.category != '';

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'material_categories created/updated' AS status;
SELECT * FROM material_categories ORDER BY sort_order, name;
