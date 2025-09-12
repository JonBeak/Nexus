-- =====================================================
-- UNIFIED PRICING SYSTEM - ALL 15 CATEGORIES EXTENSION
-- =====================================================
-- Extends existing job estimation system with comprehensive pricing
-- for all 13 product categories + 2 system categories (Multiplier/Discount)
-- Follows established patterns and integrates with existing audit_trail
-- =====================================================

-- =====================================================
-- 1. VINYL PRICING SYSTEM
-- =====================================================

-- Vinyl types and base pricing (10 types from Excel analysis)
CREATE TABLE vinyl_types_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vinyl_type VARCHAR(100) NOT NULL,
  vinyl_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  
  -- Excel pricing structure
  base_price_per_sqft DECIMAL(8,4) NOT NULL,
  application_fee DECIMAL(8,2) DEFAULT 0.00,
  setup_charge DECIMAL(8,2) DEFAULT 0.00,
  minimum_charge DECIMAL(8,2) DEFAULT 0.00,
  
  -- Excel formula integration  
  size_rules JSON, -- Stores size calculation logic
  application_rules JSON, -- Application method pricing
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_vinyl_code (vinyl_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 2. SUBSTRATE CUT PRICING SYSTEM  
-- =====================================================

-- Substrate materials with cutting rates (24 materials from Excel)
CREATE TABLE substrate_cut_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  substrate_name VARCHAR(100) NOT NULL,
  substrate_code VARCHAR(20) UNIQUE NOT NULL,
  material_category VARCHAR(50) NOT NULL, -- ACM, Aluminum, etc.
  
  -- Excel pricing structure
  material_cost_per_sqft DECIMAL(8,4) NOT NULL,
  cutting_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  drilling_rate_per_hole DECIMAL(8,4) DEFAULT 0.0000,
  
  -- Hardware pricing
  pin_cost_per_piece DECIMAL(8,4) DEFAULT 0.0000,
  standoff_cost_per_piece DECIMAL(8,4) DEFAULT 0.0000,
  
  -- Excel formula integration
  size_calculation_rules JSON, -- XY dimension logic
  hardware_calculation_rules JSON, -- Pin/standoff logic
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_substrate_code (substrate_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 3. BACKER PRICING SYSTEM
-- =====================================================

-- Backer aluminum and ACM pricing with dimension sorting
CREATE TABLE backer_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  backer_type VARCHAR(100) NOT NULL,
  backer_code VARCHAR(20) UNIQUE NOT NULL,
  material_type ENUM('ALUMINUM', 'ACM') NOT NULL,
  
  -- Excel pricing structure
  base_rate_per_sqft DECIMAL(8,4) NOT NULL,
  folding_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  
  -- Excel formula integration - dimension sorting logic
  dimension_sorting_rules JSON, -- X/Y agnostic, Z positional logic
  folding_calculation_rules JSON, -- Folding logic
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_backer_code (backer_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 4. PUSH THRU PRICING SYSTEM
-- =====================================================

-- Push thru multi-component pricing (backer + acrylic + LEDs + transformers)
CREATE TABLE push_thru_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  push_thru_type VARCHAR(100) NOT NULL,
  push_thru_code VARCHAR(20) UNIQUE NOT NULL,
  
  -- Component pricing
  backer_rate_per_sqft DECIMAL(8,4) NOT NULL,
  acrylic_rate_per_sqft DECIMAL(8,4) NOT NULL,
  led_rate_per_sqft DECIMAL(8,4) NOT NULL,
  transformer_base_cost DECIMAL(8,2) NOT NULL,
  
  -- Excel formula integration
  multi_component_rules JSON, -- Component calculation logic
  transformer_sizing_rules JSON, -- TF calculation logic
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_push_thru_code (push_thru_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 5. BLADE SIGN PRICING SYSTEM
-- =====================================================

-- Blade sign frame calculations with LED integration
CREATE TABLE blade_sign_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  blade_type VARCHAR(100) NOT NULL,
  blade_code VARCHAR(20) UNIQUE NOT NULL,
  
  -- Frame pricing
  frame_rate_per_linear_ft DECIMAL(8,4) NOT NULL,
  face_rate_per_sqft DECIMAL(8,4) NOT NULL,
  
  -- LED integration
  led_rate_per_linear_ft DECIMAL(8,4) DEFAULT 0.0000,
  transformer_cost_per_unit DECIMAL(8,2) DEFAULT 0.00,
  
  -- Excel formula integration
  frame_calculation_rules JSON, -- Perimeter calculation
  circle_detection_rules JSON, -- Circle vs rectangle logic
  led_integration_rules JSON, -- LED placement logic
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_blade_code (blade_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 6. LED NEON PRICING SYSTEM
-- =====================================================

-- LED Neon length-based pricing with welding and standoffs
CREATE TABLE led_neon_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  neon_type VARCHAR(100) NOT NULL,
  neon_code VARCHAR(20) UNIQUE NOT NULL,
  
  -- Length-based pricing
  cost_per_linear_ft DECIMAL(8,4) NOT NULL,
  welding_cost_per_joint DECIMAL(8,2) DEFAULT 0.00,
  standoff_cost_per_piece DECIMAL(8,2) DEFAULT 0.00,
  
  -- Opacity and color options
  opacity_multiplier DECIMAL(4,2) DEFAULT 1.0,
  color_multiplier DECIMAL(4,2) DEFAULT 1.0,
  
  -- Excel formula integration
  length_calculation_rules JSON, -- Linear footage logic
  welding_calculation_rules JSON, -- Joint calculation
  standoff_calculation_rules JSON, -- Standoff placement logic
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_neon_code (neon_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 7. PAINTING PRICING SYSTEM
-- =====================================================

-- Face and return painting by square footage
CREATE TABLE painting_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  painting_type VARCHAR(100) NOT NULL,
  painting_code VARCHAR(20) UNIQUE NOT NULL,
  
  -- Face painting
  face_rate_per_sqft DECIMAL(8,4) NOT NULL,
  
  -- Return painting by depth
  return_3in_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  return_4in_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  return_5in_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  
  -- Trim painting
  trim_rate_per_linear_ft DECIMAL(8,4) DEFAULT 0.0000,
  
  -- Excel formula integration
  face_calculation_rules JSON, -- Face area calculation
  return_calculation_rules JSON, -- Return area by depth
  trim_calculation_rules JSON, -- Trim linear footage
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_painting_code (painting_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 8. CUSTOM PRICING SYSTEM
-- =====================================================

-- Flexible A/B/C calculation structure
CREATE TABLE custom_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  custom_type VARCHAR(100) NOT NULL,
  custom_code VARCHAR(20) UNIQUE NOT NULL,
  
  -- A/B/C flexible structure
  component_a_rate DECIMAL(8,4) DEFAULT 0.0000,
  component_b_rate DECIMAL(8,4) DEFAULT 0.0000,
  component_c_rate DECIMAL(8,4) DEFAULT 0.0000,
  
  -- Excel formula integration
  custom_calculation_rules JSON, -- A/B/C formula logic
  component_interaction_rules JSON, -- Component relationships
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_custom_code (custom_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 9. WIRING PRICING SYSTEM
-- =====================================================

-- DC/wall plugs and wire footage pricing
CREATE TABLE wiring_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  wiring_type VARCHAR(100) NOT NULL,
  wiring_code VARCHAR(20) UNIQUE NOT NULL,
  
  -- Plug pricing
  dc_plug_cost_per_unit DECIMAL(8,2) NOT NULL,
  wall_plug_cost_per_unit DECIMAL(8,2) NOT NULL,
  
  -- Wire pricing
  wire_cost_per_ft DECIMAL(8,4) NOT NULL,
  
  -- Excel formula integration
  plug_calculation_rules JSON, -- Plug quantity logic
  wire_calculation_rules JSON, -- Wire footage logic
  piece_length_rules JSON, -- Piece count * length logic
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_wiring_code (wiring_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 10. MATERIAL CUT PRICING SYSTEM
-- =====================================================

-- Raw/primed materials, trim cutting, design costs
CREATE TABLE material_cut_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  material_type VARCHAR(100) NOT NULL,
  material_code VARCHAR(20) UNIQUE NOT NULL,
  
  -- Material pricing
  raw_material_rate_per_sqft DECIMAL(8,4) NOT NULL,
  primed_material_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  
  -- Cutting and design
  cutting_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  trim_cutting_rate_per_linear_ft DECIMAL(8,4) DEFAULT 0.0000,
  design_cost_per_hour DECIMAL(8,2) DEFAULT 0.00,
  
  -- Excel formula integration
  material_calculation_rules JSON, -- Material area logic
  cutting_calculation_rules JSON, -- Cutting requirements
  design_calculation_rules JSON, -- Design time estimation
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_material_code (material_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 11. ENHANCED MULTIPLIER SYSTEM (REPLACES EXCEL SECTIONS)
-- =====================================================

-- Range-based quantity multipliers
CREATE TABLE multiplier_ranges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  multiplier_name VARCHAR(100) NOT NULL,
  multiplier_code VARCHAR(20) UNIQUE NOT NULL,
  
  -- Range configuration
  quantity_ranges JSON NOT NULL, -- [{"min": 1, "max": 10, "multiplier": 1.0}, ...]
  
  -- Application rules
  applies_to_categories JSON, -- Which product categories this applies to
  priority_order INT DEFAULT 0, -- For multiple multipliers
  
  -- Excel formula integration
  range_calculation_rules JSON, -- Range detection logic
  cascading_rules JSON, -- How multipliers interact
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_multiplier_code (multiplier_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 12. ENHANCED DISCOUNT SYSTEM (REPLACES EXCEL SECTIONS)
-- =====================================================

-- Range-based percentage/dollar discounts
CREATE TABLE discount_ranges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  discount_name VARCHAR(100) NOT NULL,
  discount_code VARCHAR(20) UNIQUE NOT NULL,
  
  -- Range configuration with percentage AND dollar options
  discount_ranges JSON NOT NULL, -- [{"min": 1000, "max": 5000, "percent": 5.0, "dollar": 0}]
  
  -- Application rules
  applies_to_categories JSON, -- Which product categories
  customer_restrictions JSON, -- Customer-specific rules
  priority_order INT DEFAULT 0,
  
  -- Excel formula integration
  range_calculation_rules JSON, -- Range detection logic
  discount_application_rules JSON, -- How discounts apply
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_discount_code (discount_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 13. EXTEND PRODUCT_TYPES TABLE WITH PRICING RULES
-- =====================================================

-- Add the remaining 12 product types to existing product_types table
INSERT INTO product_types (name, category, default_unit, input_template, pricing_rules) VALUES

-- Vinyl (10 types)
('Vinyl - Cut', 'vinyl', 'sqft', 
'{"fields": [
  {"name": "vinyl_type", "type": "select", "label": "Vinyl Type", "options": ["Standard", "Premium", "Reflective", "Translucent"], "required": true},
  {"name": "dimensions", "type": "text", "label": "Dimensions", "required": true, "placeholder": "12x8,6x4"},
  {"name": "application_method", "type": "select", "label": "Application", "options": ["Wet", "Dry", "Pre-mask"], "required": true},
  {"name": "quantity", "type": "number", "label": "Quantity", "required": true}
]}',
'{"calculation_type": "area_based", "rate_table": "vinyl_types_pricing", "formula": "area * rate + application_fee"}'),

-- Substrate Cut (24 materials)  
('Substrate Cut', 'substrate', 'sqft',
'{"fields": [
  {"name": "substrate_type", "type": "select", "label": "Substrate Material", "options": ["ACM", "Aluminum", "Dibond", "PVC"], "required": true},
  {"name": "dimensions", "type": "text", "label": "Dimensions", "required": true, "placeholder": "24x18,12x8"},
  {"name": "cutting_required", "type": "boolean", "label": "Cutting Required", "required": true},
  {"name": "drilling_holes", "type": "number", "label": "Drilling Holes", "required": false},
  {"name": "hardware", "type": "select", "label": "Hardware", "options": ["None", "Pins", "Standoffs"], "required": false}
]}',
'{"calculation_type": "multi_component", "rate_table": "substrate_cut_pricing", "formula": "(area * material_rate) + (area * cutting_rate) + (holes * drilling_rate) + hardware_cost"}'),

-- Backer
('Backer', 'backer', 'sqft',
'{"fields": [
  {"name": "material_type", "type": "select", "label": "Backer Type", "options": ["Aluminum", "ACM"], "required": true},
  {"name": "dimensions", "type": "text", "label": "Dimensions", "required": true, "placeholder": "48x24x6"},
  {"name": "folding_required", "type": "boolean", "label": "Folding Required", "required": true}
]}',
'{"calculation_type": "dimension_sorted", "rate_table": "backer_pricing", "formula": "sorted_area * base_rate + (folding ? folding_area * folding_rate : 0)"}'),

-- Push Thru
('Push Thru', 'push_thru', 'sqft',
'{"fields": [
  {"name": "backer_dimensions", "type": "text", "label": "Backer Dimensions", "required": true},
  {"name": "acrylic_dimensions", "type": "text", "label": "Acrylic Dimensions", "required": true},
  {"name": "led_type", "type": "select", "label": "LED Type", "options": ["Standard", "High Output"], "required": true},
  {"name": "transformer_required", "type": "boolean", "label": "Transformer Required", "required": true}
]}',
'{"calculation_type": "multi_component", "rate_table": "push_thru_pricing", "formula": "(backer_area * backer_rate) + (acrylic_area * acrylic_rate) + (led_area * led_rate) + (transformer ? transformer_cost : 0)"}'),

-- Blade Sign
('Blade Sign', 'blade_sign', 'sqft',
'{"fields": [
  {"name": "frame_dimensions", "type": "text", "label": "Frame Dimensions", "required": true, "placeholder": "48x12"},
  {"name": "shape", "type": "select", "label": "Shape", "options": ["Rectangle", "Circle", "Custom"], "required": true},
  {"name": "led_required", "type": "boolean", "label": "LED Lighting", "required": false}
]}',
'{"calculation_type": "frame_based", "rate_table": "blade_sign_pricing", "formula": "(perimeter * frame_rate) + (face_area * face_rate) + (led ? led_linear_ft * led_rate + transformer_cost : 0)"}'),

-- LED Neon
('LED Neon', 'led_neon', 'linear_ft',
'{"fields": [
  {"name": "neon_type", "type": "select", "label": "Neon Type", "options": ["Standard", "High Density"], "required": true},
  {"name": "linear_footage", "type": "number", "label": "Linear Footage", "required": true},
  {"name": "welding_joints", "type": "number", "label": "Welding Joints", "required": false},
  {"name": "standoffs_required", "type": "number", "label": "Standoffs Required", "required": false},
  {"name": "opacity", "type": "select", "label": "Opacity", "options": ["Clear", "Frosted", "Opaque"], "required": true}
]}',
'{"calculation_type": "length_based", "rate_table": "led_neon_pricing", "formula": "(linear_ft * cost_per_ft * opacity_multiplier) + (welding_joints * welding_cost) + (standoffs * standoff_cost)"}'),

