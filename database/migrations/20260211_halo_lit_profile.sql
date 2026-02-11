-- Halo Lit validation profile
-- Halo Lit channel letters: return (no holes), back (wire+mounting), face (offset from return)

INSERT INTO vector_validation_profiles (spec_type_key, display_name, description, parameters, is_active) VALUES
('halo_lit', 'Halo Lit', 'Halo Lit validation: return (no holes), back (wire+mounting), face (offset from return)', JSON_OBJECT(
  'file_scale', 0.1,
  'return_layer', 'return',
  'back_layer', 'back',
  'face_layer', 'face',
  'back_offset_min_mm', 2.0,
  'face_offset_min_mm', 1.2,
  'miter_factor', 4.5,
  'min_mounting_holes', 2,
  'mounting_holes_per_inch_perimeter', 0.05,
  'mounting_holes_per_sq_inch_area', 0.0123,
  'check_wire_holes', TRUE,
  'expected_mounting_names', JSON_ARRAY('Pin Thread Mounting')
), TRUE);
