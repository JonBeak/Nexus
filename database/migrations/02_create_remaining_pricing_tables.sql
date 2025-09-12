-- =====================================================
-- PRICING TABLES - Part 2 of Unified Pricing System
-- =====================================================

-- Painting pricing system
CREATE TABLE painting_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  painting_type VARCHAR(100) NOT NULL,
  painting_code VARCHAR(20) UNIQUE NOT NULL,
  face_rate_per_sqft DECIMAL(8,4) NOT NULL,
  return_3in_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  return_4in_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  return_5in_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  trim_rate_per_linear_ft DECIMAL(8,4) DEFAULT 0.0000,
  face_calculation_rules JSON,
  return_calculation_rules JSON,
  trim_calculation_rules JSON,
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_painting_code (painting_code),
  INDEX idx_active (is_active)
);

-- Custom pricing system
CREATE TABLE custom_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  custom_type VARCHAR(100) NOT NULL,
  custom_code VARCHAR(20) UNIQUE NOT NULL,
  component_a_rate DECIMAL(8,4) DEFAULT 0.0000,
  component_b_rate DECIMAL(8,4) DEFAULT 0.0000,
  component_c_rate DECIMAL(8,4) DEFAULT 0.0000,
  custom_calculation_rules JSON,
  component_interaction_rules JSON,
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_custom_code (custom_code),
  INDEX idx_active (is_active)
);

-- Wiring pricing system
CREATE TABLE wiring_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  wiring_type VARCHAR(100) NOT NULL,
  wiring_code VARCHAR(20) UNIQUE NOT NULL,
  dc_plug_cost_per_unit DECIMAL(8,2) NOT NULL,
  wall_plug_cost_per_unit DECIMAL(8,2) NOT NULL,
  wire_cost_per_ft DECIMAL(8,4) NOT NULL,
  plug_calculation_rules JSON,
  wire_calculation_rules JSON,
  piece_length_rules JSON,
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_wiring_code (wiring_code),
  INDEX idx_active (is_active)
);

-- Material cut pricing system
CREATE TABLE material_cut_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  material_type VARCHAR(100) NOT NULL,
  material_code VARCHAR(20) UNIQUE NOT NULL,
  raw_material_rate_per_sqft DECIMAL(8,4) NOT NULL,
  primed_material_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  cutting_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  trim_cutting_rate_per_linear_ft DECIMAL(8,4) DEFAULT 0.0000,
  design_cost_per_hour DECIMAL(8,2) DEFAULT 0.00,
  material_calculation_rules JSON,
  cutting_calculation_rules JSON,
  design_calculation_rules JSON,
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_material_code (material_code),
  INDEX idx_active (is_active)
);

-- Multiplier ranges system
CREATE TABLE multiplier_ranges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  multiplier_name VARCHAR(100) NOT NULL,
  multiplier_code VARCHAR(20) UNIQUE NOT NULL,
  quantity_ranges JSON NOT NULL,
  applies_to_categories JSON,
  priority_order INT DEFAULT 0,
  range_calculation_rules JSON,
  cascading_rules JSON,
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_multiplier_code (multiplier_code),
  INDEX idx_active (is_active)
);

-- Discount ranges system
CREATE TABLE discount_ranges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  discount_name VARCHAR(100) NOT NULL,
  discount_code VARCHAR(20) UNIQUE NOT NULL,
  discount_ranges JSON NOT NULL,
  applies_to_categories JSON,
  customer_restrictions JSON,
  priority_order INT DEFAULT 0,
  range_calculation_rules JSON,
  discount_application_rules JSON,
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_discount_code (discount_code),
  INDEX idx_active (is_active)
);