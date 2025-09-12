-- =====================================================
-- MIGRATION 02: Channel Letter Pricing Tables
-- =====================================================
-- Channel letter specific pricing without complex features
-- =====================================================

-- Channel Letter Types and Base Pricing
CREATE TABLE channel_letter_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type_name VARCHAR(100) NOT NULL,
  type_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  
  -- Size constraints
  min_size_inches DECIMAL(5,2) DEFAULT 3.0,
  max_size_inches DECIMAL(5,2) DEFAULT 48.0,
  
  -- Pricing structure
  base_rate_per_inch DECIMAL(8,4) NOT NULL,
  minimum_charge DECIMAL(8,2) DEFAULT 0,
  
  -- Labor factors
  setup_time_minutes INT DEFAULT 15,
  complexity_multiplier DECIMAL(4,2) DEFAULT 1.0,
  
  -- Excel formula integration (simple text for now)
  size_adjustment_rules TEXT,
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
  INDEX idx_type_code (type_code),
  INDEX idx_active (is_active)
);

-- UL Listing Pricing
CREATE TABLE ul_listing_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ul_type VARCHAR(100) NOT NULL,
  ul_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  
  -- Pricing structure
  base_fee DECIMAL(8,2) NOT NULL,
  per_set_fee DECIMAL(8,2) DEFAULT 0,
  minimum_sets INT DEFAULT 1,
  maximum_sets INT,
  
  -- Excel formula integration
  ul_calculation_rules TEXT,
  
  -- Processing
  processing_days INT DEFAULT 30,
  requires_drawings BOOLEAN DEFAULT true,
  
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
  INDEX idx_ul_code (ul_code),
  INDEX idx_active (is_active)
);

-- Supplier Item Costs (links to existing suppliers table)
CREATE TABLE supplier_item_costs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_id INT NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  item_reference_id INT NOT NULL,
  
  -- Cost tracking
  supplier_cost DECIMAL(10,4) NOT NULL,
  supplier_sku VARCHAR(100),
  minimum_order_quantity INT DEFAULT 1,
  
  -- Pricing history
  previous_cost DECIMAL(10,4),
  cost_change_date DATE,
  cost_change_percent DECIMAL(5,2),
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_current BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_supplier_item (supplier_id, item_type, item_reference_id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_current (is_current)
);

-- Pricing Calculation Cache
CREATE TABLE pricing_calculation_cache (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_type VARCHAR(100) NOT NULL,
  item_reference_id INT NOT NULL,
  calculation_parameters TEXT,
  
  -- Calculated results
  average_supplier_cost DECIMAL(10,4),
  markup_percent DECIMAL(5,2),
  final_price DECIMAL(10,4),
  price_confidence_score DECIMAL(3,2),
  
  -- Cache management
  calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_valid BOOLEAN DEFAULT true,
  
  UNIQUE KEY idx_item_cache (item_type, item_reference_id),
  INDEX idx_expires (expires_at, is_valid)
);