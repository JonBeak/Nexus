-- =====================================================
-- BLADE SIGN PRICING CONFIGURATION TABLE
-- =====================================================
-- Migration: Replaces old blade_sign_pricing structure with config-based approach
-- Date: 2025-10-16
-- Purpose: Store tiered pricing constants for Blade Sign calculations

-- Drop old table structure (if exists)
DROP TABLE IF EXISTS blade_sign_pricing;

-- Create new config-based table
CREATE TABLE blade_sign_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_name VARCHAR(100) NOT NULL UNIQUE,
  config_value DECIMAL(10,4) NOT NULL,
  config_description VARCHAR(200),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (is_active),
  INDEX idx_config_name (config_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert pricing configuration constants
INSERT INTO blade_sign_pricing (config_name, config_value, config_description) VALUES
-- Tiered pricing - Frame
('frame_base_cost', 300.0000, 'Frame base cost for < 4 sqft'),
('frame_rate_per_sqft', 12.5000, 'Frame cost per sqft above 4 sqft'),

-- Tiered pricing - Assembly
('assembly_base_cost', 100.0000, 'Assembly base cost for < 4 sqft'),
('assembly_rate_per_sqft', 5.0000, 'Assembly cost per sqft above 4 sqft'),

-- Tiered pricing - Wrap (Aluminum)
('wrap_base_cost', 50.0000, 'Wrap base cost for < 4 sqft'),
('wrap_rate_per_sqft', 7.5000, 'Wrap cost per sqft above 4 sqft'),

-- Fixed costs
('cutting_fixed_cost', 25.0000, 'Fixed cutting cost for 2" return'),

-- Size limits and thresholds
('size_threshold_sqft', 4.0000, 'Size threshold for tiered pricing'),
('maximum_size_sqft', 2350.0000, 'Maximum allowable size'),

-- Channel letter rate reference (for blade material calculation if needed)
('channel_letter_rate', 4.5000, 'Channel letter 3" front rate reference'),

-- LED calculation factors
('led_area_factor', 0.09, 'LED area calculation factor (9/100)'),
('led_perimeter_factor', 1.4, 'LED perimeter calculation factor');

-- Update product_types for Blade Sign (ID 6)
UPDATE product_types
SET
  field_prompts = JSON_OBJECT(
    'qty', '#',
    'field1', 'Shape',
    'field2', 'X x Y',
    'field3', 'LEDs #',
    'field4', 'UL',
    'field5', 'PS #',
    'field6', '',
    'field7', '~ Frame ~',
    'field8', '~ Assem ~',
    'field9', '~ Wrap ~',
    'field10', '~ Cut 2" ~',
    'field11', '',
    'field12', '',
    'qty_enabled', true,
    'field1_enabled', true,
    'field2_enabled', true,
    'field3_enabled', true,
    'field4_enabled', true,
    'field5_enabled', true,
    'field6_enabled', false,
    'field7_enabled', true,
    'field8_enabled', true,
    'field9_enabled', true,
    'field10_enabled', true,
    'field11_enabled', false,
    'field12_enabled', false
  ),
  static_options = JSON_OBJECT(
    'field1', JSON_ARRAY('Circle', 'Rectangle')
  )
WHERE id = 6;

-- Verification query
SELECT
  config_name,
  config_value,
  config_description
FROM blade_sign_pricing
WHERE is_active = 1
ORDER BY id;
