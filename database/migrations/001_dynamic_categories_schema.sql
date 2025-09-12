-- Enhanced Supply Chain: Dynamic Categories System
-- Phase 1: Foundation schema for flexible material categories and specifications
-- Created: 2025-01-17

-- Dynamic material categories (easy add/edit/remove)
CREATE TABLE material_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50), -- For UI icons (e.g., 'package', 'zap', 'layers')
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    FOREIGN KEY (updated_by) REFERENCES users(user_id),
    INDEX idx_active_sort (is_active, sort_order),
    INDEX idx_name (name)
);

-- Category field definitions (dynamic attributes)
CREATE TABLE category_fields (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_label VARCHAR(100) NOT NULL,
    field_type ENUM('text', 'number', 'decimal', 'select', 'boolean', 'date') NOT NULL,
    field_options JSON, -- For select dropdowns: ["option1", "option2"]
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    validation_rules JSON, -- Min/max, regex, etc: {"min": 0, "max": 100, "regex": "^[A-Z]+$"}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (category_id) REFERENCES material_categories(id) ON DELETE CASCADE,
    UNIQUE KEY unique_field_per_category (category_id, field_name),
    INDEX idx_category_sort (category_id, sort_order)
);

-- Product standards with dynamic specifications
CREATE TABLE product_standards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    supplier_id INT,
    supplier_part_number VARCHAR(100),
    current_price DECIMAL(10,4), -- More precision for pricing
    price_date DATE,
    minimum_order_qty DECIMAL(10,2) DEFAULT 1,
    reorder_point DECIMAL(10,2), -- Low stock threshold
    reorder_quantity DECIMAL(10,2), -- Suggested reorder amount
    specifications JSON, -- Dynamic specs based on category fields
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    
    FOREIGN KEY (category_id) REFERENCES material_categories(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    FOREIGN KEY (updated_by) REFERENCES users(user_id),
    INDEX idx_category_active (category_id, is_active),
    INDEX idx_supplier (supplier_id),
    INDEX idx_reorder_point (reorder_point),
    INDEX idx_name (name)
);

-- Enhanced supplier information for ordering workflow
ALTER TABLE suppliers ADD COLUMN (
    default_payment_terms VARCHAR(50) DEFAULT 'Net 30',
    default_shipping_method VARCHAR(50) DEFAULT 'Standard',
    minimum_order_amount DECIMAL(10,2),
    preferred_contact_email VARCHAR(255),
    order_email_template TEXT,
    lead_time_days INT DEFAULT 7
);

-- Inventory tracking for all material types (unified approach)
CREATE TABLE unified_inventory (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_standard_id INT NOT NULL,
    quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    reserved_quantity DECIMAL(10,3) DEFAULT 0, -- For job allocations
    location VARCHAR(100),
    batch_number VARCHAR(100), -- For quality tracking
    expiration_date DATE,
    purchase_date DATE,
    purchase_price DECIMAL(10,4),
    purchase_order_reference VARCHAR(100),
    notes TEXT,
    status ENUM('available', 'reserved', 'used', 'waste', 'returned', 'damaged') DEFAULT 'available',
    status_change_date DATE,
    status_change_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    
    FOREIGN KEY (product_standard_id) REFERENCES product_standards(id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    FOREIGN KEY (updated_by) REFERENCES users(user_id),
    INDEX idx_product_status (product_standard_id, status),
    INDEX idx_location (location),
    INDEX idx_expiration (expiration_date),
    INDEX idx_batch (batch_number)
);

-- Job material links (connects inventory to jobs)
CREATE TABLE job_material_links (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_id INT NOT NULL,
    inventory_id INT NOT NULL,
    quantity_used DECIMAL(10,3) NOT NULL,
    link_type ENUM('planned', 'allocated', 'used') DEFAULT 'planned',
    sequence_order INT DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    
    FOREIGN KEY (job_id) REFERENCES jobs(job_id),
    FOREIGN KEY (inventory_id) REFERENCES unified_inventory(id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_job (job_id),
    INDEX idx_inventory (inventory_id),
    INDEX idx_link_type (link_type)
);

-- Pre-populate with existing categories
INSERT INTO material_categories (name, description, icon, sort_order, is_active, created_by, updated_by) VALUES
('Vinyl', 'Adhesive vinyl materials for sign manufacturing', 'layers', 1, TRUE, 1, 1),
('LED', 'LED lighting components and modules', 'zap', 2, TRUE, 1, 1),
('Power Supply', 'Transformers and power supply units', 'battery', 3, TRUE, 1, 1);

-- Pre-populate category fields for Vinyl
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, sort_order) VALUES
(1, 'brand', 'Brand', 'text', TRUE, 1),
(1, 'series', 'Series', 'text', TRUE, 2),
(1, 'colour_number', 'Colour Number', 'text', FALSE, 3),
(1, 'colour_name', 'Colour Name', 'text', FALSE, 4),
(1, 'width', 'Width (inches)', 'decimal', TRUE, 5),
(1, 'finish', 'Finish Type', 'select', FALSE, 6);

-- Update finish field with options
UPDATE category_fields 
SET field_options = JSON_ARRAY('Gloss', 'Matte', 'Satin', 'Metallic', 'Reflective', 'Translucent')
WHERE field_name = 'finish' AND category_id = 1;

-- Pre-populate category fields for LED
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, sort_order) VALUES
(2, 'product_code', 'Product Code', 'text', TRUE, 1),
(2, 'brand', 'Brand', 'text', TRUE, 2),
(2, 'model', 'Model', 'text', FALSE, 3),
(2, 'watts', 'Watts', 'decimal', FALSE, 4),
(2, 'volts', 'Voltage', 'number', FALSE, 5),
(2, 'colour', 'Light Colour', 'select', FALSE, 6),
(2, 'lumens', 'Lumens', 'text', FALSE, 7),
(2, 'warranty', 'Warranty Period', 'text', FALSE, 8);

