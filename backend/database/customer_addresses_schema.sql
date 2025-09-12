-- Customer Addresses and Tax System Schema
-- Enhanced multi-address support with tax calculation system

USE sign_manufacturing;

-- Province/State Tax Rules Table
DROP TABLE IF EXISTS tax_rules;
CREATE TABLE tax_rules (
    tax_rule_id INT PRIMARY KEY AUTO_INCREMENT,
    province_state_code VARCHAR(10) NOT NULL UNIQUE,
    province_state_name VARCHAR(100),
    country VARCHAR(50) DEFAULT 'Canada',
    tax_type VARCHAR(50) NOT NULL,
    tax_percent DECIMAL(5,3) NOT NULL DEFAULT 0.000,
    effective_date DATE DEFAULT (CURDATE()),
    expiration_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    notes TEXT,
    
    INDEX idx_province_code (province_state_code),
    INDEX idx_tax_type (tax_type),
    INDEX idx_active (is_active)
);

-- Tax Rules History for tracking tax rate changes
CREATE TABLE tax_rules_history (
    history_id INT PRIMARY KEY AUTO_INCREMENT,
    tax_rule_id INT NOT NULL,
    old_tax_percent DECIMAL(5,3),
    new_tax_percent DECIMAL(5,3),
    old_tax_type VARCHAR(50),
    new_tax_type VARCHAR(50),
    change_reason VARCHAR(500),
    effective_date DATE NOT NULL,
    changed_by VARCHAR(100),
    changed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tax_rule_id) REFERENCES tax_rules(tax_rule_id),
    INDEX idx_tax_rule_id (tax_rule_id),
    INDEX idx_effective_date (effective_date)
);

-- Customer Addresses Table
DROP TABLE IF EXISTS customer_addresses;
CREATE TABLE customer_addresses (
    address_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    customer_address_sequence INT NOT NULL, -- Sequential per customer (1, 2, 3...)
    
    -- Address Type Flags (one address can be multiple types)
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
    tax_override_percent DECIMAL(5,3), -- Override province tax if needed
    tax_override_reason VARCHAR(255),
    use_province_tax BOOLEAN DEFAULT TRUE,
    
    -- Address Status and Preferences
    is_active BOOLEAN DEFAULT TRUE,
    address_verified BOOLEAN DEFAULT FALSE,
    verification_date DATE,
    
    -- Contact Information (if different from main customer)
    contact_name VARCHAR(200),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    
    -- Special Instructions
    delivery_instructions TEXT,
    access_instructions TEXT,
    comments TEXT,
    
    -- Audit Information
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    
    -- Foreign Keys and Constraints
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (province_state_short) REFERENCES tax_rules(province_state_code),
    
    -- Unique constraint for customer address sequence
    UNIQUE KEY unique_customer_address_seq (customer_id, customer_address_sequence),
    
    -- Indexes for performance
    INDEX idx_customer_id (customer_id),
    INDEX idx_primary (is_primary),
    INDEX idx_billing (is_billing), 
    INDEX idx_shipping (is_shipping),
    INDEX idx_jobsite (is_jobsite),
    INDEX idx_mailing (is_mailing),
    INDEX idx_province_state (province_state_short),
    INDEX idx_active (is_active),
    INDEX idx_created_date (created_date)
);

