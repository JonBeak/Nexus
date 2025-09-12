-- Simplified Customer Addresses and Tax System Schema
USE sign_manufacturing;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS customer_addresses_history;
DROP TABLE IF EXISTS customer_addresses;
DROP TABLE IF EXISTS tax_rules_history;
DROP TABLE IF EXISTS tax_rules;

-- Province/State Tax Rules Table
CREATE TABLE tax_rules (
    tax_rule_id INT PRIMARY KEY AUTO_INCREMENT,
    province_state_code VARCHAR(10) NOT NULL UNIQUE,
    province_state_name VARCHAR(100),
    country VARCHAR(50) DEFAULT 'Canada',
    tax_type VARCHAR(50) NOT NULL,
    tax_percent DECIMAL(5,3) NOT NULL DEFAULT 0.000,
    effective_date DATE DEFAULT (CURDATE()),
    is_active BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    
    INDEX idx_province_code (province_state_code),
    INDEX idx_tax_type (tax_type),
    INDEX idx_active (is_active)
);

-- Customer Addresses Table
CREATE TABLE customer_addresses (
    address_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    customer_address_sequence INT NOT NULL,
    
    -- Address Type Flags
    is_primary BOOLEAN DEFAULT FALSE,
    is_billing BOOLEAN DEFAULT FALSE,
    is_shipping BOOLEAN DEFAULT TRUE,
    is_jobsite BOOLEAN DEFAULT FALSE,
    is_mailing BOOLEAN DEFAULT FALSE,
    
    -- Address Information
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    province_state_long VARCHAR(100),
    province_state_short VARCHAR(10) NOT NULL,
    postal_zip VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Canada',
    
    -- Tax Information
    tax_override_percent DECIMAL(5,3),
    tax_override_reason VARCHAR(255),
    use_province_tax BOOLEAN DEFAULT TRUE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Additional Info
    comments TEXT,
    
    -- Audit Information
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    
    -- Foreign Keys and Constraints
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    
    -- Unique constraint for customer address sequence
    UNIQUE KEY unique_customer_address_seq (customer_id, customer_address_sequence),
    
    -- Indexes
    INDEX idx_customer_id (customer_id),
    INDEX idx_primary (is_primary),
    INDEX idx_billing (is_billing),
    INDEX idx_shipping (is_shipping),
    INDEX idx_province_state (province_state_short),
    INDEX idx_active (is_active)
);

-- Address History Table
CREATE TABLE customer_addresses_history (
    history_id INT PRIMARY KEY AUTO_INCREMENT,
    address_id INT NOT NULL,
    customer_id INT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_reason VARCHAR(500),
    change_type ENUM('create', 'update', 'delete', 'restore') DEFAULT 'update',
    changed_by VARCHAR(100),
    changed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (address_id) REFERENCES customer_addresses(address_id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    INDEX idx_address_id (address_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_changed_date (changed_date)
);

-- Simple views
CREATE VIEW customer_addresses_with_tax AS
SELECT 
    ca.address_id,
    ca.customer_id,
    c.company_name,
    ca.customer_address_sequence,
    ca.is_primary,
    ca.is_billing,
    ca.is_shipping,
    ca.address_line1,
    ca.address_line2,
    ca.city,
    ca.province_state_short,
    ca.postal_zip,
    ca.is_active,
    CASE 
        WHEN ca.tax_override_percent IS NOT NULL THEN ca.tax_override_percent
        ELSE COALESCE(tr.tax_percent, 0)
    END as applicable_tax_percent,
    COALESCE(tr.tax_type, 'Unknown') as tax_type,
    ca.comments
FROM customer_addresses ca
JOIN customers c ON ca.customer_id = c.customer_id
LEFT JOIN tax_rules tr ON ca.province_state_short = tr.province_state_code AND tr.is_active = TRUE
WHERE ca.is_active = TRUE
ORDER BY c.company_name, ca.customer_address_sequence;

COMMIT;