-- =====================================================
-- PRICING MANAGEMENT SYSTEM - COMPLETE DATABASE SCHEMA
-- =====================================================
-- This creates a comprehensive pricing management system with:
-- - Full audit trails and approval workflows
-- - Supplier cost monitoring with alerts
-- - Channel letter pricing (first product category)
-- - Archetype pricing averaging across suppliers
-- - CSV import/export support structure
-- =====================================================

-- =====================================================
-- 1. SUPPLIERS MANAGEMENT
-- =====================================================

CREATE TABLE suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_name VARCHAR(200) NOT NULL,
  supplier_code VARCHAR(50) UNIQUE,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address TEXT,
  payment_terms VARCHAR(100),
  lead_time_days INT DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- =====================================================
-- 2. PRICING CHANGE APPROVAL SYSTEM
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
-- 3. UNIVERSAL AUDIT TRAIL SYSTEM
-- =====================================================

CREATE TABLE pricing_audit_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  table_name VARCHAR(100) NOT NULL,
  record_id INT NOT NULL,
  action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  change_request_id INT, -- Links to approval request
  changed_by INT NOT NULL,
  change_reason TEXT,
  effective_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (change_request_id) REFERENCES pricing_change_requests(id),
  FOREIGN KEY (changed_by) REFERENCES users(user_id),
  
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_changed_by (changed_by),
  INDEX idx_effective_date (effective_date),
  INDEX idx_created_at (created_at)
);

-- =====================================================
-- 4. SUPPLIER COST MONITORING & ALERTS
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
  
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (acknowledged_by) REFERENCES users(user_id),
  
  INDEX idx_status_type (status, alert_type),
  INDEX idx_created_at (created_at),
  INDEX idx_supplier (supplier_id)
);

-- =====================================================
-- 5. CHANNEL LETTER PRICING TABLES (FIRST PRODUCT CATEGORY)
-- =====================================================

-- Channel Letter Types and Base Pricing
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
  
  -- Small letter adjustments (Excel: 6-7" treated as 9")
  size_adjustment_rules JSON, -- Stores size adjustment logic
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_type_code (type_code),
  INDEX idx_active (is_active)
);

-- LED Types and Pricing (Excel: LED lookup tables)
CREATE TABLE led_types_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  led_type VARCHAR(100) NOT NULL,
  led_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  
  -- Technical specifications (Excel: LED specifications)
  wattage_per_foot DECIMAL(5,2),
  lumens_per_foot INT,
  color_temperature INT,
  cri_rating INT,
  
  -- Pricing (archetype - averaged across suppliers)
  cost_per_led DECIMAL(8,4) NOT NULL,
  cost_per_foot DECIMAL(8,4) NOT NULL,
  installation_cost_per_foot DECIMAL(8,4) DEFAULT 0,
  
  -- Excel formula integration
  led_calculation_rules JSON, -- Stores LED count calculation logic
  
  -- Supplier tracking
  primary_supplier_id INT,
  secondary_supplier_id INT,
  average_lead_time_days INT DEFAULT 7,
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (primary_supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (secondary_supplier_id) REFERENCES suppliers(id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_led_code (led_code),
  INDEX idx_active (is_active)
);

-- Transformer Types and Pricing (Excel: TF calculations)
CREATE TABLE transformer_types_pricing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  transformer_type VARCHAR(100) NOT NULL,
  transformer_code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  
  -- Technical specifications (Excel: TF specifications)
  wattage_capacity INT NOT NULL,
  voltage_input VARCHAR(20),
  voltage_output VARCHAR(20),
  dimming_compatible BOOLEAN DEFAULT false,
  ul_listed BOOLEAN DEFAULT true,
  
  -- Pricing (Excel: $/TF calculations)
  unit_cost DECIMAL(8,2) NOT NULL,
  installation_cost DECIMAL(8,2) DEFAULT 0,
  
  -- Excel formula integration
  transformer_sizing_rules JSON, -- Logic for TF count calculations
  
  -- Supplier tracking  
  primary_supplier_id INT,
  average_lead_time_days INT DEFAULT 14,
  
  -- Effective dating
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (primary_supplier_id) REFERENCES suppliers(id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_transformer_code (transformer_code),
  INDEX idx_active (is_active)
);

-- UL Listing Costs (Excel: UL Base+ and UL +sets)
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
  
  -- Audit fields
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_ul_code (ul_code),
  INDEX idx_active (is_active)
);

-- =====================================================
-- 6. SUPPLIER-SPECIFIC ITEM COSTS
-- =====================================================

-- This table tracks actual supplier costs for specific items
-- Used for supplier cost monitoring and archetype price calculation
CREATE TABLE supplier_item_costs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_id INT NOT NULL,
  item_type ENUM('CHANNEL_LETTER', 'LED', 'TRANSFORMER', 'UL_LISTING', 'MATERIAL', 'LABOR') NOT NULL,
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
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  
  INDEX idx_supplier_item (supplier_id, item_type, item_reference_id),
  INDEX idx_effective_date (effective_date, expires_date),
  INDEX idx_current (is_current)
);

