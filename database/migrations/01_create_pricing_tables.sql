-- =====================================================
-- PRICING TABLES - Part 1 of Unified Pricing System
-- =====================================================

-- Vinyl pricing system
CREATE TABLE vinyl_types_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vinyl_type VARCHAR(100) NOT NULL,
  vinyl_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  base_price_per_sqft DECIMAL(8,4) NOT NULL,
  application_fee DECIMAL(8,2) DEFAULT 0.00,
  setup_charge DECIMAL(8,2) DEFAULT 0.00,
  minimum_charge DECIMAL(8,2) DEFAULT 0.00,
  size_rules JSON,
  application_rules JSON,
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_vinyl_code (vinyl_code),
  INDEX idx_active (is_active)
);

-- Substrate cut pricing system
CREATE TABLE substrate_cut_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  substrate_name VARCHAR(100) NOT NULL,
  substrate_code VARCHAR(20) UNIQUE NOT NULL,
  material_category VARCHAR(50) NOT NULL,
  material_cost_per_sqft DECIMAL(8,4) NOT NULL,
  cutting_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  drilling_rate_per_hole DECIMAL(8,4) DEFAULT 0.0000,
  pin_cost_per_piece DECIMAL(8,4) DEFAULT 0.0000,
  standoff_cost_per_piece DECIMAL(8,4) DEFAULT 0.0000,
  size_calculation_rules JSON,
  hardware_calculation_rules JSON,
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_substrate_code (substrate_code),
  INDEX idx_active (is_active)
);

-- Backer pricing system
CREATE TABLE backer_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  backer_type VARCHAR(100) NOT NULL,
  backer_code VARCHAR(20) UNIQUE NOT NULL,
  material_type ENUM('ALUMINUM', 'ACM') NOT NULL,
  base_rate_per_sqft DECIMAL(8,4) NOT NULL,
  folding_rate_per_sqft DECIMAL(8,4) DEFAULT 0.0000,
  dimension_sorting_rules JSON,
  folding_calculation_rules JSON,
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_backer_code (backer_code),
  INDEX idx_active (is_active)
);

-- Push thru pricing system
CREATE TABLE push_thru_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  push_thru_type VARCHAR(100) NOT NULL,
  push_thru_code VARCHAR(20) UNIQUE NOT NULL,
  backer_rate_per_sqft DECIMAL(8,4) NOT NULL,
  acrylic_rate_per_sqft DECIMAL(8,4) NOT NULL,
  led_rate_per_sqft DECIMAL(8,4) NOT NULL,
  transformer_base_cost DECIMAL(8,2) NOT NULL,
  multi_component_rules JSON,
  transformer_sizing_rules JSON,
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_push_thru_code (push_thru_code),
  INDEX idx_active (is_active)
);

-- Blade sign pricing system
CREATE TABLE blade_sign_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  blade_type VARCHAR(100) NOT NULL,
  blade_code VARCHAR(20) UNIQUE NOT NULL,
  frame_rate_per_linear_ft DECIMAL(8,4) NOT NULL,
  face_rate_per_sqft DECIMAL(8,4) NOT NULL,
  led_rate_per_linear_ft DECIMAL(8,4) DEFAULT 0.0000,
  transformer_cost_per_unit DECIMAL(8,2) DEFAULT 0.00,
  frame_calculation_rules JSON,
  circle_detection_rules JSON,
  led_integration_rules JSON,
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_blade_code (blade_code),
  INDEX idx_active (is_active)
);

-- LED Neon pricing system
CREATE TABLE led_neon_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  neon_type VARCHAR(100) NOT NULL,
  neon_code VARCHAR(20) UNIQUE NOT NULL,
  cost_per_linear_ft DECIMAL(8,4) NOT NULL,
  welding_cost_per_joint DECIMAL(8,2) DEFAULT 0.00,
  standoff_cost_per_piece DECIMAL(8,2) DEFAULT 0.00,
  opacity_multiplier DECIMAL(4,2) DEFAULT 1.0,
  color_multiplier DECIMAL(4,2) DEFAULT 1.0,
  length_calculation_rules JSON,
  welding_calculation_rules JSON,
  standoff_calculation_rules JSON,
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_neon_code (neon_code),
  INDEX idx_active (is_active)
);