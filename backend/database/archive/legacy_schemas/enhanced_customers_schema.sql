-- Enhanced Customers Schema
-- Incorporates existing structure + history tracking + business enhancements

USE sign_manufacturing;

-- Drop and recreate customers table with enhanced structure
DROP TABLE IF EXISTS customers;
CREATE TABLE customers (
    customer_id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(255) NOT NULL UNIQUE,
    quickbooks_name VARCHAR(255),
    quickbooks_name_search VARCHAR(255),
    
    -- Contact Information
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
    
    -- Tax and Payment Information
    tax_type VARCHAR(255),
    tax_id VARCHAR(255),
    payment_terms VARCHAR(50),
    tax_exempt BOOLEAN DEFAULT FALSE,
    discount DECIMAL(10,5) DEFAULT 0.00000,
    cash_yes_or_no TINYINT DEFAULT 0,
    
    -- Sign Manufacturing Preferences
    default_turnaround INT DEFAULT 10,
    
    -- LED Preferences
    leds_yes_or_no TINYINT DEFAULT 1,
    leds_default_type VARCHAR(255),
    wire_length INT DEFAULT 5,
    
    -- Power Supply Preferences
    powersupply_yes_or_no TINYINT DEFAULT 1,
    powersupply_default_type VARCHAR(255) DEFAULT 'Speedbox (default)',
    
    -- Manufacturing Options
    ul_yes_or_no TINYINT DEFAULT 1,
    drain_holes_yes_or_no TINYINT DEFAULT 1,
    pattern_yes_or_no TINYINT DEFAULT 1,
    pattern_type VARCHAR(255) DEFAULT 'Paper',
    wiring_diagram_yes_or_no TINYINT DEFAULT 1,
    wiring_diagram_type VARCHAR(255) DEFAULT 'Paper',
    plug_n_play_yes_or_no TINYINT DEFAULT 0,
    
    -- Shipping Preferences
    shipping_yes_or_no TINYINT DEFAULT 0,
    shipping_multiplier DECIMAL(10,5) DEFAULT 1.50000,
    shipping_flat INT,
    
    -- Additional Information
    comments TEXT,
    special_instructions TEXT,
    
    -- Audit and Tracking
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    
    -- Indexes for performance
    INDEX idx_company_name (company_name),
    INDEX idx_quickbooks_name (quickbooks_name),
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_active (active),
    INDEX idx_created_date (created_date)
);

-- Customer History Table for tracking all changes
CREATE TABLE customer_history (
    history_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_reason VARCHAR(500),
    change_type ENUM('create', 'update', 'delete', 'restore') DEFAULT 'update',
    changed_by VARCHAR(100),
    changed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    INDEX idx_customer_id (customer_id),
    INDEX idx_changed_date (changed_date),
    INDEX idx_changed_by (changed_by),
    INDEX idx_field_name (field_name)
);

-- Customer Pricing History
CREATE TABLE customer_pricing_history (
    pricing_history_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    discount_old DECIMAL(10,5),
    discount_new DECIMAL(10,5),
    shipping_multiplier_old DECIMAL(10,5),
    shipping_multiplier_new DECIMAL(10,5),
    change_reason VARCHAR(500) NOT NULL,
    effective_date DATE NOT NULL,
    expiration_date DATE,
    changed_by VARCHAR(100),
    changed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by VARCHAR(100),
    
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    INDEX idx_customer_id (customer_id),
    INDEX idx_effective_date (effective_date),
    INDEX idx_changed_date (changed_date)
);

-- Customer Preferences Snapshots (for major preference changes)
CREATE TABLE customer_preference_snapshots (
    snapshot_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    snapshot_name VARCHAR(255) NOT NULL,
    preferences_json JSON NOT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    notes TEXT,
    
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    INDEX idx_customer_id (customer_id),
    INDEX idx_created_date (created_date)
);

-- Customer Communication Preferences
CREATE TABLE customer_communication_preferences (
    comm_pref_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    email_estimates TINYINT DEFAULT 1,
    email_status_updates TINYINT DEFAULT 1,
    email_invoices TINYINT DEFAULT 1,
    email_marketing TINYINT DEFAULT 0,
    phone_notifications TINYINT DEFAULT 1,
    preferred_contact_time VARCHAR(100),
    communication_notes TEXT,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    UNIQUE KEY unique_customer_comm (customer_id)
);

-- Trigger to log all customer changes
DELIMITER //
CREATE TRIGGER customer_audit_trigger
    AFTER UPDATE ON customers
    FOR EACH ROW