-- =====================================================
-- 7. PRICING CALCULATION CACHE
-- =====================================================

-- Cache calculated archetype prices to avoid real-time calculation overhead
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
-- 8. SYSTEM CONFIGURATION
-- =====================================================

CREATE TABLE pricing_system_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  config_type ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') DEFAULT 'STRING',
  description TEXT,
  
  -- Change tracking
  updated_by INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

-- =====================================================
-- 9. CSV IMPORT TRACKING
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
-- 10. INITIAL SYSTEM CONFIGURATION
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
-- 11. AUDIT TRIGGERS (AUTOMATED LOGGING)
-- =====================================================

DELIMITER //

-- Channel Letter Types Audit Trigger
CREATE TRIGGER channel_letter_types_audit_insert 
AFTER INSERT ON channel_letter_types
FOR EACH ROW
BEGIN
  INSERT INTO pricing_audit_log (table_name, record_id, action, changed_by, change_reason, effective_date)
  VALUES ('channel_letter_types', NEW.id, 'INSERT', NEW.created_by, 'Record created', NEW.effective_date);
END//

CREATE TRIGGER channel_letter_types_audit_update
AFTER UPDATE ON channel_letter_types  
FOR EACH ROW
BEGIN
  IF OLD.base_rate_per_inch != NEW.base_rate_per_inch THEN
    INSERT INTO pricing_audit_log (table_name, record_id, action, field_name, old_value, new_value, changed_by, effective_date)
    VALUES ('channel_letter_types', NEW.id, 'UPDATE', 'base_rate_per_inch', OLD.base_rate_per_inch, NEW.base_rate_per_inch, NEW.created_by, NEW.effective_date);
  END IF;
  
  IF OLD.complexity_multiplier != NEW.complexity_multiplier THEN
    INSERT INTO pricing_audit_log (table_name, record_id, action, field_name, old_value, new_value, changed_by, effective_date)
    VALUES ('channel_letter_types', NEW.id, 'UPDATE', 'complexity_multiplier', OLD.complexity_multiplier, NEW.complexity_multiplier, NEW.created_by, NEW.effective_date);
  END IF;
END//

-- LED Types Audit Trigger  
CREATE TRIGGER led_types_pricing_audit_insert
AFTER INSERT ON led_types_pricing
FOR EACH ROW
BEGIN
  INSERT INTO pricing_audit_log (table_name, record_id, action, changed_by, change_reason, effective_date)
  VALUES ('led_types_pricing', NEW.id, 'INSERT', NEW.created_by, 'Record created', NEW.effective_date);
END//

CREATE TRIGGER led_types_pricing_audit_update
AFTER UPDATE ON led_types_pricing
FOR EACH ROW  
BEGIN
  IF OLD.cost_per_led != NEW.cost_per_led THEN
    INSERT INTO pricing_audit_log (table_name, record_id, action, field_name, old_value, new_value, changed_by, effective_date)
    VALUES ('led_types_pricing', NEW.id, 'UPDATE', 'cost_per_led', OLD.cost_per_led, NEW.cost_per_led, NEW.created_by, NEW.effective_date);
  END IF;
  
  IF OLD.cost_per_foot != NEW.cost_per_foot THEN
    INSERT INTO pricing_audit_log (table_name, record_id, action, field_name, old_value, new_value, changed_by, effective_date)
    VALUES ('led_types_pricing', NEW.id, 'UPDATE', 'cost_per_foot', OLD.cost_per_foot, NEW.cost_per_foot, NEW.created_by, NEW.effective_date);
  END IF;
END//

-- Transformer Types Audit Trigger
CREATE TRIGGER transformer_types_pricing_audit_insert
AFTER INSERT ON transformer_types_pricing
FOR EACH ROW
BEGIN
  INSERT INTO pricing_audit_log (table_name, record_id, action, changed_by, change_reason, effective_date)
  VALUES ('transformer_types_pricing', NEW.id, 'INSERT', NEW.created_by, 'Record created', NEW.effective_date);
END//

CREATE TRIGGER transformer_types_pricing_audit_update
AFTER UPDATE ON transformer_types_pricing
FOR EACH ROW
BEGIN
  IF OLD.unit_cost != NEW.unit_cost THEN
    INSERT INTO pricing_audit_log (table_name, record_id, action, field_name, old_value, new_value, changed_by, effective_date)
    VALUES ('transformer_types_pricing', NEW.id, 'UPDATE', 'unit_cost', OLD.unit_cost, NEW.unit_cost, NEW.created_by, NEW.effective_date);
  END IF;
END//

