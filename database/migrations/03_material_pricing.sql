-- =====================================================
-- MIGRATION 03: Material Pricing Tables
-- =====================================================
-- All material categories from Excel (Vinyl, Substrate, Labor, etc.)
-- =====================================================

-- Vinyl Materials Pricing
CREATE TABLE vinyl_materials_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  material_name VARCHAR(100) NOT NULL,
  material_code VARCHAR(20) UNIQUE NOT NULL,
  material_type VARCHAR(20) NOT NULL,
  
  -- Pricing per square foot
  price_per_sqft DECIMAL(8,4) NOT NULL,
  color_upcharge_percent DECIMAL(5,2) DEFAULT 0,
  
  -- Specifications
  thickness_mil INT,
  adhesive_type VARCHAR(50),
  finish VARCHAR(50),
  
  -- Excel formula integration
  calculation_rules TEXT,
  
  -- Supplier tracking
  primary_supplier_id INT,
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_material_code (material_code),
  INDEX idx_active (is_active)
);

-- Substrate Materials Pricing
CREATE TABLE substrate_materials_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  substrate_name VARCHAR(100) NOT NULL,
  substrate_code VARCHAR(20) UNIQUE NOT NULL,
  substrate_type VARCHAR(20) NOT NULL,
  
  -- Pricing structure
  price_per_sqft DECIMAL(8,4) NOT NULL,
  cutting_rate_per_sqft DECIMAL(8,4) DEFAULT 0,
  pin_cost_per_piece DECIMAL(6,2) DEFAULT 0,
  standoff_cost_per_piece DECIMAL(6,2) DEFAULT 0,
  dtape_cost_per_sqft DECIMAL(6,4) DEFAULT 0,
  assembly_rate_per_sqft DECIMAL(8,4) DEFAULT 0,
  
  -- Specifications
  thickness_inch DECIMAL(4,3),
  color_options TEXT,
  
  -- Excel formula integration
  calculation_rules TEXT,
  
  -- Supplier tracking
  primary_supplier_id INT,
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_substrate_code (substrate_code),
  INDEX idx_active (is_active)
);

-- Labor Rates Pricing
CREATE TABLE labor_rates_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  labor_type VARCHAR(100) NOT NULL,
  labor_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  
  -- Pricing structure
  rate_type VARCHAR(20) NOT NULL,
  base_rate DECIMAL(8,4) NOT NULL,
  minimum_charge DECIMAL(8,2) DEFAULT 0,
  
  -- Excel categories
  category VARCHAR(20) NOT NULL,
  
  -- Excel formula integration
  calculation_rules TEXT,
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_labor_code (labor_code),
  INDEX idx_category (category),
  INDEX idx_active (is_active)
);

-- Shipping Rates Pricing
CREATE TABLE shipping_rates_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shipping_type VARCHAR(100) NOT NULL,
  shipping_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  
  -- Excel shipping structure
  base_rate DECIMAL(8,2) NOT NULL,
  multi_rate DECIMAL(8,2) DEFAULT 0,
  small_b_rate DECIMAL(8,2) DEFAULT 0,
  small_bb_rate DECIMAL(8,2) DEFAULT 0,
  large_b_rate DECIMAL(8,2) DEFAULT 0,
  large_bb_rate DECIMAL(8,2) DEFAULT 0,
  pallet_rate DECIMAL(8,2) DEFAULT 0,
  crate_rate DECIMAL(8,2) DEFAULT 0,
  tailgate_rate DECIMAL(8,2) DEFAULT 0,
  
  -- Excel formula integration
  calculation_rules TEXT,
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_shipping_code (shipping_code),
  INDEX idx_active (is_active)
);