-- Migration: Add Frame Specification Options
-- Date: 2026-01-30
-- Description: Add frame materials and frame colours for the new Frame spec template

-- Frame materials
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_active, is_system) VALUES
('frame_materials', 'Frame Materials', '1" Angle', '1_angle', 1, 1, 1),
('frame_materials', 'Frame Materials', '1.25" Angle', '1_25_angle', 2, 1, 1),
('frame_materials', 'Frame Materials', '1.5" Angle', '1_5_angle', 3, 1, 1),
('frame_materials', 'Frame Materials', '2" Angle', '2_angle', 4, 1, 1),
('frame_materials', 'Frame Materials', '1" Galvanized Square Tube', '1_galv_tube', 5, 1, 1);

-- Frame colours
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_active, is_system) VALUES
('frame_colours', 'Frame Colours', 'Mill Finish', 'mill_finish', 1, 1, 1),
('frame_colours', 'Frame Colours', 'White', 'white', 2, 1, 1),
('frame_colours', 'Frame Colours', 'Black', 'black', 3, 1, 1),
('frame_colours', 'Frame Colours', 'Galvanized', 'galvanized', 4, 1, 1);
