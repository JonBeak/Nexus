-- Supply Chain Management System - Phase 1
-- Dynamic Categories and Product Standards
-- Created: 2025-01-29

USE sign_manufacturing;

-- Material Categories (dynamic, manager-configurable)
CREATE TABLE material_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'Package',
  color VARCHAR(20) DEFAULT 'purple',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  
  INDEX idx_active_categories (is_active, sort_order),
  INDEX idx_category_name (name)
);

-- Category Field Definitions (dynamic attributes per category)
CREATE TABLE category_fields (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(100) NOT NULL,
  field_type ENUM('text', 'number', 'decimal', 'select', 'boolean', 'date', 'textarea') NOT NULL,
  field_options JSON, -- For select dropdowns: ["option1", "option2"]
  default_value VARCHAR(255),
  is_required BOOLEAN DEFAULT FALSE,
  validation_rules JSON, -- {"min": 0, "max": 100, "regex": "pattern"}
  help_text VARCHAR(255),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (category_id) REFERENCES material_categories(id) ON DELETE CASCADE,
  UNIQUE KEY unique_category_field (category_id, field_name),
  INDEX idx_category_fields (category_id, is_active, sort_order)
);

-- Enhanced Product Standards with dynamic specifications
CREATE TABLE product_standards (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  supplier_id INT,
  supplier_part_number VARCHAR(100),
  current_price DECIMAL(10,2),
  price_date DATE,
  price_currency VARCHAR(3) DEFAULT 'CAD',
  minimum_order_qty DECIMAL(10,2) DEFAULT 1,
  unit_of_measure VARCHAR(20) DEFAULT 'each',
  reorder_point DECIMAL(10,2), -- Low stock threshold
  reorder_quantity DECIMAL(10,2), -- Suggested reorder amount
  lead_time_days INT DEFAULT 7,
  specifications JSON, -- Dynamic specs based on category fields
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  
  FOREIGN KEY (category_id) REFERENCES material_categories(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
  INDEX idx_product_category (category_id, is_active),
  INDEX idx_product_supplier (supplier_id),
  INDEX idx_product_name (name),
  INDEX idx_reorder_point (reorder_point),
  FULLTEXT INDEX idx_product_search (name, description, notes)
);

-- Unified Inventory (replaces category-specific inventories over time)
CREATE TABLE inventory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_standard_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  reserved_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  available_quantity DECIMAL(10,2) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  location VARCHAR(100),
  lot_number VARCHAR(50),
  serial_number VARCHAR(100),
  received_date DATE,
  expiry_date DATE,
  cost_per_unit DECIMAL(10,4),
  supplier_order_id INT, -- Link back to purchase order
  condition_status ENUM('new', 'used', 'damaged', 'returned') DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  
  FOREIGN KEY (product_standard_id) REFERENCES product_standards(id),
  INDEX idx_inventory_product (product_standard_id),
  INDEX idx_inventory_location (location),
  INDEX idx_inventory_available (available_quantity),
  INDEX idx_inventory_expiry (expiry_date)
);

-- Job Material Requirements (enhanced from existing vinyl_job_links)
CREATE TABLE job_materials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  job_id INT NOT NULL,
  product_standard_id INT NOT NULL,
  quantity_required DECIMAL(10,2) NOT NULL,
  quantity_allocated DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity_used DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('planned', 'allocated', 'partial', 'fulfilled') DEFAULT 'planned',
  priority_level ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  required_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY (product_standard_id) REFERENCES product_standards(id),
  INDEX idx_job_materials (job_id),
  INDEX idx_material_status (status),
  INDEX idx_required_date (required_date)
);

-- Inventory Allocations (job reservations)
CREATE TABLE inventory_allocations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  inventory_id INT NOT NULL,
  job_material_id INT NOT NULL,
  quantity_allocated DECIMAL(10,2) NOT NULL,
  allocation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('reserved', 'used', 'released') DEFAULT 'reserved',
  notes TEXT,
  created_by INT REFERENCES users(id),
  
  FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
  FOREIGN KEY (job_material_id) REFERENCES job_materials(id) ON DELETE CASCADE,
  INDEX idx_allocation_inventory (inventory_id),
  INDEX idx_allocation_job_material (job_material_id),
  INDEX idx_allocation_status (status)
);

-- Insert default categories to get started
INSERT INTO material_categories (name, description, icon, color, sort_order, created_by) VALUES
('Substrates', 'Sign substrate materials (aluminum, acrylic, etc.)', 'Layers', 'blue', 1, 1),
('Vinyl', 'Vinyl films and graphics materials', 'Palette', 'purple', 2, 1),
('Hardware', 'Mounting hardware, screws, brackets', 'Wrench', 'gray', 3, 1),
('LEDs', 'LED modules and lighting components', 'Lightbulb', 'yellow', 4, 1),
('Power Supplies', 'Transformers and power components', 'Zap', 'orange', 5, 1),
('Tape & Adhesives', 'Double-sided tape, VHB, adhesives', 'Paperclip', 'green', 6, 1),
('Consumables', 'General consumable materials', 'Package', 'red', 7, 1);

