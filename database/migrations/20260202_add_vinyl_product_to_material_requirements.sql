-- Migration: Add vinyl_product_id to material_requirements
-- Purpose: Enable linking material requirements directly to vinyl products
--          Use archetype_id = -1 convention to indicate vinyl selection
-- Date: 2026-02-02

-- Add vinyl_product_id column
ALTER TABLE material_requirements
ADD COLUMN vinyl_product_id INT NULL AFTER supplier_product_id;

-- Add foreign key constraint
ALTER TABLE material_requirements
ADD CONSTRAINT fk_material_req_vinyl_product
  FOREIGN KEY (vinyl_product_id) REFERENCES vinyl_products(product_id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_material_req_vinyl_product ON material_requirements(vinyl_product_id);
