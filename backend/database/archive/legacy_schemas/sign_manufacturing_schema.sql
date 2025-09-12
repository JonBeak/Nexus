-- Sign Manufacturing Database Schema
-- Comprehensive database design for sign manufacturing business

DROP DATABASE IF EXISTS sign_manufacturing;
CREATE DATABASE sign_manufacturing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sign_manufacturing;

-- Customers table with material/color preferences
CREATE TABLE customers (
    customer_id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(255) NOT NULL,
    contact_first_name VARCHAR(100),
    contact_last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    preferred_materials TEXT,
    preferred_colors TEXT,
    special_instructions TEXT,
    payment_terms VARCHAR(50),
    tax_exempt BOOLEAN DEFAULT FALSE,
    tax_id VARCHAR(50),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    INDEX idx_company_name (company_name),
    INDEX idx_email (email),
    INDEX idx_phone (phone)
);

-- Materials/Stock inventory
CREATE TABLE materials (
    material_id INT PRIMARY KEY AUTO_INCREMENT,
    material_type ENUM('vinyl', 'substrate', 'hardware', 'ink', 'other') NOT NULL,
    material_name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    color VARCHAR(100),
    size_width DECIMAL(10,2),
    size_height DECIMAL(10,2),
    thickness DECIMAL(10,3),
    finish VARCHAR(100),
    specifications TEXT,
    unit_of_measure VARCHAR(20) DEFAULT 'sqft',
    cost_per_unit DECIMAL(10,4),
    current_stock DECIMAL(10,2) DEFAULT 0,
    minimum_stock DECIMAL(10,2) DEFAULT 0,
    reorder_point DECIMAL(10,2) DEFAULT 0,
    preferred_supplier_id INT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    INDEX idx_material_type (material_type),
    INDEX idx_material_name (material_name),
    INDEX idx_current_stock (current_stock),
    INDEX idx_reorder_point (reorder_point)
);

-- Suppliers
CREATE TABLE suppliers (
    supplier_id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(200),
    email VARCHAR(255),
    phone VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    payment_terms VARCHAR(100),
    lead_time_days INT DEFAULT 7,
    minimum_order DECIMAL(10,2),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    INDEX idx_company_name (company_name),
    INDEX idx_email (email)
);

-- Add foreign key for materials table
ALTER TABLE materials ADD CONSTRAINT fk_materials_supplier 
    FOREIGN KEY (preferred_supplier_id) REFERENCES suppliers(supplier_id);

-- Jobs table (both current and past)
CREATE TABLE jobs (
    job_id INT PRIMARY KEY AUTO_INCREMENT,
    job_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    job_description TEXT,
    job_type ENUM('signs', 'vinyl_graphics', 'banners', 'vehicle_graphics', 'other') DEFAULT 'signs',
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    depth DECIMAL(10,2),
    square_footage DECIMAL(10,2),
    quantity INT DEFAULT 1,
    job_status ENUM('estimate', 'approved', 'in_production', 'ready_for_pickup', 'completed', 'cancelled', 'on_hold') DEFAULT 'estimate',
    estimated_price DECIMAL(10,2),
    actual_price DECIMAL(10,2),
    estimated_hours DECIMAL(8,2),
    actual_hours DECIMAL(8,2),
    estimated_completion DATE,
    actual_completion DATE,
    special_instructions TEXT,
    folder_path VARCHAR(500),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    INDEX idx_job_number (job_number),
    INDEX idx_customer_id (customer_id),
    INDEX idx_job_status (job_status),
    INDEX idx_created_date (created_date),
    INDEX idx_estimated_completion (estimated_completion)
);

-- System configuration table
CREATE TABLE system_config (
    config_id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    config_description VARCHAR(255),
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(100)
);

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value, config_description) VALUES
('company_name', 'Your Sign Company', 'Company name for documents and communications'),
('company_address', '', 'Company address for invoices and communications'),
('company_phone', '', 'Company phone number'),
('company_email', '', 'Company email address'),
('job_file_base_path', '/mnt/job-files/Orders', 'Base path for job file storage'),
('backup_retention_daily', '30', 'Days to retain daily backups'),
('backup_retention_weekly', '12', 'Weeks to retain weekly backups'),
('backup_retention_monthly', '24', 'Months to retain monthly backups'),
('smtp_server', '', 'SMTP server for email'),
('smtp_port', '587', 'SMTP port'),
('smtp_username', '', 'SMTP username'),
('smtp_password', '', 'SMTP password (encrypted)'),
('quickbooks_integration', 'enabled', 'QuickBooks integration status');

COMMIT;