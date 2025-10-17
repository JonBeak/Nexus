-- =====================================================
-- MATERIAL CUT PRODUCT - Complete Restructure
-- =====================================================
-- Date: 2025-10-17
-- Purpose: Restructure Material Cut field prompts and pricing table
-- =====================================================

-- =====================================================
-- STEP 1: Drop and Recreate material_cut_pricing Table
-- =====================================================

DROP TABLE IF EXISTS material_cut_pricing;

CREATE TABLE material_cut_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,

  -- Return pricing (Fields 4-7: 3" Return, 4" Return, 5" Return, Trim Cap)
  -- Prices are per 100 linear feet (user input rounded up to multiples of 100)
  return_3in_material_only DECIMAL(8,2) NOT NULL COMMENT 'Material Only - per 100 linear feet',
  return_3in_material_cut DECIMAL(8,2) NOT NULL COMMENT 'Material + Cut - per 100 linear feet',
  return_3in_prime_ret DECIMAL(8,2) NOT NULL COMMENT 'Prime Ret - per 100 linear feet',

  return_4in_material_only DECIMAL(8,2) NOT NULL,
  return_4in_material_cut DECIMAL(8,2) NOT NULL,
  return_4in_prime_ret DECIMAL(8,2) NOT NULL,

  return_5in_material_only DECIMAL(8,2) NOT NULL,
  return_5in_material_cut DECIMAL(8,2) NOT NULL,
  return_5in_prime_ret DECIMAL(8,2) NOT NULL,

  -- Trim Cap does not have Prime Ret option
  trim_cap_material_only DECIMAL(8,2) NOT NULL,
  trim_cap_material_cut DECIMAL(8,2) NOT NULL,

  -- Sheet material pricing constants (Fields 8-9: PC, ACM)
  -- Formula: ceil(length/96) * base_cost + (length/96) * length_cost
  pc_base_cost DECIMAL(8,2) NOT NULL COMMENT 'PC: Multiplied by ceil(length/96)',
  pc_length_cost DECIMAL(8,2) NOT NULL COMMENT 'PC: Multiplied by (length/96)',

  acm_base_cost DECIMAL(8,2) NOT NULL COMMENT 'ACM: Multiplied by ceil(length/96)',
  acm_length_cost DECIMAL(8,2) NOT NULL COMMENT 'ACM: Multiplied by (length/96)',

  -- Design fee (Field 10)
  design_fee DECIMAL(8,2) NOT NULL COMMENT 'Flat design fee',

  -- Standard tracking fields
  effective_date DATE NOT NULL,
  expires_date DATE DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Material Cut pricing: Returns (3", 4", 5", Trim Cap), Sheets (PC, ACM), Design fee';

-- =====================================================
-- STEP 2: Insert Initial Pricing Data
-- =====================================================

INSERT INTO material_cut_pricing (
  -- Returns (Material Only, Material + Cut, Prime Ret)
  return_3in_material_only,
  return_3in_material_cut,
  return_3in_prime_ret,

  return_4in_material_only,
  return_4in_material_cut,
  return_4in_prime_ret,

  return_5in_material_only,
  return_5in_material_cut,
  return_5in_prime_ret,

  -- Trim Cap (no Prime Ret)
  trim_cap_material_only,
  trim_cap_material_cut,

  -- Sheet materials
  pc_base_cost,
  pc_length_cost,
  acm_base_cost,
  acm_length_cost,

  -- Design
  design_fee,

  -- Tracking
  effective_date,
  is_active
) VALUES (
  -- 3" Return: 10.40, 15, 19
  10.40, 15.00, 19.00,

  -- 4" Return: 11.05, 15.5, 20
  11.05, 15.50, 20.00,

  -- 5" Return: 11.7, 16, 20.5
  11.70, 16.00, 20.50,

  -- Trim Cap: 5.20, 10
  5.20, 10.00,

  -- PC: ceil(length/96)*30 + (length/96)*160
  30.00, 160.00,

  -- ACM: ceil(length/96)*20 + (length/96)*120
  20.00, 120.00,

  -- Design: $30 flat fee
  30.00,

  -- Tracking
  '2025-10-17',
  1
);

-- =====================================================
-- STEP 3: Update Field Prompts and Static Options
-- =====================================================

-- Update field_prompts (labels and enabled states)
UPDATE product_types
SET field_prompts = JSON_OBJECT(
  'qty', '#',
  'qty_enabled', true,

  -- Field1: Material Type dropdown
  'field1', 'Material Type',
  'field1_enabled', true,

  -- Field2: Prime Ret dropdown
  'field2', 'Prime Ret',
  'field2_enabled', true,

  -- Field3: Empty
  'field3', '',
  'field3_enabled', false,

  -- Field4-10: Float inputs
  'field4', '3" Return',
  'field4_enabled', true,

  'field5', '4" Return',
  'field5_enabled', true,

  'field6', '5" Return',
  'field6_enabled', true,

  'field7', 'Trim Cap',
  'field7_enabled', true,

  'field8', 'PC',
  'field8_enabled', true,

  'field9', 'ACM',
  'field9_enabled', true,

  'field10', 'Design',
  'field10_enabled', true,

  -- Field11-12: Empty
  'field11', '',
  'field11_enabled', false,

  'field12', '',
  'field12_enabled', false
)
WHERE id = 11 AND name = 'Material Cut';

-- Update static_options (dropdown options)
UPDATE product_types
SET static_options = JSON_OBJECT(
  'field1', JSON_ARRAY('Material Only', 'Material + Cut'),
  'field2', JSON_ARRAY('Yes', 'No')
)
WHERE id = 11 AND name = 'Material Cut';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify pricing data
SELECT 'Pricing Data Inserted:' as status;
SELECT * FROM material_cut_pricing WHERE is_active = 1;

-- Verify field prompts updated
SELECT 'Field Prompts Updated:' as status;
SELECT id, name, field_prompts
FROM product_types
WHERE id = 11;