-- Painting
('Painting', 'painting', 'sqft',
'{"fields": [
  {"name": "face_dimensions", "type": "text", "label": "Face Dimensions", "required": true, "placeholder": "24x18,12x8"},
  {"name": "return_depth", "type": "select", "label": "Return Depth", "options": ["None", "3in", "4in", "5in"], "required": false},
  {"name": "trim_required", "type": "boolean", "label": "Trim Painting", "required": false}
]}',
'{"calculation_type": "area_based", "rate_table": "painting_pricing", "formula": "(face_area * face_rate) + (return_area * return_rate_by_depth) + (trim ? trim_linear_ft * trim_rate : 0)"}'),

-- Custom
('Custom', 'custom', 'ea',
'{"fields": [
  {"name": "component_a", "type": "number", "label": "Component A", "required": false},
  {"name": "component_b", "type": "number", "label": "Component B", "required": false},
  {"name": "component_c", "type": "number", "label": "Component C", "required": false},
  {"name": "description", "type": "textarea", "label": "Custom Description", "required": true}
]}',
'{"calculation_type": "flexible", "rate_table": "custom_pricing", "formula": "(component_a * a_rate) + (component_b * b_rate) + (component_c * c_rate)"}'),

-- Wiring
('Wiring', 'wiring', 'ea',
'{"fields": [
  {"name": "dc_plugs", "type": "number", "label": "DC Plugs", "required": false},
  {"name": "wall_plugs", "type": "number", "label": "Wall Plugs", "required": false},
  {"name": "wire_pieces", "type": "number", "label": "Wire Pieces", "required": false},
  {"name": "wire_length_per_piece", "type": "number", "label": "Length per Piece (ft)", "required": false}
]}',
'{"calculation_type": "component_sum", "rate_table": "wiring_pricing", "formula": "(dc_plugs * dc_cost) + (wall_plugs * wall_cost) + (wire_pieces * length_per_piece * wire_cost_per_ft)"}'),

