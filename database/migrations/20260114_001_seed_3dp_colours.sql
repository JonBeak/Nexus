-- Migration: Seed 3DP colours for 3D Print Return template
-- Date: 2026-01-14
-- Description: Add 3dp_colours category to specification_options table

-- Seed 3DP colours into specification_options table
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_active, is_system)
VALUES
  ('3dp_colours', '3DP Colour', 'Translucent White', 'translucent_white', 1, TRUE, FALSE),
  ('3dp_colours', '3DP Colour', 'Opaque White', 'opaque_white', 2, TRUE, FALSE),
  ('3dp_colours', '3DP Colour', 'Opaque Black', 'opaque_black', 3, TRUE, FALSE),
  ('3dp_colours', '3DP Colour', 'Translucent Red', 'translucent_red', 4, TRUE, FALSE),
  ('3dp_colours', '3DP Colour', 'Opaque Red', 'opaque_red', 5, TRUE, FALSE),
  ('3dp_colours', '3DP Colour', 'Translucent Green', 'translucent_green', 6, TRUE, FALSE),
  ('3dp_colours', '3DP Colour', 'Opaque Green', 'opaque_green', 7, TRUE, FALSE);