BEGIN
    -- Track discount changes
    IF OLD.discount != NEW.discount THEN
        INSERT INTO customer_history (customer_id, field_name, old_value, new_value, change_type, changed_by, change_reason)
        VALUES (NEW.customer_id, 'discount', OLD.discount, NEW.discount, 'update', NEW.updated_by, 'Discount rate change');
        
        INSERT INTO customer_pricing_history (customer_id, discount_old, discount_new, change_reason, effective_date, changed_by)
        VALUES (NEW.customer_id, OLD.discount, NEW.discount, 'Discount rate updated', CURDATE(), NEW.updated_by);
    END IF;
    
    -- Track shipping multiplier changes
    IF OLD.shipping_multiplier != NEW.shipping_multiplier THEN
        INSERT INTO customer_history (customer_id, field_name, old_value, new_value, change_type, changed_by, change_reason)
        VALUES (NEW.customer_id, 'shipping_multiplier', OLD.shipping_multiplier, NEW.shipping_multiplier, 'update', NEW.updated_by, 'Shipping rate change');
        
        INSERT INTO customer_pricing_history (customer_id, shipping_multiplier_old, shipping_multiplier_new, change_reason, effective_date, changed_by)
        VALUES (NEW.customer_id, OLD.shipping_multiplier, NEW.shipping_multiplier, 'Shipping rate updated', CURDATE(), NEW.updated_by);
    END IF;
    
    -- Track company name changes
    IF OLD.company_name != NEW.company_name THEN
        INSERT INTO customer_history (customer_id, field_name, old_value, new_value, change_type, changed_by, change_reason)
        VALUES (NEW.customer_id, 'company_name', OLD.company_name, NEW.company_name, 'update', NEW.updated_by, 'Company name change');
    END IF;
    
    -- Track contact information changes
    IF OLD.email != NEW.email THEN
        INSERT INTO customer_history (customer_id, field_name, old_value, new_value, change_type, changed_by, change_reason)
        VALUES (NEW.customer_id, 'email', OLD.email, NEW.email, 'update', NEW.updated_by, 'Email address change');
    END IF;
    
    -- Track major preference changes
    IF (OLD.leds_default_type != NEW.leds_default_type OR 
        OLD.powersupply_default_type != NEW.powersupply_default_type OR
        OLD.pattern_type != NEW.pattern_type OR
        OLD.wiring_diagram_type != NEW.wiring_diagram_type) THEN
        
        INSERT INTO customer_history (customer_id, field_name, old_value, new_value, change_type, changed_by, change_reason)
        VALUES (NEW.customer_id, 'manufacturing_preferences', 
                CONCAT('LEDs:', OLD.leds_default_type, '; PS:', OLD.powersupply_default_type),
                CONCAT('LEDs:', NEW.leds_default_type, '; PS:', NEW.powersupply_default_type),
                'update', NEW.updated_by, 'Manufacturing preferences updated');
    END IF;
END//

-- Trigger for new customer creation
CREATE TRIGGER customer_create_trigger
    AFTER INSERT ON customers
    FOR EACH ROW
BEGIN
    INSERT INTO customer_history (customer_id, field_name, old_value, new_value, change_type, changed_by, change_reason)
    VALUES (NEW.customer_id, 'customer_record', NULL, 'Customer created', 'create', NEW.created_by, 'New customer added to system');
    
    -- Create default communication preferences
    INSERT INTO customer_communication_preferences (customer_id)
    VALUES (NEW.customer_id);
END//

DELIMITER ;

-- Create useful views for reporting
CREATE VIEW customer_summary AS
SELECT 
    c.customer_id,
    c.company_name,
    c.contact_first_name,
    c.contact_last_name,
    c.email,
    c.phone,
    c.discount,
    c.default_turnaround,
    c.active,
    c.created_date,
    COUNT(DISTINCT ch.history_id) as change_count,
    MAX(ch.changed_date) as last_change_date
FROM customers c
LEFT JOIN customer_history ch ON c.customer_id = ch.customer_id
WHERE c.active = TRUE
GROUP BY c.customer_id, c.company_name, c.contact_first_name, c.contact_last_name, 
         c.email, c.phone, c.discount, c.default_turnaround, c.active, c.created_date
ORDER BY c.company_name;

-- View for customers with special pricing
CREATE VIEW customers_with_discounts AS
SELECT 
    c.customer_id,
    c.company_name,
    c.discount,
    c.shipping_multiplier,
    cph.change_reason as last_price_change_reason,
    cph.changed_date as last_price_change_date,
    cph.changed_by as last_changed_by
FROM customers c
LEFT JOIN customer_pricing_history cph ON c.customer_id = cph.customer_id 
    AND cph.changed_date = (
        SELECT MAX(changed_date) 
        FROM customer_pricing_history 
        WHERE customer_id = c.customer_id
    )
WHERE c.discount > 0 OR c.shipping_multiplier != 1.50000
ORDER BY c.discount DESC;

-- View for manufacturing preferences summary
CREATE VIEW customer_manufacturing_preferences AS
SELECT 
    customer_id,
    company_name,
    default_turnaround,
    leds_yes_or_no,
    leds_default_type,
    powersupply_yes_or_no,
    powersupply_default_type,
    ul_yes_or_no,
    pattern_yes_or_no,
    pattern_type,
    wiring_diagram_yes_or_no,
    wiring_diagram_type,
    plug_n_play_yes_or_no
FROM customers
WHERE active = TRUE
ORDER BY company_name;

COMMIT;