-- Material Cut
('Material Cut', 'material_cut', 'sqft',
'{"fields": [
  {"name": "material_type", "type": "select", "label": "Material Type", "options": ["Raw", "Primed"], "required": true},
  {"name": "dimensions", "type": "text", "label": "Dimensions", "required": true},
  {"name": "cutting_required", "type": "boolean", "label": "Cutting Required", "required": true},
  {"name": "trim_cutting", "type": "number", "label": "Trim Cutting (linear ft)", "required": false},
  {"name": "design_hours", "type": "number", "label": "Design Hours", "required": false}
]}',
'{"calculation_type": "material_plus_services", "rate_table": "material_cut_pricing", "formula": "(area * material_rate) + (cutting ? area * cutting_rate : 0) + (trim_cutting * trim_rate) + (design_hours * design_rate)"}');

-- Update existing Channel Letters with pricing rules
UPDATE product_types 
SET pricing_rules = '{"calculation_type": "channel_letter_complex", "rate_table": "channel_letter_types", "led_table": "led_types_pricing", "transformer_table": "transformer_types_pricing", "ul_table": "ul_listing_pricing", "formula": "letter_calculation + led_calculation + transformer_calculation + ul_calculation"}'
WHERE name = 'Channel Letters';

-- =====================================================
-- 14. SAMPLE DATA FOR ALL PRICING TABLES  
-- =====================================================

