-- Job Estimation System - Fixed JSON
USE sign_manufacturing;

-- Job Estimates (main container)
CREATE TABLE job_estimates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  job_code VARCHAR(20) NOT NULL UNIQUE,
  customer_id INT,
  estimate_name VARCHAR(255),
  status ENUM('draft', 'sent', 'approved', 'ordered', 'archived') DEFAULT 'draft',
  
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  updated_by INT,
  
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL,
  INDEX idx_estimate_customer (customer_id),
  INDEX idx_estimate_code (job_code),
  INDEX idx_estimate_status (status)
);

-- Job Groups
CREATE TABLE job_estimate_groups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  estimate_id INT NOT NULL,
  group_name VARCHAR(255) NOT NULL,
  group_order INT DEFAULT 0,
  assembly_cost DECIMAL(10,2) DEFAULT 0,
  assembly_description VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (estimate_id) REFERENCES job_estimates(id) ON DELETE CASCADE,
  INDEX idx_group_estimate (estimate_id, group_order)
);

-- Product Types
CREATE TABLE product_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  default_unit VARCHAR(20) DEFAULT 'ea',
  input_template JSON,
  pricing_rules JSON,
  complexity_rules JSON,
  material_rules JSON,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_product_type_category (category, is_active)
);

-- Job Items
CREATE TABLE job_estimate_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  product_type_id INT NOT NULL,
  item_name VARCHAR(255),
  item_order INT DEFAULT 0,
  
  input_data JSON,
  
  complexity_score DECIMAL(8,4),
  base_quantity DECIMAL(10,3),
  unit_price DECIMAL(10,2),
  extended_price DECIMAL(10,2),
  labor_minutes INT,
  
  customer_description TEXT,
  internal_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (group_id) REFERENCES job_estimate_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (product_type_id) REFERENCES product_types(id),
  INDEX idx_item_group (group_id, item_order)
);

-- Add-on Types
CREATE TABLE addon_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  applicable_to JSON,
  input_template JSON,
  pricing_rules JSON,
  material_rules JSON,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_addon_category (category, is_active)
);

-- Job Item Add-ons
CREATE TABLE job_item_addons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  addon_type_id INT NOT NULL,
  addon_order INT DEFAULT 0,
  
  input_data JSON,
  
  quantity DECIMAL(10,3),
  unit_price DECIMAL(10,2),
  extended_price DECIMAL(10,2),
  
  customer_description TEXT,
  internal_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (item_id) REFERENCES job_estimate_items(id) ON DELETE CASCADE,
  FOREIGN KEY (addon_type_id) REFERENCES addon_types(id),
  INDEX idx_addon_item (item_id, addon_order)
);

-- Create view for estimate summaries (referenced in controller)
CREATE VIEW job_estimate_summary AS
SELECT 
  je.id,
  je.job_code,
  je.estimate_name,
  c.company_name as customer_name,
  je.status,
  je.subtotal,
  je.tax_amount,
  je.total_amount,
  COUNT(DISTINCT jeg.id) as group_count,
  COUNT(DISTINCT jei.id) as item_count,
  je.created_at,
  je.updated_at
FROM job_estimates je
LEFT JOIN customers c ON je.customer_id = c.customer_id
LEFT JOIN job_estimate_groups jeg ON je.id = jeg.estimate_id
LEFT JOIN job_estimate_items jei ON jeg.id = jei.group_id
GROUP BY je.id, je.job_code, je.estimate_name, c.company_name, 
         je.status, je.subtotal, je.tax_amount, je.total_amount,
         je.created_at, je.updated_at;

-- Insert sample data with fixed JSON
INSERT INTO product_types (name, category, default_unit, input_template, pricing_rules) VALUES
('Channel Letters - Front Lit', 'channel_letters', 'ea', 
  JSON_OBJECT(
    'fields', JSON_ARRAY(
      JSON_OBJECT('name', 'letter_data', 'type', 'textarea', 'label', 'Letter Analysis Data', 'required', true),
      JSON_OBJECT('name', 'return_depth', 'type', 'select', 'label', 'Return Depth', 'options', JSON_ARRAY('3in', '4in', '5in'), 'required', true),
      JSON_OBJECT('name', 'face_material', 'type', 'select', 'label', 'Face Material', 'options', JSON_ARRAY('White Polycarbonate', 'Clear Polycarbonate', 'Opal Acrylic'), 'required', true),
      JSON_OBJECT('name', 'return_color', 'type', 'select', 'label', 'Return Color', 'options', JSON_ARRAY('Black Anodized', 'Mill Finish', 'White', 'Custom'), 'required', true)
    )
  ),
  JSON_OBJECT(
    'base_rate_per_letter', 35.00,
    'depth_multipliers', JSON_OBJECT('3in', 1.0, '4in', 1.5, '5in', 2.5),
    'complexity_factor', 1.0,
    'minimum_charge', 150.00
  )
);

INSERT INTO addon_types (name, category, applicable_to, input_template, pricing_rules) VALUES
('Face Vinyl Application', 'finishing', JSON_ARRAY('Channel Letters - Front Lit'), 
  JSON_OBJECT(
    'fields', JSON_ARRAY(
      JSON_OBJECT('name', 'vinyl_color', 'type', 'text', 'label', 'Vinyl Color/Type', 'required', true),
      JSON_OBJECT('name', 'coverage_area', 'type', 'number', 'label', 'Coverage Area (sq ft)', 'required', true)
    )
  ),
  JSON_OBJECT(
    'rate_per_sqft', 4.50,
    'setup_fee', 25.00,
    'minimum_charge', 50.00
  )
),
('Return Painting', 'finishing', JSON_ARRAY('Channel Letters - Front Lit'),
  JSON_OBJECT(
    'fields', JSON_ARRAY(
      JSON_OBJECT('name', 'paint_color', 'type', 'text', 'label', 'Paint Color', 'required', true),
      JSON_OBJECT('name', 'letter_count', 'type', 'number', 'label', 'Number of Letters', 'required', true)
    )
  ),
  JSON_OBJECT(
    'rate_per_letter', 8.00,
    'setup_fee', 35.00,
    'minimum_charge', 75.00
  )
);