-- Address History Table for tracking changes
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
    ip_address VARCHAR(45),
    
    FOREIGN KEY (address_id) REFERENCES customer_addresses(address_id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    INDEX idx_address_id (address_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_changed_date (changed_date),
    INDEX idx_field_name (field_name)
);

-- Trigger to ensure only one primary address per customer
DELIMITER //
CREATE TRIGGER ensure_single_primary_address
    BEFORE INSERT ON customer_addresses
    FOR EACH ROW
BEGIN
    IF NEW.is_primary = TRUE THEN
        UPDATE customer_addresses 
        SET is_primary = FALSE 
        WHERE customer_id = NEW.customer_id AND is_primary = TRUE;
    END IF;
END//

CREATE TRIGGER ensure_single_primary_address_update
    BEFORE UPDATE ON customer_addresses
    FOR EACH ROW
BEGIN
    IF NEW.is_primary = TRUE AND OLD.is_primary = FALSE THEN
        UPDATE customer_addresses 
        SET is_primary = FALSE 
        WHERE customer_id = NEW.customer_id AND address_id != NEW.address_id AND is_primary = TRUE;
    END IF;
END//

-- Trigger to auto-set customer_address_sequence
CREATE TRIGGER set_customer_address_sequence
    BEFORE INSERT ON customer_addresses
    FOR EACH ROW
BEGIN
    DECLARE max_seq INT DEFAULT 0;
    
    SELECT COALESCE(MAX(customer_address_sequence), 0) INTO max_seq
    FROM customer_addresses
    WHERE customer_id = NEW.customer_id;
    
    SET NEW.customer_address_sequence = max_seq + 1;
END//

-- Trigger to log address changes
CREATE TRIGGER customer_address_audit_trigger
    AFTER UPDATE ON customer_addresses
    FOR EACH ROW
BEGIN
    -- Track address line changes
    IF OLD.address_line1 != NEW.address_line1 THEN
        INSERT INTO customer_addresses_history (address_id, customer_id, field_name, old_value, new_value, change_type, changed_by)
        VALUES (NEW.address_id, NEW.customer_id, 'address_line1', OLD.address_line1, NEW.address_line1, 'update', NEW.updated_by);
    END IF;
    
    -- Track city changes
    IF OLD.city != NEW.city THEN
        INSERT INTO customer_addresses_history (address_id, customer_id, field_name, old_value, new_value, change_type, changed_by)
        VALUES (NEW.address_id, NEW.customer_id, 'city', OLD.city, NEW.city, 'update', NEW.updated_by);
    END IF;
    
    -- Track province changes (important for tax calculations)
    IF OLD.province_state_short != NEW.province_state_short THEN
        INSERT INTO customer_addresses_history (address_id, customer_id, field_name, old_value, new_value, change_type, changed_by, change_reason)
        VALUES (NEW.address_id, NEW.customer_id, 'province_state_short', OLD.province_state_short, NEW.province_state_short, 'update', NEW.updated_by, 'Province change - may affect tax calculation');
    END IF;
    
    -- Track primary address changes
    IF OLD.is_primary != NEW.is_primary THEN
        INSERT INTO customer_addresses_history (address_id, customer_id, field_name, old_value, new_value, change_type, changed_by)
        VALUES (NEW.address_id, NEW.customer_id, 'is_primary', OLD.is_primary, NEW.is_primary, 'update', NEW.updated_by);
    END IF;
    
    -- Track billing address changes
    IF OLD.is_billing != NEW.is_billing THEN
        INSERT INTO customer_addresses_history (address_id, customer_id, field_name, old_value, new_value, change_type, changed_by)
        VALUES (NEW.address_id, NEW.customer_id, 'is_billing', OLD.is_billing, NEW.is_billing, 'update', NEW.updated_by);
    END IF;
    
    -- Track shipping address changes  
    IF OLD.is_shipping != NEW.is_shipping THEN
        INSERT INTO customer_addresses_history (address_id, customer_id, field_name, old_value, new_value, change_type, changed_by)
        VALUES (NEW.address_id, NEW.customer_id, 'is_shipping', OLD.is_shipping, NEW.is_shipping, 'update', NEW.updated_by);
    END IF;
    
    -- Track tax override changes
    IF COALESCE(OLD.tax_override_percent, 0) != COALESCE(NEW.tax_override_percent, 0) THEN
        INSERT INTO customer_addresses_history (address_id, customer_id, field_name, old_value, new_value, change_type, changed_by, change_reason)
        VALUES (NEW.address_id, NEW.customer_id, 'tax_override_percent', OLD.tax_override_percent, NEW.tax_override_percent, 'update', NEW.updated_by, NEW.tax_override_reason);
    END IF;
END//

-- Trigger for address creation logging
CREATE TRIGGER customer_address_create_trigger
    AFTER INSERT ON customer_addresses
    FOR EACH ROW
BEGIN
    INSERT INTO customer_addresses_history (address_id, customer_id, field_name, old_value, new_value, change_type, changed_by)
    VALUES (NEW.address_id, NEW.customer_id, 'address_record', NULL, 'Address created', 'create', NEW.created_by);
END//

DELIMITER ;

-- Useful Views for Address Management

-- View for customer addresses with tax information
CREATE VIEW customer_addresses_with_tax AS
SELECT 
    ca.address_id,
    ca.customer_id,
    c.company_name,
    ca.customer_address_sequence,
    ca.is_primary,
    ca.is_billing,
    ca.is_shipping,
    ca.is_jobsite,
    ca.is_mailing,
    ca.address_line1,
    ca.address_line2,
    ca.city,
    ca.province_state_short,
    ca.postal_zip,
    ca.is_primary,
    ca.is_active,
    -- Tax calculation logic
    CASE 
        WHEN ca.tax_override_percent IS NOT NULL THEN ca.tax_override_percent
        ELSE tr.tax_percent 
    END as applicable_tax_percent,
    CASE 
        WHEN ca.tax_override_percent IS NOT NULL THEN 'Override'
        ELSE tr.tax_type 
    END as tax_source,
    tr.tax_type as province_tax_type,
    tr.tax_percent as province_tax_percent,
    ca.tax_override_reason,
    ca.delivery_instructions,
    ca.comments
FROM customer_addresses ca
JOIN customers c ON ca.customer_id = c.customer_id
LEFT JOIN tax_rules tr ON ca.province_state_short = tr.province_state_code AND tr.is_active = TRUE
WHERE ca.is_active = TRUE
ORDER BY c.company_name, ca.customer_address_sequence;

-- View for primary addresses only
CREATE VIEW customer_primary_addresses AS
SELECT 
    ca.customer_id,
    c.company_name,
    ca.address_line1,
    ca.address_line2,
    ca.city,
    ca.province_state_short,
    ca.postal_zip,
    CASE 
        WHEN ca.tax_override_percent IS NOT NULL THEN ca.tax_override_percent
        ELSE tr.tax_percent 
    END as tax_percent,
    tr.tax_type
FROM customer_addresses ca
JOIN customers c ON ca.customer_id = c.customer_id
LEFT JOIN tax_rules tr ON ca.province_state_short = tr.province_state_code AND tr.is_active = TRUE
WHERE ca.is_primary = TRUE AND ca.is_active = TRUE
ORDER BY c.company_name;

-- View for customers missing primary addresses
CREATE VIEW customers_without_primary_address AS
SELECT 
    c.customer_id,
    c.company_name,
    COUNT(ca.address_id) as total_addresses
FROM customers c
LEFT JOIN customer_addresses ca ON c.customer_id = ca.customer_id AND ca.is_active = TRUE
WHERE c.active = TRUE
AND NOT EXISTS (
    SELECT 1 FROM customer_addresses ca2 
    WHERE ca2.customer_id = c.customer_id 
    AND ca2.is_primary = TRUE 
    AND ca2.is_active = TRUE
)
GROUP BY c.customer_id, c.company_name
ORDER BY c.company_name;

-- View for tax rate changes history
CREATE VIEW tax_changes_summary AS
SELECT 
    tr.province_state_code,
    tr.tax_type,
    tr.tax_percent as current_rate,
    COUNT(trh.history_id) as change_count,
    MAX(trh.effective_date) as last_change_date,
    MAX(trh.changed_by) as last_changed_by
FROM tax_rules tr
LEFT JOIN tax_rules_history trh ON tr.tax_rule_id = trh.tax_rule_id
WHERE tr.is_active = TRUE
GROUP BY tr.tax_rule_id, tr.province_state_code, tr.tax_type, tr.tax_percent
ORDER BY tr.province_state_code;

COMMIT;