-- Sample Vinyl Types
INSERT INTO vinyl_types_pricing (vinyl_type, vinyl_code, base_price_per_sqft, application_fee, setup_charge, effective_date) VALUES
('Standard Cut Vinyl', 'VIN_STD', 2.50, 15.00, 25.00, CURDATE()),
('Premium Cast Vinyl', 'VIN_PREM', 4.25, 20.00, 35.00, CURDATE()),
('Reflective Vinyl', 'VIN_REFL', 6.75, 25.00, 45.00, CURDATE()),
('Translucent Vinyl', 'VIN_TRANS', 5.50, 20.00, 35.00, CURDATE());

-- Sample Substrate Cut Materials  
INSERT INTO substrate_cut_pricing (substrate_name, substrate_code, material_category, material_cost_per_sqft, cutting_rate_per_sqft, drilling_rate_per_hole, pin_cost_per_piece, standoff_cost_per_piece, effective_date) VALUES
('3mm ACM White', 'ACM_3MM_W', 'ACM', 3.25, 1.50, 2.00, 0.75, 3.25, CURDATE()),
('4mm ACM Black', 'ACM_4MM_B', 'ACM', 3.75, 1.75, 2.00, 0.75, 3.25, CURDATE()),
('.080 Aluminum', 'ALU_080', 'ALUMINUM', 4.50, 2.25, 3.00, 1.25, 4.50, CURDATE()),
('6mm Dibond', 'DIB_6MM', 'DIBOND', 5.25, 2.00, 2.50, 0.85, 3.75, CURDATE());

