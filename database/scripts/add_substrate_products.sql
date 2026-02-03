-- Add Substrate Product Types
-- Created: 2026-02-02
-- Adds PVC, Polycarbonate, Acrylic, ACM, and Aluminum substrate combinations
-- Will skip any that already exist (due to unique constraint on name)

-- Set variables for created_by (using a generic system user id, adjust if needed)
SET @created_by = NULL;  -- Will be set to NULL if no specific user

-- Get Substrate category ID
SET @substrate_category_id = (SELECT id FROM material_categories WHERE name = 'Substrate' AND is_active = TRUE);

-- PVC Products (White, Black)
INSERT IGNORE INTO product_archetypes (name, category_id, subcategory, unit_of_measure, specifications, reorder_point, created_by, updated_by)
VALUES
  ('3mm PVC - White', @substrate_category_id, 'pvc', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'PVC', 'colour', 'White'), 0, @created_by, @created_by),
  ('3mm PVC - Black', @substrate_category_id, 'pvc', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'PVC', 'colour', 'Black'), 0, @created_by, @created_by),
  ('6mm PVC - White', @substrate_category_id, 'pvc', 'sq_ft', JSON_OBJECT('size', '6mm', 'material', 'PVC', 'colour', 'White'), 0, @created_by, @created_by),
  ('6mm PVC - Black', @substrate_category_id, 'pvc', 'sq_ft', JSON_OBJECT('size', '6mm', 'material', 'PVC', 'colour', 'Black'), 0, @created_by, @created_by),
  ('12mm PVC - White', @substrate_category_id, 'pvc', 'sq_ft', JSON_OBJECT('size', '12mm', 'material', 'PVC', 'colour', 'White'), 0, @created_by, @created_by),
  ('12mm PVC - Black', @substrate_category_id, 'pvc', 'sq_ft', JSON_OBJECT('size', '12mm', 'material', 'PVC', 'colour', 'Black'), 0, @created_by, @created_by),
  ('18mm PVC - White', @substrate_category_id, 'pvc', 'sq_ft', JSON_OBJECT('size', '18mm', 'material', 'PVC', 'colour', 'White'), 0, @created_by, @created_by),
  ('18mm PVC - Black', @substrate_category_id, 'pvc', 'sq_ft', JSON_OBJECT('size', '18mm', 'material', 'PVC', 'colour', 'Black'), 0, @created_by, @created_by),
  ('24mm PVC - White', @substrate_category_id, 'pvc', 'sq_ft', JSON_OBJECT('size', '24mm', 'material', 'PVC', 'colour', 'White'), 0, @created_by, @created_by),
  ('24mm PVC - Black', @substrate_category_id, 'pvc', 'sq_ft', JSON_OBJECT('size', '24mm', 'material', 'PVC', 'colour', 'Black'), 0, @created_by, @created_by);

-- Polycarbonate Products (Clear, Sign White)
INSERT IGNORE INTO product_archetypes (name, category_id, subcategory, unit_of_measure, specifications, reorder_point, created_by, updated_by)
VALUES
  ('2mm Polycarbonate - Clear', @substrate_category_id, 'polycarbonate', 'sq_ft', JSON_OBJECT('size', '2mm', 'material', 'Polycarbonate', 'colour', 'Clear'), 0, @created_by, @created_by),
  ('2mm Polycarbonate - Sign White', @substrate_category_id, 'polycarbonate', 'sq_ft', JSON_OBJECT('size', '2mm', 'material', 'Polycarbonate', 'colour', 'Sign White'), 0, @created_by, @created_by),
  ('3mm Polycarbonate - Clear', @substrate_category_id, 'polycarbonate', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'Polycarbonate', 'colour', 'Clear'), 0, @created_by, @created_by),
  ('3mm Polycarbonate - Sign White', @substrate_category_id, 'polycarbonate', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'Polycarbonate', 'colour', 'Sign White'), 0, @created_by, @created_by),
  ('4.5mm Polycarbonate - Clear', @substrate_category_id, 'polycarbonate', 'sq_ft', JSON_OBJECT('size', '4.5mm', 'material', 'Polycarbonate', 'colour', 'Clear'), 0, @created_by, @created_by),
  ('4.5mm Polycarbonate - Sign White', @substrate_category_id, 'polycarbonate', 'sq_ft', JSON_OBJECT('size', '4.5mm', 'material', 'Polycarbonate', 'colour', 'Sign White'), 0, @created_by, @created_by),
  ('6mm Polycarbonate - Clear', @substrate_category_id, 'polycarbonate', 'sq_ft', JSON_OBJECT('size', '6mm', 'material', 'Polycarbonate', 'colour', 'Clear'), 0, @created_by, @created_by),
  ('6mm Polycarbonate - Sign White', @substrate_category_id, 'polycarbonate', 'sq_ft', JSON_OBJECT('size', '6mm', 'material', 'Polycarbonate', 'colour', 'Sign White'), 0, @created_by, @created_by),
  ('12mm Polycarbonate - Clear', @substrate_category_id, 'polycarbonate', 'sq_ft', JSON_OBJECT('size', '12mm', 'material', 'Polycarbonate', 'colour', 'Clear'), 0, @created_by, @created_by),
  ('12mm Polycarbonate - Sign White', @substrate_category_id, 'polycarbonate', 'sq_ft', JSON_OBJECT('size', '12mm', 'material', 'Polycarbonate', 'colour', 'Sign White'), 0, @created_by, @created_by);

