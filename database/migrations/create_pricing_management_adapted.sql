-- =====================================================
-- PRICING MANAGEMENT SYSTEM - ADAPTED FOR EXISTING SCHEMA
-- =====================================================
-- This creates a pricing management system that integrates with
-- existing tables: suppliers, audit_trail, leds, power_supplies, 
-- product_types, customer_pricing_history, etc.
-- =====================================================

-- =====================================================
-- 1. PRICING CHANGE APPROVAL SYSTEM (NEW)
-- =====================================================

CREATE TABLE pricing_change_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_type ENUM('CREATE', 'UPDATE', 'DELETE', 'BULK_IMPORT') NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id INT, -- NULL for CREATE operations
  change_data JSON NOT NULL, -- Stores the proposed changes
  current_data JSON, -- Stores current values for updates
  reason TEXT NOT NULL,
  business_justification TEXT,
  requested_by INT NOT NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Approval workflow
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') DEFAULT 'PENDING',
  reviewed_by INT,
  reviewed_at TIMESTAMP NULL,
  review_notes TEXT,
  
  -- Implementation tracking
  implemented_by INT,
  implemented_at TIMESTAMP NULL,
  
  -- Effective date management
  effective_date DATE NOT NULL,
  expires_date DATE,
  
  FOREIGN KEY (requested_by) REFERENCES users(user_id),
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id),
  FOREIGN KEY (implemented_by) REFERENCES users(user_id),
  
  INDEX idx_status_date (status, requested_at),
  INDEX idx_table_name (table_name),
  INDEX idx_requested_by (requested_by)
);

-- =====================================================
-- 2. SUPPLIER COST MONITORING & ALERTS (NEW)
-- =====================================================

CREATE TABLE supplier_cost_alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  alert_type ENUM('COST_INCREASE', 'COST_DECREASE', 'NEW_SUPPLIER', 'SUPPLIER_DISCONTINUED') NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id INT NOT NULL,
  supplier_id INT NOT NULL,
  old_cost DECIMAL(10,4),
  new_cost DECIMAL(10,4),
  percent_change DECIMAL(5,2),
  alert_threshold_exceeded BOOLEAN DEFAULT false,
  
  -- Alert status
  status ENUM('UNREAD', 'ACKNOWLEDGED', 'RESOLVED') DEFAULT 'UNREAD',
  acknowledged_by INT,
  acknowledged_at TIMESTAMP NULL,
  resolution_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
  FOREIGN KEY (acknowledged_by) REFERENCES users(user_id),
  
  INDEX idx_status_type (status, alert_type),
  INDEX idx_created_at (created_at),
  INDEX idx_supplier (supplier_id)
);

-- =====================================================
-- 3. CHANNEL LETTER PRICING TYPES (NEW)
-- =====================================================