-- Sample Backer Types
INSERT INTO backer_pricing (backer_type, backer_code, material_type, base_rate_per_sqft, folding_rate_per_sqft, effective_date) VALUES
('Standard Aluminum', 'BCK_ALU_STD', 'ALUMINUM', 8.50, 2.25, CURDATE()),
('Premium Aluminum', 'BCK_ALU_PREM', 'ALUMINUM', 12.75, 3.50, CURDATE()),
('ACM Backer', 'BCK_ACM', 'ACM', 6.25, 1.75, CURDATE());

-- Sample Push Thru Types
INSERT INTO push_thru_pricing (push_thru_type, push_thru_code, backer_rate_per_sqft, acrylic_rate_per_sqft, led_rate_per_sqft, transformer_base_cost, effective_date) VALUES
('Standard Push Thru', 'PT_STD', 8.50, 12.00, 15.75, 125.00, CURDATE()),
('Premium Push Thru', 'PT_PREM', 12.25, 16.50, 22.50, 185.00, CURDATE());

-- Sample Blade Sign Types
INSERT INTO blade_sign_pricing (blade_type, blade_code, frame_rate_per_linear_ft, face_rate_per_sqft, led_rate_per_linear_ft, transformer_cost_per_unit, effective_date) VALUES
('Standard Blade', 'BLD_STD', 15.25, 8.50, 12.75, 85.00, CURDATE()),
('Heavy Duty Blade', 'BLD_HD', 22.50, 12.25, 18.25, 125.00, CURDATE());