-- Acrylic Products (Clear, Milky White 2447, Sign White 7328, Opaque White, Black)
INSERT IGNORE INTO product_archetypes (name, category_id, subcategory, unit_of_measure, specifications, reorder_point, created_by, updated_by)
VALUES
  ('3mm Acrylic - Clear', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'Acrylic', 'colour', 'Clear'), 0, @created_by, @created_by),
  ('3mm Acrylic - Milky White 2447', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'Acrylic', 'colour', 'Milky White 2447'), 0, @created_by, @created_by),
  ('3mm Acrylic - Sign White 7328', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'Acrylic', 'colour', 'Sign White 7328'), 0, @created_by, @created_by),
  ('3mm Acrylic - Opaque White', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'Acrylic', 'colour', 'Opaque White'), 0, @created_by, @created_by),
  ('3mm Acrylic - Black', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'Acrylic', 'colour', 'Black'), 0, @created_by, @created_by),
  ('4.5mm Acrylic - Clear', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '4.5mm', 'material', 'Acrylic', 'colour', 'Clear'), 0, @created_by, @created_by),
  ('4.5mm Acrylic - Milky White 2447', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '4.5mm', 'material', 'Acrylic', 'colour', 'Milky White 2447'), 0, @created_by, @created_by),
  ('4.5mm Acrylic - Sign White 7328', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '4.5mm', 'material', 'Acrylic', 'colour', 'Sign White 7328'), 0, @created_by, @created_by),
  ('4.5mm Acrylic - Opaque White', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '4.5mm', 'material', 'Acrylic', 'colour', 'Opaque White'), 0, @created_by, @created_by),
  ('4.5mm Acrylic - Black', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '4.5mm', 'material', 'Acrylic', 'colour', 'Black'), 0, @created_by, @created_by),
  ('6mm Acrylic - Clear', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '6mm', 'material', 'Acrylic', 'colour', 'Clear'), 0, @created_by, @created_by),
  ('6mm Acrylic - Milky White 2447', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '6mm', 'material', 'Acrylic', 'colour', 'Milky White 2447'), 0, @created_by, @created_by),
  ('6mm Acrylic - Sign White 7328', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '6mm', 'material', 'Acrylic', 'colour', 'Sign White 7328'), 0, @created_by, @created_by),
  ('6mm Acrylic - Opaque White', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '6mm', 'material', 'Acrylic', 'colour', 'Opaque White'), 0, @created_by, @created_by),
  ('6mm Acrylic - Black', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '6mm', 'material', 'Acrylic', 'colour', 'Black'), 0, @created_by, @created_by),
  ('12mm Acrylic - Clear', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '12mm', 'material', 'Acrylic', 'colour', 'Clear'), 0, @created_by, @created_by),
  ('12mm Acrylic - Milky White 2447', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '12mm', 'material', 'Acrylic', 'colour', 'Milky White 2447'), 0, @created_by, @created_by),
  ('12mm Acrylic - Sign White 7328', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '12mm', 'material', 'Acrylic', 'colour', 'Sign White 7328'), 0, @created_by, @created_by),
  ('12mm Acrylic - Opaque White', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '12mm', 'material', 'Acrylic', 'colour', 'Opaque White'), 0, @created_by, @created_by),
  ('12mm Acrylic - Black', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '12mm', 'material', 'Acrylic', 'colour', 'Black'), 0, @created_by, @created_by),
  ('18mm Acrylic - Clear', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '18mm', 'material', 'Acrylic', 'colour', 'Clear'), 0, @created_by, @created_by),
  ('18mm Acrylic - Milky White 2447', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '18mm', 'material', 'Acrylic', 'colour', 'Milky White 2447'), 0, @created_by, @created_by),
  ('18mm Acrylic - Sign White 7328', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '18mm', 'material', 'Acrylic', 'colour', 'Sign White 7328'), 0, @created_by, @created_by),
  ('18mm Acrylic - Opaque White', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '18mm', 'material', 'Acrylic', 'colour', 'Opaque White'), 0, @created_by, @created_by),
  ('18mm Acrylic - Black', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '18mm', 'material', 'Acrylic', 'colour', 'Black'), 0, @created_by, @created_by),
  ('24mm Acrylic - Clear', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '24mm', 'material', 'Acrylic', 'colour', 'Clear'), 0, @created_by, @created_by),
  ('24mm Acrylic - Milky White 2447', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '24mm', 'material', 'Acrylic', 'colour', 'Milky White 2447'), 0, @created_by, @created_by),
  ('24mm Acrylic - Sign White 7328', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '24mm', 'material', 'Acrylic', 'colour', 'Sign White 7328'), 0, @created_by, @created_by),
  ('24mm Acrylic - Opaque White', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '24mm', 'material', 'Acrylic', 'colour', 'Opaque White'), 0, @created_by, @created_by),
  ('24mm Acrylic - Black', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '24mm', 'material', 'Acrylic', 'colour', 'Black'), 0, @created_by, @created_by);

