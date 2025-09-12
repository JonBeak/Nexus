-- =====================================================
-- PRODUCT TYPES EXTENSION - Part 3 of Unified Pricing System
-- =====================================================

-- Add the remaining 12 product types to existing product_types table
INSERT INTO product_types (name, category, default_unit, input_template, pricing_rules) VALUES

-- Vinyl
('Vinyl - Cut', 'vinyl', 'sqft', 
'{"fields": [{"name": "vinyl_type", "type": "select", "label": "Vinyl Type", "options": ["Standard", "Premium", "Reflective", "Translucent"], "required": true}, {"name": "dimensions", "type": "text", "label": "Dimensions", "required": true, "placeholder": "12x8,6x4"}, {"name": "application_method", "type": "select", "label": "Application", "options": ["Wet", "Dry", "Pre-mask"], "required": true}, {"name": "quantity", "type": "number", "label": "Quantity", "required": true}]}',
'{"calculation_type": "area_based", "rate_table": "vinyl_types_pricing", "formula": "area * rate + application_fee"}'),

-- Substrate Cut
('Substrate Cut', 'substrate', 'sqft',
'{"fields": [{"name": "substrate_type", "type": "select", "label": "Substrate Material", "options": ["ACM", "Aluminum", "Dibond", "PVC"], "required": true}, {"name": "dimensions", "type": "text", "label": "Dimensions", "required": true, "placeholder": "24x18,12x8"}, {"name": "cutting_required", "type": "boolean", "label": "Cutting Required", "required": true}, {"name": "drilling_holes", "type": "number", "label": "Drilling Holes", "required": false}, {"name": "hardware", "type": "select", "label": "Hardware", "options": ["None", "Pins", "Standoffs"], "required": false}]}',
'{"calculation_type": "multi_component", "rate_table": "substrate_cut_pricing", "formula": "(area * material_rate) + (area * cutting_rate) + (holes * drilling_rate) + hardware_cost"}'),

-- Backer
('Backer', 'backer', 'sqft',
'{"fields": [{"name": "material_type", "type": "select", "label": "Backer Type", "options": ["Aluminum", "ACM"], "required": true}, {"name": "dimensions", "type": "text", "label": "Dimensions", "required": true, "placeholder": "48x24x6"}, {"name": "folding_required", "type": "boolean", "label": "Folding Required", "required": true}]}',
'{"calculation_type": "dimension_sorted", "rate_table": "backer_pricing", "formula": "sorted_area * base_rate + (folding ? folding_area * folding_rate : 0)"}'),

-- Push Thru
('Push Thru', 'push_thru', 'sqft',
'{"fields": [{"name": "backer_dimensions", "type": "text", "label": "Backer Dimensions", "required": true}, {"name": "acrylic_dimensions", "type": "text", "label": "Acrylic Dimensions", "required": true}, {"name": "led_type", "type": "select", "label": "LED Type", "options": ["Standard", "High Output"], "required": true}, {"name": "transformer_required", "type": "boolean", "label": "Transformer Required", "required": true}]}',
'{"calculation_type": "multi_component", "rate_table": "push_thru_pricing", "formula": "(backer_area * backer_rate) + (acrylic_area * acrylic_rate) + (led_area * led_rate) + (transformer ? transformer_cost : 0)"}'),

-- Blade Sign
('Blade Sign', 'blade_sign', 'sqft',
'{"fields": [{"name": "frame_dimensions", "type": "text", "label": "Frame Dimensions", "required": true, "placeholder": "48x12"}, {"name": "shape", "type": "select", "label": "Shape", "options": ["Rectangle", "Circle", "Custom"], "required": true}, {"name": "led_required", "type": "boolean", "label": "LED Lighting", "required": false}]}',
'{"calculation_type": "frame_based", "rate_table": "blade_sign_pricing", "formula": "(perimeter * frame_rate) + (face_area * face_rate) + (led ? led_linear_ft * led_rate + transformer_cost : 0)"}'),

-- LED Neon
('LED Neon', 'led_neon', 'linear_ft',
'{"fields": [{"name": "neon_type", "type": "select", "label": "Neon Type", "options": ["Standard", "High Density"], "required": true}, {"name": "linear_footage", "type": "number", "label": "Linear Footage", "required": true}, {"name": "welding_joints", "type": "number", "label": "Welding Joints", "required": false}, {"name": "standoffs_required", "type": "number", "label": "Standoffs Required", "required": false}, {"name": "opacity", "type": "select", "label": "Opacity", "options": ["Clear", "Frosted", "Opaque"], "required": true}]}',
'{"calculation_type": "length_based", "rate_table": "led_neon_pricing", "formula": "(linear_ft * cost_per_ft * opacity_multiplier) + (welding_joints * welding_cost) + (standoffs * standoff_cost)"}'),