-- Sample LED Neon Types
INSERT INTO led_neon_pricing (neon_type, neon_code, cost_per_linear_ft, welding_cost_per_joint, standoff_cost_per_piece, effective_date) VALUES
('Standard LED Neon', 'NEON_STD', 18.75, 25.00, 8.50, CURDATE()),
('High Density Neon', 'NEON_HD', 28.50, 35.00, 12.75, CURDATE());

-- Sample Painting Types
INSERT INTO painting_pricing (painting_type, painting_code, face_rate_per_sqft, return_3in_rate_per_sqft, return_4in_rate_per_sqft, return_5in_rate_per_sqft, trim_rate_per_linear_ft, effective_date) VALUES
('Standard Paint', 'PNT_STD', 4.50, 2.25, 2.75, 3.25, 1.85, CURDATE()),
('Premium Paint', 'PNT_PREM', 6.75, 3.25, 3.75, 4.25, 2.50, CURDATE());

-- Sample Custom Types
INSERT INTO custom_pricing (custom_type, custom_code, component_a_rate, component_b_rate, component_c_rate, effective_date) VALUES
('Custom Calculation', 'CUST_STD', 1.00, 1.50, 2.00, CURDATE());

-- Sample Wiring Types  
INSERT INTO wiring_pricing (wiring_type, wiring_code, dc_plug_cost_per_unit, wall_plug_cost_per_unit, wire_cost_per_ft, effective_date) VALUES
('Standard Wiring', 'WIRE_STD', 12.50, 18.75, 2.25, CURDATE());

-- Sample Material Cut Types
INSERT INTO material_cut_pricing (material_type, material_code, raw_material_rate_per_sqft, primed_material_rate_per_sqft, cutting_rate_per_sqft, trim_cutting_rate_per_linear_ft, design_cost_per_hour, effective_date) VALUES
('Aluminum Sheet', 'MAT_ALU', 8.50, 12.25, 2.75, 4.50, 75.00, CURDATE()),
('Stainless Steel', 'MAT_SS', 15.75, 22.50, 4.25, 6.75, 85.00, CURDATE());

-- Sample Multiplier Ranges
INSERT INTO multiplier_ranges (multiplier_name, multiplier_code, quantity_ranges, applies_to_categories, effective_date) VALUES
('Quantity Discount', 'MULT_QTY', '[{"min": 1, "max": 10, "multiplier": 1.0}, {"min": 11, "max": 25, "multiplier": 0.95}, {"min": 26, "max": 50, "multiplier": 0.90}, {"min": 51, "max": 999, "multiplier": 0.85}]', '["channel_letters", "vinyl", "substrate"]', CURDATE());

-- Sample Discount Ranges  
INSERT INTO discount_ranges (discount_name, discount_code, discount_ranges, applies_to_categories, effective_date) VALUES
('Volume Discount', 'DISC_VOL', '[{"min": 1000, "max": 2499, "percent": 2.5, "dollar": 0}, {"min": 2500, "max": 4999, "percent": 5.0, "dollar": 0}, {"min": 5000, "max": 999999, "percent": 7.5, "dollar": 0}]', '["all"]', CURDATE());

-- =====================================================
-- END OF UNIFIED PRICING SYSTEM EXTENSION
-- =====================================================