-- Acrylic Gold Mirror (1.5mm only)
INSERT IGNORE INTO product_archetypes (name, category_id, subcategory, unit_of_measure, specifications, reorder_point, created_by, updated_by)
VALUES
  ('1.5mm Acrylic - Gold Mirror', @substrate_category_id, 'acrylic', 'sq_ft', JSON_OBJECT('size', '1.5mm', 'material', 'Acrylic', 'colour', 'Gold Mirror'), 0, @created_by, @created_by);

-- ACM Products (3mm & 6mm - White, Matte Black, Gloss Black)
INSERT IGNORE INTO product_archetypes (name, category_id, subcategory, unit_of_measure, specifications, reorder_point, created_by, updated_by)
VALUES
  ('3mm ACM - White', @substrate_category_id, 'acm', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'ACM', 'colour', 'White'), 0, @created_by, @created_by),
  ('3mm ACM - Matte Black', @substrate_category_id, 'acm', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'ACM', 'colour', 'Matte Black'), 0, @created_by, @created_by),
  ('3mm ACM - Gloss Black', @substrate_category_id, 'acm', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'ACM', 'colour', 'Gloss Black'), 0, @created_by, @created_by),
  ('6mm ACM - White', @substrate_category_id, 'acm', 'sq_ft', JSON_OBJECT('size', '6mm', 'material', 'ACM', 'colour', 'White'), 0, @created_by, @created_by),
  ('6mm ACM - Matte Black', @substrate_category_id, 'acm', 'sq_ft', JSON_OBJECT('size', '6mm', 'material', 'ACM', 'colour', 'Matte Black'), 0, @created_by, @created_by),
  ('6mm ACM - Gloss Black', @substrate_category_id, 'acm', 'sq_ft', JSON_OBJECT('size', '6mm', 'material', 'ACM', 'colour', 'Gloss Black'), 0, @created_by, @created_by);