-- Update LED colour field with options
UPDATE category_fields 
SET field_options = JSON_ARRAY('Warm White', 'Cool White', 'Red', 'Green', 'Blue', 'Yellow', 'RGB')
WHERE field_name = 'colour' AND category_id = 2;

-- Pre-populate category fields for Power Supply
INSERT INTO category_fields (category_id, field_name, field_label, field_type, is_required, sort_order) VALUES
(3, 'transformer_type', 'Transformer Type', 'text', TRUE, 1),
(3, 'watts', 'Watts', 'number', TRUE, 2),
(3, 'rated_watts', 'Rated Watts', 'number', FALSE, 3),
(3, 'volts', 'Voltage', 'number', TRUE, 4),
(3, 'ul_listed', 'UL Listed', 'boolean', FALSE, 5),
(3, 'warranty_labour_years', 'Labour Warranty (Years)', 'number', FALSE, 6),
(3, 'warranty_product_years', 'Product Warranty (Years)', 'number', FALSE, 7);

-- Create view for low stock monitoring
CREATE VIEW low_stock_items AS
SELECT
    ps.id,
    ps.name,
    ps.category_id,
    mc.name as category_name,
    mc.icon as category_icon,
    ps.supplier_id,
    s.name as supplier_name,
    COALESCE(SUM(ui.quantity - ui.reserved_quantity), 0) as available_quantity,
    ps.reorder_point,
    ps.reorder_quantity,
    ps.current_price,
    ps.specifications,
    CASE
        WHEN COALESCE(SUM(ui.quantity - ui.reserved_quantity), 0) <= COALESCE(ps.reorder_point, 0) AND ps.reorder_point > 0 THEN 'critical'
        WHEN COALESCE(SUM(ui.quantity - ui.reserved_quantity), 0) <= COALESCE(ps.reorder_point, 0) * 1.5 AND ps.reorder_point > 0 THEN 'low'
        ELSE 'ok'
    END as stock_status,
    ps.updated_at
FROM product_standards ps
JOIN material_categories mc ON ps.category_id = mc.id
LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
LEFT JOIN unified_inventory ui ON ps.id = ui.product_standard_id AND ui.status = 'available'
WHERE ps.is_active = TRUE AND mc.is_active = TRUE
GROUP BY ps.id
ORDER BY 
    CASE 
        WHEN COALESCE(SUM(ui.quantity - ui.reserved_quantity), 0) <= COALESCE(ps.reorder_point, 0) AND ps.reorder_point > 0 THEN 1
        WHEN COALESCE(SUM(ui.quantity - ui.reserved_quantity), 0) <= COALESCE(ps.reorder_point, 0) * 1.5 AND ps.reorder_point > 0 THEN 2
        ELSE 3
    END,
    available_quantity ASC;

-- Audit trail for changes
INSERT INTO audit_trail (table_name, operation, changed_data, user_id) 
VALUES ('material_categories', 'CREATE_TABLE', 'Dynamic categories system initialized', 1);