-- UL Listing Audit Trigger
CREATE TRIGGER ul_listing_pricing_audit_insert
AFTER INSERT ON ul_listing_pricing
FOR EACH ROW
BEGIN
  INSERT INTO pricing_audit_log (table_name, record_id, action, changed_by, change_reason, effective_date)
  VALUES ('ul_listing_pricing', NEW.id, 'INSERT', NEW.created_by, 'Record created', NEW.effective_date);
END//

CREATE TRIGGER ul_listing_pricing_audit_update
AFTER UPDATE ON ul_listing_pricing
FOR EACH ROW
BEGIN
  IF OLD.base_fee != NEW.base_fee THEN
    INSERT INTO pricing_audit_log (table_name, record_id, action, field_name, old_value, new_value, changed_by, effective_date)
    VALUES ('ul_listing_pricing', NEW.id, 'UPDATE', 'base_fee', OLD.base_fee, NEW.base_fee, NEW.created_by, NEW.effective_date);
  END IF;
  
  IF OLD.per_set_fee != NEW.per_set_fee THEN
    INSERT INTO pricing_audit_log (table_name, record_id, action, field_name, old_value, new_value, changed_by, effective_date)
    VALUES ('ul_listing_pricing', NEW.id, 'UPDATE', 'per_set_fee', OLD.per_set_fee, NEW.per_set_fee, NEW.created_by, NEW.effective_date);
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
    IF ABS(cost_change_percent) >= threshold_percent THEN
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
-- 12. SAMPLE DATA FOR TESTING
-- =====================================================

-- Sample Suppliers
INSERT INTO suppliers (supplier_name, supplier_code, contact_email, is_active, created_by) VALUES
('SignCraft Materials', 'SC001', 'orders@signcraft.com', true, 1),
('LED Solutions Inc', 'LED001', 'sales@ledsolutions.com', true, 1),
('UL Testing Services', 'UL001', 'pricing@ultesting.com', true, 1);

-- Sample Channel Letter Types (based on Excel formulas)
INSERT INTO channel_letter_types (
  type_name, type_code, description, min_size_inches, max_size_inches, 
  base_rate_per_inch, complexity_multiplier, size_adjustment_rules, 
  effective_date, created_by
) VALUES
('Standard Front Lit', 'FL_STD', 'Standard front-lit channel letters with LED face illumination', 3.0, 48.0, 12.50, 1.0, 
 '{"6_inch": 9.0, "7_inch": 9.0, "8_inch": 10.0, "9_inch": 10.0}', 
 CURDATE(), 1),
('Reverse Lit', 'RL_STD', 'Reverse-lit channel letters with LED back illumination', 4.0, 60.0, 15.75, 1.2, 
 '{"6_inch": 9.0, "7_inch": 9.0, "8_inch": 10.0, "9_inch": 10.0}', 
 CURDATE(), 1),
('Combination Lit', 'CL_STD', 'Front and reverse lit channel letters', 5.0, 48.0, 18.25, 1.4, 
 '{"6_inch": 9.0, "7_inch": 9.0, "8_inch": 10.0, "9_inch": 10.0}', 
 CURDATE(), 1);

-- Sample LED Types (based on Excel LED lookup table)
INSERT INTO led_types_pricing (
  led_type, led_code, description, wattage_per_foot, cost_per_led, cost_per_foot,
  primary_supplier_id, effective_date, created_by
) VALUES
('Standard White 3000K', 'LED_STD_3K', 'Standard efficiency white LEDs', 4.8, 0.35, 1.68, 2, CURDATE(), 1),
('High Output White 4000K', 'LED_HO_4K', 'High output commercial white LEDs', 7.2, 0.52, 2.50, 2, CURDATE(), 1),
('RGB Color Changing', 'LED_RGB', 'Full color RGB addressable LEDs', 12.0, 1.25, 6.00, 2, CURDATE(), 1);

-- Sample Transformer Types
INSERT INTO transformer_types_pricing (
  transformer_type, transformer_code, description, wattage_capacity, unit_cost,
  primary_supplier_id, effective_date, created_by
) VALUES
('60W Class 2', 'TF_60W', '60 watt Class 2 LED driver', 60, 45.00, 2, CURDATE(), 1),
('100W Dimmable', 'TF_100W_DIM', '100 watt dimmable LED driver', 100, 85.00, 2, CURDATE(), 1),
('150W High Power', 'TF_150W', '150 watt commercial LED driver', 150, 125.00, 2, CURDATE(), 1);

-- Sample UL Listing Pricing
INSERT INTO ul_listing_pricing (
  ul_type, ul_code, description, base_fee, per_set_fee, minimum_sets,
  effective_date, created_by
) VALUES
('Standard UL Listing', 'UL_STD', 'Standard UL 48 outdoor sign listing', 850.00, 45.00, 1, CURDATE(), 1),
('Expedited UL Listing', 'UL_EXP', 'Expedited UL processing (15 days)', 1200.00, 65.00, 1, CURDATE(), 1);

-- =====================================================
-- END OF PRICING MANAGEMENT SYSTEM SCHEMA
-- =====================================================