-- ACM Products (3mm only - Red, Blue, Green, Yellow, Brushed Silver, Brushed Gold)
INSERT IGNORE INTO product_archetypes (name, category_id, subcategory, unit_of_measure, specifications, reorder_point, created_by, updated_by)
VALUES
  ('3mm ACM - Red', @substrate_category_id, 'acm', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'ACM', 'colour', 'Red'), 0, @created_by, @created_by),
  ('3mm ACM - Blue', @substrate_category_id, 'acm', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'ACM', 'colour', 'Blue'), 0, @created_by, @created_by),
  ('3mm ACM - Green', @substrate_category_id, 'acm', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'ACM', 'colour', 'Green'), 0, @created_by, @created_by),
  ('3mm ACM - Yellow', @substrate_category_id, 'acm', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'ACM', 'colour', 'Yellow'), 0, @created_by, @created_by),
  ('3mm ACM - Brushed Silver', @substrate_category_id, 'acm', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'ACM', 'colour', 'Brushed Silver'), 0, @created_by, @created_by),
  ('3mm ACM - Brushed Gold', @substrate_category_id, 'acm', 'sq_ft', JSON_OBJECT('size', '3mm', 'material', 'ACM', 'colour', 'Brushed Gold'), 0, @created_by, @created_by);

-- Aluminum Products (1mm - 16 colours)
INSERT IGNORE INTO product_archetypes (name, category_id, subcategory, unit_of_measure, specifications, reorder_point, created_by, updated_by)
VALUES
  ('1mm Aluminum - White', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'White'), 0, @created_by, @created_by),
  ('1mm Aluminum - Matte Black', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Matte Black'), 0, @created_by, @created_by),
  ('1mm Aluminum - Gloss Black', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Gloss Black'), 0, @created_by, @created_by),
  ('1mm Aluminum - Gray', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Gray'), 0, @created_by, @created_by),
  ('1mm Aluminum - Brown', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Brown'), 0, @created_by, @created_by),
  ('1mm Aluminum - Blue', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Blue'), 0, @created_by, @created_by),
  ('1mm Aluminum - Green', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Green'), 0, @created_by, @created_by),
  ('1mm Aluminum - Orange', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Orange'), 0, @created_by, @created_by),
  ('1mm Aluminum - Yellow', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Yellow'), 0, @created_by, @created_by),
  ('1mm Aluminum - Red', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Red'), 0, @created_by, @created_by),
  ('1mm Aluminum - Clear Satin', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Clear Satin'), 0, @created_by, @created_by),
  ('1mm Aluminum - Clear Brushed', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Clear Brushed'), 0, @created_by, @created_by),
  ('1mm Aluminum - Clear Mirror', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Clear Mirror'), 0, @created_by, @created_by),
  ('1mm Aluminum - Gold Satin', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Gold Satin'), 0, @created_by, @created_by),
  ('1mm Aluminum - Gold Brushed', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Gold Brushed'), 0, @created_by, @created_by),
  ('1mm Aluminum - Gold Mirror', @substrate_category_id, 'aluminum', 'sq_ft', JSON_OBJECT('size', '1mm', 'material', 'Aluminum', 'colour', 'Gold Mirror'), 0, @created_by, @created_by);

-- Show summary
SELECT
  'Total new products to be added' as summary,
  COUNT(*) as count
FROM (
  -- Count all the products we're trying to add (total 79)
  SELECT '3mm PVC - White' UNION ALL
  SELECT '3mm PVC - Black' UNION ALL
  SELECT '6mm PVC - White' UNION ALL
  SELECT '6mm PVC - Black' UNION ALL
  SELECT '12mm PVC - White' UNION ALL
  SELECT '12mm PVC - Black' UNION ALL
  SELECT '18mm PVC - White' UNION ALL
  SELECT '18mm PVC - Black' UNION ALL
  SELECT '24mm PVC - White' UNION ALL
  SELECT '24mm PVC - Black' UNION ALL
  -- Polycarbonate
  SELECT '2mm Polycarbonate - Clear' UNION ALL
  SELECT '2mm Polycarbonate - Sign White' UNION ALL
  SELECT '3mm Polycarbonate - Clear' UNION ALL
  SELECT '3mm Polycarbonate - Sign White' UNION ALL
  SELECT '4.5mm Polycarbonate - Clear' UNION ALL
  SELECT '4.5mm Polycarbonate - Sign White' UNION ALL
  SELECT '6mm Polycarbonate - Clear' UNION ALL
  SELECT '6mm Polycarbonate - Sign White' UNION ALL
  SELECT '12mm Polycarbonate - Clear' UNION ALL
  SELECT '12mm Polycarbonate - Sign White' UNION ALL
  -- Acrylic
  SELECT '3mm Acrylic - Clear' UNION ALL
  SELECT '3mm Acrylic - Milky White 2447' UNION ALL
  SELECT '3mm Acrylic - Sign White 7328' UNION ALL
  SELECT '3mm Acrylic - Opaque White' UNION ALL
  SELECT '3mm Acrylic - Black' UNION ALL
  SELECT '4.5mm Acrylic - Clear' UNION ALL
  SELECT '4.5mm Acrylic - Milky White 2447' UNION ALL
  SELECT '4.5mm Acrylic - Sign White 7328' UNION ALL
  SELECT '4.5mm Acrylic - Opaque White' UNION ALL
  SELECT '4.5mm Acrylic - Black' UNION ALL
  SELECT '6mm Acrylic - Clear' UNION ALL
  SELECT '6mm Acrylic - Milky White 2447' UNION ALL
  SELECT '6mm Acrylic - Sign White 7328' UNION ALL
  SELECT '6mm Acrylic - Opaque White' UNION ALL
  SELECT '6mm Acrylic - Black' UNION ALL
  SELECT '12mm Acrylic - Clear' UNION ALL
  SELECT '12mm Acrylic - Milky White 2447' UNION ALL
  SELECT '12mm Acrylic - Sign White 7328' UNION ALL
  SELECT '12mm Acrylic - Opaque White' UNION ALL
  SELECT '12mm Acrylic - Black' UNION ALL
  SELECT '18mm Acrylic - Clear' UNION ALL
  SELECT '18mm Acrylic - Milky White 2447' UNION ALL
  SELECT '18mm Acrylic - Sign White 7328' UNION ALL
  SELECT '18mm Acrylic - Opaque White' UNION ALL
  SELECT '18mm Acrylic - Black' UNION ALL
  SELECT '24mm Acrylic - Clear' UNION ALL
  SELECT '24mm Acrylic - Milky White 2447' UNION ALL
  SELECT '24mm Acrylic - Sign White 7328' UNION ALL
  SELECT '24mm Acrylic - Opaque White' UNION ALL
  SELECT '24mm Acrylic - Black' UNION ALL
  SELECT '1.5mm Acrylic - Gold Mirror' UNION ALL
  -- ACM
  SELECT '3mm ACM - White' UNION ALL
  SELECT '3mm ACM - Matte Black' UNION ALL
  SELECT '3mm ACM - Gloss Black' UNION ALL
  SELECT '6mm ACM - White' UNION ALL
  SELECT '6mm ACM - Matte Black' UNION ALL
  SELECT '6mm ACM - Gloss Black' UNION ALL
  SELECT '3mm ACM - Red' UNION ALL
  SELECT '3mm ACM - Blue' UNION ALL
  SELECT '3mm ACM - Green' UNION ALL
  SELECT '3mm ACM - Yellow' UNION ALL
  SELECT '3mm ACM - Brushed Silver' UNION ALL
  SELECT '3mm ACM - Brushed Gold' UNION ALL
  -- Aluminum
  SELECT '1mm Aluminum - White' UNION ALL
  SELECT '1mm Aluminum - Matte Black' UNION ALL
  SELECT '1mm Aluminum - Gloss Black' UNION ALL
  SELECT '1mm Aluminum - Gray' UNION ALL
  SELECT '1mm Aluminum - Brown' UNION ALL
  SELECT '1mm Aluminum - Blue' UNION ALL
  SELECT '1mm Aluminum - Green' UNION ALL
  SELECT '1mm Aluminum - Orange' UNION ALL
  SELECT '1mm Aluminum - Yellow' UNION ALL
  SELECT '1mm Aluminum - Red' UNION ALL
  SELECT '1mm Aluminum - Clear Satin' UNION ALL
  SELECT '1mm Aluminum - Clear Brushed' UNION ALL
  SELECT '1mm Aluminum - Clear Mirror' UNION ALL
  SELECT '1mm Aluminum - Gold Satin' UNION ALL
  SELECT '1mm Aluminum - Gold Brushed' UNION ALL
  SELECT '1mm Aluminum - Gold Mirror'
) as all_products;
