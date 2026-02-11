-- Vector Validation Profiles
-- Stores per-spec-type validation parameters (previously hardcoded in aiFileValidationRules.ts)
-- Created: 2026-02-11

CREATE TABLE IF NOT EXISTS vector_validation_profiles (
  profile_id INT AUTO_INCREMENT PRIMARY KEY,
  spec_type_key VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  parameters JSON NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT DEFAULT NULL,
  CONSTRAINT fk_vvp_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

-- Seed: Front Lit (Trim Cap)
INSERT INTO vector_validation_profiles (spec_type_key, display_name, description, parameters, is_active) VALUES
('front_lit', 'Front Lit (Trim Cap)', 'Channel letter validation with trim cap offset and spacing checks', JSON_OBJECT(
  'file_scale', 0.1,
  'return_layer', 'return',
  'trim_layer', 'trimcap',
  'trim_offset_min_mm', 1.5,
  'trim_offset_max_mm', 2.5,
  'miter_factor', 4.0,
  'min_mounting_holes', 2,
  'mounting_holes_per_inch_perimeter', 0.05,
  'mounting_holes_per_sq_inch_area', 0.0123,
  'check_wire_holes', CAST(TRUE AS JSON),
  'expected_mounting_names', JSON_ARRAY('Regular Mounting'),
  'min_trim_spacing_inches', 0.15
), TRUE);

-- Seed: Front Lit Acrylic Face
INSERT INTO vector_validation_profiles (spec_type_key, display_name, description, parameters, is_active) VALUES
('front_lit_acrylic_face', 'Front Lit (Acrylic Face)', 'Acrylic face validation with face offset, engraving path detection', JSON_OBJECT(
  'file_scale', 0.1,
  'return_layer', 'return',
  'face_layer', 'face',
  'face_offset_min_mm', 0.3,
  'min_face_spacing_inches', 0.10,
  'engraving_offset_mm', 4.0,
  'engraving_offset_tolerance_mm', 12.0,
  'min_mounting_holes', 2,
  'mounting_holes_per_inch_perimeter', 0.05,
  'mounting_holes_per_sq_inch_area', 0.0123,
  'check_wire_holes', CAST(TRUE AS JSON),
  'expected_mounting_names', JSON_ARRAY('Regular Mounting')
), TRUE);

-- Seed: Push Thru (inactive — rules not yet implemented in Python)
INSERT INTO vector_validation_profiles (spec_type_key, display_name, description, parameters, is_active) VALUES
('push_thru', 'Push Thru', 'Push-thru letter validation with cutout offsets and corner radii', JSON_OBJECT(
  'file_scale', 0.1,
  'return_layer', 'return',
  'backer_layer', 'backer',
  'acrylic_layer', 'push_thru_acrylic',
  'lexan_layer', 'lexan',
  'cutout_offset_mm', 0.8,
  'cutout_offset_tolerance_mm', 0.05,
  'acrylic_convex_radius_inches', 0.028,
  'acrylic_concave_radius_inches', 0.059,
  'cutout_convex_radius_inches', 0.059,
  'cutout_concave_radius_inches', 0.028,
  'corner_radius_tolerance_pct', 0.05,
  'min_acrylic_inset_from_box_inches', 3.0,
  'lexan_inset_from_box_inches', 2.25,
  'led_box_offset_inches', -0.16,
  'led_box_offset_tolerance_inches', 0.01
), FALSE);
