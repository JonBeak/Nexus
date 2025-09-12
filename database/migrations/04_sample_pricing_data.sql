-- =====================================================
-- SAMPLE PRICING DATA - Part 4 of Unified Pricing System
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