-- Insert common field definitions for substrate category
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, sort_order) VALUES
-- Substrates
(1, 'material', 'Material Type', 'select', TRUE, 1),
(1, 'thickness', 'Thickness (mm)', 'decimal', TRUE, 2),
(1, 'width', 'Width (inches)', 'decimal', TRUE, 3),
(1, 'length', 'Length (inches)', 'decimal', TRUE, 4),
(1, 'color', 'Color', 'text', FALSE, 5),
(1, 'finish', 'Finish', 'select', FALSE, 6),

-- Hardware
(3, 'material', 'Material', 'select', TRUE, 1),
(3, 'size', 'Size', 'text', TRUE, 2),
(3, 'thread_type', 'Thread Type', 'text', FALSE, 3),
(3, 'finish', 'Finish', 'select', FALSE, 4),

-- Tape & Adhesives  
(6, 'adhesive_type', 'Adhesive Type', 'select', TRUE, 1),
(6, 'thickness', 'Thickness (mil)', 'decimal', FALSE, 2),
(6, 'width', 'Width (inches)', 'decimal', TRUE, 3),
(6, 'length', 'Length (feet)', 'decimal', FALSE, 4),
(6, 'temperature_rating', 'Temperature Rating', 'text', FALSE, 5),

-- Consumables
(7, 'type', 'Type', 'select', TRUE, 1),
(7, 'size', 'Size/Quantity', 'text', FALSE, 2),
(7, 'color', 'Color', 'text', FALSE, 3);

-- Update field options for select fields
UPDATE category_fields SET field_options = JSON_ARRAY('Aluminum', 'Acrylic', 'Polycarbonate', 'Dibond', 'ACM', 'PVC', 'HDU', 'Wood') 
WHERE field_name = 'material' AND category_id = 1;

UPDATE category_fields SET field_options = JSON_ARRAY('Mill', 'Brushed', 'Anodized', 'Painted', 'Clear Coat') 
WHERE field_name = 'finish' AND category_id = 1;

UPDATE category_fields SET field_options = JSON_ARRAY('Stainless Steel', 'Aluminum', 'Brass', 'Plastic', 'Steel') 
WHERE field_name = 'material' AND category_id = 3;

UPDATE category_fields SET field_options = JSON_ARRAY('Zinc', 'Stainless', 'Black Oxide', 'Clear Coat', 'Anodized') 
WHERE field_name = 'finish' AND category_id = 3;

UPDATE category_fields SET field_options = JSON_ARRAY('Acrylic', 'VHB', 'Foam', 'Transfer', 'Structural') 
WHERE field_name = 'adhesive_type' AND category_id = 6;

UPDATE category_fields SET field_options = JSON_ARRAY('Cleaning', 'Tools', 'Safety', 'Office', 'Packaging') 
WHERE field_name = 'type' AND category_id = 7;

-- Create view for low stock monitoring
CREATE VIEW low_stock_items AS
SELECT 
  ps.id,
  ps.name,
  ps.category_id,
  mc.name as category_name,
  ps.supplier_id,
  s.name as supplier_name,
  COALESCE(SUM(i.available_quantity), 0) as available_quantity,
  ps.reorder_point,
  ps.reorder_quantity,
  ps.current_price,
  ps.unit_of_measure,
  CASE 
    WHEN ps.reorder_point IS NULL THEN 'unknown'
    WHEN COALESCE(SUM(i.available_quantity), 0) = 0 THEN 'out_of_stock'
    WHEN COALESCE(SUM(i.available_quantity), 0) <= ps.reorder_point THEN 'critical'
    WHEN COALESCE(SUM(i.available_quantity), 0) <= ps.reorder_point * 1.5 THEN 'low'
    ELSE 'ok'
  END as stock_status,
  ps.updated_at as last_updated
FROM product_standards ps
JOIN material_categories mc ON ps.category_id = mc.id
LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
LEFT JOIN inventory i ON ps.id = i.product_standard_id
WHERE ps.is_active = TRUE AND mc.is_active = TRUE
GROUP BY ps.id, ps.name, ps.category_id, mc.name, ps.supplier_id, s.name, 
         ps.reorder_point, ps.reorder_quantity, ps.current_price, ps.unit_of_measure, ps.updated_at
ORDER BY 
  CASE 
    WHEN COALESCE(SUM(i.available_quantity), 0) = 0 THEN 1
    WHEN COALESCE(SUM(i.available_quantity), 0) <= ps.reorder_point THEN 2
    WHEN COALESCE(SUM(i.available_quantity), 0) <= ps.reorder_point * 1.5 THEN 3
    ELSE 4
  END,
  mc.sort_order,
  ps.name;