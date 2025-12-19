-- Phase 4.b Enhancement: Dynamic Material Categories
-- Date: 2025-12-18
-- Description: Move categories from ENUM to editable table

-- ============================================
-- CREATE material_categories TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS material_categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT 'Display name: LED, Transformer, Substrate, etc.',
  slug VARCHAR(50) NOT NULL COMMENT 'URL-safe identifier: led, transformer, substrate',
  icon VARCHAR(50) DEFAULT NULL COMMENT 'Lucide icon name: zap, cpu, layers, etc.',
  color VARCHAR(50) DEFAULT NULL COMMENT 'Tailwind color class: bg-yellow-100 text-yellow-700',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_category_name (name),
  UNIQUE KEY uk_category_slug (slug),
  INDEX idx_category_active (is_active),
  INDEX idx_category_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Dynamic material categories for product archetypes';

-- ============================================
-- POPULATE WITH EXISTING CATEGORIES
-- ============================================

INSERT INTO material_categories (name, slug, icon, color, sort_order) VALUES
('LED', 'led', 'zap', 'bg-yellow-100 text-yellow-700', 1),
('Transformer', 'transformer', 'cpu', 'bg-blue-100 text-blue-700', 2),
('Substrate', 'substrate', 'layers', 'bg-green-100 text-green-700', 3),
('Hardware', 'hardware', 'wrench', 'bg-gray-100 text-gray-700', 4),
('Paint', 'paint', 'paintbrush', 'bg-purple-100 text-purple-700', 5),
('Vinyl', 'vinyl', 'package', 'bg-pink-100 text-pink-700', 6),
('Trim Cap', 'trim_cap', 'box', 'bg-orange-100 text-orange-700', 7),
('Electrical', 'electrical', 'cable', 'bg-red-100 text-red-700', 8),
('Misc', 'misc', 'box', 'bg-slate-100 text-slate-700', 9);

-- ============================================
-- ALTER product_archetypes TO USE VARCHAR
-- ============================================

-- Change category from ENUM to VARCHAR to allow dynamic values
ALTER TABLE product_archetypes
  MODIFY COLUMN category VARCHAR(50) NOT NULL;

-- Add foreign key constraint (optional - using slug reference)
-- Note: Not adding FK constraint to allow flexibility, but data should match

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Phase 4.b categories migration complete' AS status;
SELECT * FROM material_categories ORDER BY sort_order;
