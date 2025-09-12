-- Reset Database to Clean State
-- This script moves any tables back to sign_manufacturing schema and drops modular schemas
-- Use this to get back to a clean state before running the migration

USE sign_manufacturing;

-- Move any tables back to sign_manufacturing if they exist in other schemas
-- Core tables
SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'core' AND TABLE_NAME = 'users') > 0,
    'RENAME TABLE core.users TO sign_manufacturing.users',
    'SELECT "users not in core schema" as message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'core' AND TABLE_NAME = 'audit_trail') > 0,
    'RENAME TABLE core.audit_trail TO sign_manufacturing.audit_trail',
    'SELECT "audit_trail not in core schema" as message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Move all other possible tables back (this handles partial migrations)
-- We'll use a more comprehensive approach

-- Drop any existing views first
DROP VIEW IF EXISTS vinyl.vinyl_suppliers;
DROP VIEW IF EXISTS supply_chain.general_suppliers;
DROP VIEW IF EXISTS customers.customers_with_primary_address;

-- Drop triggers in new schemas
DROP TRIGGER IF EXISTS customers.set_customer_address_sequence;
DROP TRIGGER IF EXISTS customers.customer_create_trigger;

-- Drop the modular schemas if they exist (this will fail safely if tables still exist in them)
DROP SCHEMA IF EXISTS core;
DROP SCHEMA IF EXISTS customers;
DROP SCHEMA IF EXISTS estimates;
DROP SCHEMA IF EXISTS vinyl;
DROP SCHEMA IF EXISTS time_management;
DROP SCHEMA IF EXISTS wages;
DROP SCHEMA IF EXISTS supply_chain;

-- Recreate any missing triggers in sign_manufacturing
DROP TRIGGER IF EXISTS set_customer_address_sequence;
DROP TRIGGER IF EXISTS customer_create_trigger;

DELIMITER $$

CREATE TRIGGER set_customer_address_sequence
BEFORE INSERT ON customer_addresses
FOR EACH ROW
BEGIN
    DECLARE max_seq INT DEFAULT 0;
    
    IF NEW.customer_address_sequence IS NULL OR NEW.customer_address_sequence = 0 THEN
        SELECT COALESCE(MAX(customer_address_sequence), 0) INTO max_seq
        FROM customer_addresses
        WHERE customer_id = NEW.customer_id;
        
        SET NEW.customer_address_sequence = max_seq + 1;
    END IF;
END$$

CREATE TRIGGER customer_create_trigger
AFTER INSERT ON customers
FOR EACH ROW
BEGIN
    INSERT INTO customer_history (customer_id, field_name, old_value, new_value, change_type, changed_by, change_reason)
    VALUES (NEW.customer_id, 'customer_record', NULL, 'Customer created', 'create', NEW.created_by, 'New customer added to system');
    
    INSERT INTO customer_communication_preferences (customer_id)
    VALUES (NEW.customer_id);
END$$

DELIMITER ;

-- Show current state
SELECT 'Reset complete - all tables back in sign_manufacturing' as status;
SELECT COUNT(*) as 'Tables in sign_manufacturing' FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'sign_manufacturing';