CREATE TABLE channel_letter_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type_name VARCHAR(100) NOT NULL,
  type_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  
  -- Size constraints (matches Excel logic)
  min_size_inches DECIMAL(5,2) DEFAULT 3.0,
  max_size_inches DECIMAL(5,2) DEFAULT 48.0,
  
  -- Pricing structure (Excel: base rate per inch)
  base_rate_per_inch DECIMAL(8,4) NOT NULL,
  minimum_charge DECIMAL(8,2) DEFAULT 0,
  
  -- Labor factors (Excel: complexity multipliers)
  setup_time_minutes INT DEFAULT 15,
  complexity_multiplier DECIMAL(4,2) DEFAULT 1.0,
  
  -- Excel formula integration
  size_adjustment_rules JSON, -- Stores size adjustment logic (6-7" = 9", etc.)
  calculation_rules JSON, -- Stores Excel formula logic
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields (using existing pattern)
  created_by INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_type_code (type_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 4. UL LISTING PRICING (NEW)
-- =====================================================

CREATE TABLE ul_listing_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ul_type VARCHAR(100) NOT NULL,
  ul_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  
  -- Pricing structure (Excel: UL Base$ + UL $/set)
  base_fee DECIMAL(8,2) NOT NULL,
  per_set_fee DECIMAL(8,2) DEFAULT 0,
  minimum_sets INT DEFAULT 1,
  maximum_sets INT,
  
  -- Excel formula integration
  ul_calculation_rules JSON, -- UL fee calculation logic
  
  -- Processing
  processing_days INT DEFAULT 30,
  requires_drawings BOOLEAN DEFAULT true,
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields (using existing pattern)
  created_by INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_ul_code (ul_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 5. MATERIAL PRICING CATEGORIES (NEW - FOR EXCEL CATEGORIES)
-- =====================================================

-- Vinyl Materials (Excel: T, Tc, Perf calculations)
CREATE TABLE vinyl_materials_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  material_name VARCHAR(100) NOT NULL,
  material_code VARCHAR(20) UNIQUE NOT NULL,
  material_type ENUM('STANDARD', 'TRANSLUCENT', 'PERFORATED') NOT NULL,
  
  -- Pricing per square foot (Excel: T, Tc, Perf rates)
  price_per_sqft DECIMAL(8,4) NOT NULL,
  color_upcharge_percent DECIMAL(5,2) DEFAULT 0,
  
  -- Specifications
  thickness_mil INT,
  adhesive_type VARCHAR(50),
  finish VARCHAR(50),
  
  -- Excel formula integration
  calculation_rules JSON, -- 24" pricing, digital pricing rules
  
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
  
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (primary_supplier_id) REFERENCES suppliers(supplier_id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_material_code (material_code),
  INDEX idx_active (is_active)
);

-- Substrate Materials (Excel: Cut types, pins, standoffs)
CREATE TABLE substrate_materials_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  substrate_name VARCHAR(100) NOT NULL,
  substrate_code VARCHAR(20) UNIQUE NOT NULL,
  substrate_type ENUM('ALUMINUM', 'ACM', 'PLASTIC', 'COMPOSITE') NOT NULL,
  
  -- Pricing structure (Excel: XY pricing + pins + standoffs + dtape + assem)
  price_per_sqft DECIMAL(8,4) NOT NULL,
  cutting_rate_per_sqft DECIMAL(8,4) DEFAULT 0,
  pin_cost_per_piece DECIMAL(6,2) DEFAULT 0,
  standoff_cost_per_piece DECIMAL(6,2) DEFAULT 0,
  dtape_cost_per_sqft DECIMAL(6,4) DEFAULT 0,
  assembly_rate_per_sqft DECIMAL(8,4) DEFAULT 0,
  
  -- Specifications
  thickness_inch DECIMAL(4,3),
  color_options JSON,
  
  -- Excel formula integration
  calculation_rules JSON, -- Size calculation logic
  
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
  
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (primary_supplier_id) REFERENCES suppliers(supplier_id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_substrate_code (substrate_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 6. LABOR & SERVICE RATES (NEW)
-- =====================================================

CREATE TABLE labor_rates_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  labor_type VARCHAR(100) NOT NULL,
  labor_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  
  -- Pricing structure
  rate_type ENUM('PER_HOUR', 'PER_SQFT', 'PER_PIECE', 'FIXED') NOT NULL,
  base_rate DECIMAL(8,4) NOT NULL,
  minimum_charge DECIMAL(8,2) DEFAULT 0,
  
  -- Excel categories (Painting, Assembly, Cutting, Wiring)
  category ENUM('PAINTING', 'ASSEMBLY', 'CUTTING', 'WIRING', 'CUSTOM') NOT NULL,
  
  -- Excel formula integration
  calculation_rules JSON, -- Face/return calculations, wire footage, etc.
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_labor_code (labor_code),
  INDEX idx_category (category),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 7. SHIPPING RATES (NEW - FROM EXCEL)
-- =====================================================

CREATE TABLE shipping_rates_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shipping_type VARCHAR(100) NOT NULL,
  shipping_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  
  -- Excel shipping structure (Base, Multi, b, bb, B, BB, Pallet, Crate, Tailgate)
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
  calculation_rules JSON, -- Days calculation logic
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_shipping_code (shipping_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 8. SUPPLIER ITEM COSTS (NEW - LINKS TO EXISTING TABLES)
-- =====================================================

CREATE TABLE supplier_item_costs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_id INT NOT NULL,
  item_type ENUM('LED', 'POWER_SUPPLY', 'CHANNEL_LETTER', 'UL_LISTING', 'VINYL', 'SUBSTRATE', 'LABOR', 'SHIPPING') NOT NULL,
  item_reference_id INT NOT NULL, -- FK to the specific item table
  
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
  
  FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  
  INDEX idx_supplier_item (supplier_id, item_type, item_reference_id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_current (is_current)
);

-- =====================================================
-- 9. PRICING CALCULATION CACHE (NEW)
-- =====================================================

CREATE TABLE pricing_calculation_cache (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_type VARCHAR(100) NOT NULL,
  item_reference_id INT NOT NULL,
  calculation_parameters JSON, -- Stores the inputs used for calculation
  
  -- Calculated results
  average_supplier_cost DECIMAL(10,4),
  markup_percent DECIMAL(5,2),
  final_price DECIMAL(10,4),
  price_confidence_score DECIMAL(3,2), -- 0-1 score based on supplier data quality
  
  -- Cache management
  calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_valid BOOLEAN DEFAULT true,
  
  UNIQUE KEY idx_item_cache (item_type, item_reference_id),
  INDEX idx_expires (expires_at, is_valid)
);

-- =====================================================
-- 10. SYSTEM CONFIGURATION (NEW)
-- =====================================================

CREATE TABLE pricing_system_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  config_type ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') DEFAULT 'STRING',
  description TEXT,
  
  -- Change tracking
  updated_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

-- =====================================================
-- 11. CSV IMPORT TRACKING (NEW)
-- =====================================================

CREATE TABLE csv_import_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  import_type VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  total_records INT NOT NULL,
  successful_records INT NOT NULL,
  failed_records INT NOT NULL,
  error_summary JSON,
  
  -- User tracking
  imported_by INT NOT NULL,
  import_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  import_completed_at TIMESTAMP NULL,
  
  -- File data
  file_size_bytes INT,
  file_hash VARCHAR(64), -- For duplicate detection
  
  FOREIGN KEY (imported_by) REFERENCES users(user_id),
  INDEX idx_import_type (import_type),
  INDEX idx_imported_by (imported_by),
  INDEX idx_started_at (import_started_at)
);

-- =====================================================
-- 12. INITIAL SYSTEM CONFIGURATION
-- =====================================================

INSERT INTO pricing_system_config (config_key, config_value, config_type, description, updated_by) VALUES
('supplier_cost_alert_threshold', '5.0', 'NUMBER', 'Percentage change threshold for supplier cost alerts', 1),
('pricing_cache_expiry_hours', '24', 'NUMBER', 'Hours before pricing cache expires', 1),
('default_markup_percent', '35.0', 'NUMBER', 'Default markup percentage for new items', 1),
('require_approval_for_increases', 'true', 'BOOLEAN', 'Require owner approval for price increases', 1),
('auto_approve_decreases', 'false', 'BOOLEAN', 'Auto-approve price decreases', 1),
('max_csv_import_records', '10000', 'NUMBER', 'Maximum records allowed in CSV import', 1),
('notification_email_enabled', 'true', 'BOOLEAN', 'Send email notifications for price changes', 1);

-- =====================================================
-- 13. ENHANCED AUDIT TRIGGERS (BUILDS ON EXISTING)
-- =====================================================

DELIMITER //

-- Enhanced audit trigger for LEDs table (existing)
CREATE TRIGGER leds_pricing_audit_trigger
AFTER UPDATE ON leds
FOR EACH ROW
BEGIN
  IF OLD.price != NEW.price THEN
    INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details, created_at)
    VALUES (1, 'UPDATE', 'LED_PRICING', NEW.led_id, 
            CONCAT('Price changed from ', OLD.price, ' to ', NEW.price), NOW());
  END IF;
END//

-- Enhanced audit trigger for Power Supplies (existing)
CREATE TRIGGER power_supplies_pricing_audit_trigger
AFTER UPDATE ON power_supplies
FOR EACH ROW
BEGIN
  IF OLD.price != NEW.price THEN
    INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details, created_at)
    VALUES (1, 'UPDATE', 'POWER_SUPPLY_PRICING', NEW.power_supply_id, 
            CONCAT('Price changed from ', OLD.price, ' to ', NEW.price), NOW());
  END IF;
END//

-- Channel Letter Types Audit Trigger (new table)
CREATE TRIGGER channel_letter_types_audit_trigger
AFTER UPDATE ON channel_letter_types
FOR EACH ROW
BEGIN
  IF OLD.base_rate_per_inch != NEW.base_rate_per_inch THEN
    INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details, created_at)
    VALUES (COALESCE(NEW.updated_by, 1), 'UPDATE', 'CHANNEL_LETTER_PRICING', NEW.id, 
            CONCAT('Base rate changed from ', OLD.base_rate_per_inch, ' to ', NEW.base_rate_per_inch), NOW());
  END IF;
END//

-- Supplier Cost Alert Trigger
CREATE TRIGGER supplier_item_costs_alert_trigger
AFTER UPDATE ON supplier_item_costs
FOR EACH ROW
BEGIN
  DECLARE threshold_percent DECIMAL(5,2);
  DECLARE cost_change_percent DECIMAL(5,2);
  
  -- Get alert threshold from config
  SELECT CAST(config_value AS DECIMAL(5,2)) INTO threshold_percent
  FROM pricing_system_config 
  WHERE config_key = 'supplier_cost_alert_threshold';
  
  -- Calculate percentage change
  IF OLD.supplier_cost > 0 THEN
    SET cost_change_percent = ((NEW.supplier_cost - OLD.supplier_cost) / OLD.supplier_cost) * 100;
    
    -- Create alert if threshold exceeded
    IF ABS(cost_change_percent) >= COALESCE(threshold_percent, 5.0) THEN
      INSERT INTO supplier_cost_alerts (
        alert_type, 
        table_name, 
        record_id, 
        supplier_id, 
        old_cost, 
        new_cost, 
        percent_change, 
        alert_threshold_exceeded
      ) VALUES (
        IF(cost_change_percent > 0, 'COST_INCREASE', 'COST_DECREASE'),
        'supplier_item_costs',
        NEW.id,
        NEW.supplier_id,
        OLD.supplier_cost,
        NEW.supplier_cost,
        cost_change_percent,
        true
      );
    END IF;
  END IF;
END//

DELIMITER ;

-- =====================================================
-- 14. SAMPLE DATA FOR TESTING (ADAPTED)
-- =====================================================

-- Sample Channel Letter Types (based on Excel formulas)
INSERT INTO channel_letter_types (
  type_name, type_code, description, min_size_inches, max_size_inches, 
  base_rate_per_inch, complexity_multiplier, size_adjustment_rules, calculation_rules,
  effective_date, created_by
) VALUES
('Standard Front Lit', 'FL_STD', 'Standard front-lit channel letters with LED face illumination', 3.0, 48.0, 12.50, 1.0, 
 '{"6_inch": 9.0, "7_inch": 9.0, "8_inch": 10.0, "9_inch": 10.0}',
 '{"formula_type": "excel_vlookup", "base_calculation": "max(length,width) * base_rate_per_inch"}',
 CURDATE(), 1),
('Reverse Lit', 'RL_STD', 'Reverse-lit channel letters with LED back illumination', 4.0, 60.0, 15.75, 1.2, 
 '{"6_inch": 9.0, "7_inch": 9.0, "8_inch": 10.0, "9_inch": 10.0}',
 '{"formula_type": "excel_vlookup", "base_calculation": "max(length,width) * base_rate_per_inch * 1.2"}',
 CURDATE(), 1);

-- Sample UL Listing Pricing
INSERT INTO ul_listing_pricing (
  ul_type, ul_code, description, base_fee, per_set_fee, minimum_sets,
  ul_calculation_rules, effective_date, created_by
) VALUES
('Standard UL Listing', 'UL_STD', 'Standard UL 48 outdoor sign listing', 850.00, 45.00, 1,
 '{"formula": "base_fee + (sets * per_set_fee)", "min_sets": 1}', CURDATE(), 1),
('Expedited UL Listing', 'UL_EXP', 'Expedited UL processing (15 days)', 1200.00, 65.00, 1,
 '{"formula": "base_fee + (sets * per_set_fee)", "min_sets": 1, "expedited": true}', CURDATE(), 1);

-- Sample Vinyl Materials
INSERT INTO vinyl_materials_pricing (
  material_name, material_code, material_type, price_per_sqft, thickness_mil,
  calculation_rules, effective_date, created_by
) VALUES
('Standard Vinyl', 'VINYL_STD', 'STANDARD', 2.85, 3,
 '{"T_rate": 2.85, "Tc_rate": 3.20}', CURDATE(), 1),
('Translucent Vinyl', 'VINYL_TC', 'TRANSLUCENT', 3.20, 4,
 '{"T_rate": 3.20, "Tc_rate": 3.20}', CURDATE(), 1),
('Perforated Vinyl', 'VINYL_PERF', 'PERFORATED', 4.15, 5,
 '{"Perf_rate": 4.15}', CURDATE(), 1);

-- Sample Labor Rates (from Excel categories)
INSERT INTO labor_rates_pricing (
  labor_type, labor_code, category, rate_type, base_rate, minimum_charge,
  calculation_rules, effective_date, created_by
) VALUES
('Face Painting', 'PAINT_FACE', 'PAINTING', 'PER_SQFT', 4.25, 15.00,
 '{"face_rate": 4.25, "return_rate": 3.85}', CURDATE(), 1),
('Assembly Labor', 'ASSEM_STD', 'ASSEMBLY', 'PER_SQFT', 2.50, 25.00,
 '{"base_rate": 2.50, "complexity_multiplier": true}', CURDATE(), 1),
('CNC Cutting', 'CUT_CNC', 'CUTTING', 'PER_SQFT', 3.75, 20.00,
 '{"material_multiplier": {"aluminum": 1.0, "acm": 0.8, "plastic": 0.6}}', CURDATE(), 1);

-- =====================================================
-- END OF ADAPTED PRICING MANAGEMENT SYSTEM
-- =====================================================