-- Painting
('Painting', 'painting', 'sqft',
'{"fields": [{"name": "face_dimensions", "type": "text", "label": "Face Dimensions", "required": true, "placeholder": "24x18,12x8"}, {"name": "return_depth", "type": "select", "label": "Return Depth", "options": ["None", "3in", "4in", "5in"], "required": false}, {"name": "trim_required", "type": "boolean", "label": "Trim Painting", "required": false}]}',
'{"calculation_type": "area_based", "rate_table": "painting_pricing", "formula": "(face_area * face_rate) + (return_area * return_rate_by_depth) + (trim ? trim_linear_ft * trim_rate : 0)"}'),

-- Custom
('Custom', 'custom', 'ea',
'{"fields": [{"name": "component_a", "type": "number", "label": "Component A", "required": false}, {"name": "component_b", "type": "number", "label": "Component B", "required": false}, {"name": "component_c", "type": "number", "label": "Component C", "required": false}, {"name": "description", "type": "textarea", "label": "Custom Description", "required": true}]}',
'{"calculation_type": "flexible", "rate_table": "custom_pricing", "formula": "(component_a * a_rate) + (component_b * b_rate) + (component_c * c_rate)"}'),

-- Wiring
('Wiring', 'wiring', 'ea',
'{"fields": [{"name": "dc_plugs", "type": "number", "label": "DC Plugs", "required": false}, {"name": "wall_plugs", "type": "number", "label": "Wall Plugs", "required": false}, {"name": "wire_pieces", "type": "number", "label": "Wire Pieces", "required": false}, {"name": "wire_length_per_piece", "type": "number", "label": "Length per Piece (ft)", "required": false}]}',
'{"calculation_type": "component_sum", "rate_table": "wiring_pricing", "formula": "(dc_plugs * dc_cost) + (wall_plugs * wall_cost) + (wire_pieces * length_per_piece * wire_cost_per_ft)"}'),

-- Material Cut
('Material Cut', 'material_cut', 'sqft',
'{"fields": [{"name": "material_type", "type": "select", "label": "Material Type", "options": ["Raw", "Primed"], "required": true}, {"name": "dimensions", "type": "text", "label": "Dimensions", "required": true}, {"name": "cutting_required", "type": "boolean", "label": "Cutting Required", "required": true}, {"name": "trim_cutting", "type": "number", "label": "Trim Cutting (linear ft)", "required": false}, {"name": "design_hours", "type": "number", "label": "Design Hours", "required": false}]}',
'{"calculation_type": "material_plus_services", "rate_table": "material_cut_pricing", "formula": "(area * material_rate) + (cutting ? area * cutting_rate : 0) + (trim_cutting * trim_rate) + (design_hours * design_rate)"}'),

-- UL (supplementary - beyond existing ul_listing_pricing)
('UL Supplementary', 'ul_supplementary', 'ea',
'{"fields": [{"name": "ul_type", "type": "select", "label": "UL Type", "options": ["Standard", "Expedited"], "required": true}, {"name": "set_count", "type": "number", "label": "Set Count", "required": true}, {"name": "drawings_required", "type": "boolean", "label": "Drawings Required", "required": false}]}',
'{"calculation_type": "ul_based", "rate_table": "ul_listing_pricing", "formula": "base_fee + (set_count * per_set_fee)"}'),

-- Shipping (uses existing shipping_rates_pricing)
('Shipping', 'shipping', 'ea',
'{"fields": [{"name": "shipping_type", "type": "select", "label": "Shipping Type", "options": ["Standard", "Expedited", "Freight"], "required": true}, {"name": "weight", "type": "number", "label": "Weight (lbs)", "required": true}, {"name": "dimensions", "type": "text", "label": "Package Dimensions", "required": true}, {"name": "pallet_required", "type": "boolean", "label": "Pallet Required", "required": false}, {"name": "crate_required", "type": "boolean", "label": "Crate Required", "required": false}]}',
'{"calculation_type": "shipping_based", "rate_table": "shipping_rates_pricing", "formula": "base_rate + (pallet ? pallet_rate : 0) + (crate ? crate_rate : 0)"}');

-- Update existing Channel Letters with pricing rules
UPDATE product_types 
SET pricing_rules = '{"calculation_type": "channel_letter_complex", "rate_table": "channel_letter_types", "led_table": "led_types_pricing", "transformer_table": "transformer_types_pricing", "ul_table": "ul_listing_pricing", "formula": "letter_calculation + led_calculation + transformer_calculation + ul_calculation"}'
WHERE name = 'Channel Letters';