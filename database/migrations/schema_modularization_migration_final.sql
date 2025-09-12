-- Schema Modularization Migration Script (Final Fixed Version)
-- Separates the monolithic sign_manufacturing database into 7 feature-specific schemas
-- Handles triggers, constraints, and database context properly
-- 
-- Created: 2025-09-10
-- Author: Claude Code
-- Purpose: Modularize database for better organization, security, and maintainability

-- =============================================================================
-- STEP 1: CREATE NEW SCHEMAS
-- =============================================================================

-- Core foundation schema
CREATE SCHEMA IF NOT EXISTS `core`;

-- Customer management schema  
CREATE SCHEMA IF NOT EXISTS `customers`;

-- Job estimation schema
CREATE SCHEMA IF NOT EXISTS `estimates`;

-- Vinyl inventory schema
CREATE SCHEMA IF NOT EXISTS `vinyl`;

-- Time management schema
CREATE SCHEMA IF NOT EXISTS `time_management`;

-- Wages and payroll schema
CREATE SCHEMA IF NOT EXISTS `wages`;

-- Supply chain management schema
CREATE SCHEMA IF NOT EXISTS `supply_chain`;

-- =============================================================================
-- STEP 2: USE DATABASE AND HANDLE TRIGGERS
-- =============================================================================

USE sign_manufacturing;

-- Drop existing triggers
DROP TRIGGER IF EXISTS set_customer_address_sequence;
DROP TRIGGER IF EXISTS customer_create_trigger;

-- =============================================================================
-- STEP 3: ADD SUPPLIER TYPE CLASSIFICATION
-- =============================================================================

-- Add supplier_type field to classify suppliers by domain
ALTER TABLE suppliers 
ADD COLUMN supplier_type ENUM('general', 'vinyl', 'both') DEFAULT 'general'
AFTER is_active;

-- Flag existing vinyl suppliers based on vinyl_inventory usage
UPDATE suppliers 
SET supplier_type = 'vinyl' 
WHERE supplier_id IN (
    SELECT DISTINCT supplier_id 
    FROM vinyl_inventory 
    WHERE supplier_id IS NOT NULL
);

-- =============================================================================
-- STEP 4: MOVE TABLES TO APPROPRIATE SCHEMAS
-- =============================================================================

-- CORE SCHEMA TABLES (Foundation)
-- Authentication and authorization
RENAME TABLE sign_manufacturing.users TO core.users;
RENAME TABLE sign_manufacturing.login_logs TO core.login_logs;

-- RBAC system
RENAME TABLE sign_manufacturing.rbac_actions TO core.rbac_actions;
RENAME TABLE sign_manufacturing.rbac_permission_groups TO core.rbac_permission_groups;
RENAME TABLE sign_manufacturing.rbac_permission_group_members TO core.rbac_permission_group_members;
RENAME TABLE sign_manufacturing.rbac_permission_log TO core.rbac_permission_log;
RENAME TABLE sign_manufacturing.rbac_permissions TO core.rbac_permissions;
RENAME TABLE sign_manufacturing.rbac_resources TO core.rbac_resources;
RENAME TABLE sign_manufacturing.rbac_role_migration_map TO core.rbac_role_migration_map;
RENAME TABLE sign_manufacturing.rbac_role_permissions TO core.rbac_role_permissions;
RENAME TABLE sign_manufacturing.rbac_roles TO core.rbac_roles;
RENAME TABLE sign_manufacturing.rbac_settings TO core.rbac_settings;
RENAME TABLE sign_manufacturing.rbac_user_permissions TO core.rbac_user_permissions;

-- Centralized audit trail
RENAME TABLE sign_manufacturing.audit_trail TO core.audit_trail;

-- CUSTOMERS SCHEMA TABLES
-- Move dependent tables first
RENAME TABLE sign_manufacturing.customer_communication_preferences TO customers.customer_communication_preferences;
RENAME TABLE sign_manufacturing.customer_history TO customers.customer_history;
RENAME TABLE sign_manufacturing.customer_manufacturing_preferences TO customers.customer_manufacturing_preferences;
RENAME TABLE sign_manufacturing.customer_preference_snapshots TO customers.customer_preference_snapshots;
RENAME TABLE sign_manufacturing.customer_pricing_history TO customers.customer_pricing_history;
RENAME TABLE sign_manufacturing.customer_summary TO customers.customer_summary;
RENAME TABLE sign_manufacturing.customers_with_discounts TO customers.customers_with_discounts;

-- Move customers and customer_addresses (these had triggers)
RENAME TABLE sign_manufacturing.customers TO customers.customers;
RENAME TABLE sign_manufacturing.customer_addresses TO customers.customer_addresses;

-- Tax and location data
RENAME TABLE sign_manufacturing.provinces_tax TO customers.provinces_tax;
RENAME TABLE sign_manufacturing.tax_rules TO customers.tax_rules;

-- ESTIMATES SCHEMA TABLES (Job estimation system)
RENAME TABLE sign_manufacturing.jobs TO estimates.jobs;
RENAME TABLE sign_manufacturing.job_estimates TO estimates.job_estimates;
RENAME TABLE sign_manufacturing.job_estimate_items TO estimates.job_estimate_items;
RENAME TABLE sign_manufacturing.job_estimate_groups TO estimates.job_estimate_groups;
RENAME TABLE sign_manufacturing.job_estimate_summary TO estimates.job_estimate_summary;
RENAME TABLE sign_manufacturing.job_item_addons TO estimates.job_item_addons;
RENAME TABLE sign_manufacturing.addon_types TO estimates.addon_types;
RENAME TABLE sign_manufacturing.estimate_history TO estimates.estimate_history;

-- Product types
RENAME TABLE sign_manufacturing.product_types TO estimates.product_types;

-- Job invoicing
RENAME TABLE sign_manufacturing.job_invoices TO estimates.job_invoices;
RENAME TABLE sign_manufacturing.job_invoice_items TO estimates.job_invoice_items;

-- Job workflow and material requirements
RENAME TABLE sign_manufacturing.job_workflow_status TO estimates.job_workflow_status;
RENAME TABLE sign_manufacturing.job_material_requirements TO estimates.job_material_requirements;

-- Pricing system tables
RENAME TABLE sign_manufacturing.backer_pricing TO estimates.backer_pricing;
RENAME TABLE sign_manufacturing.blade_sign_pricing TO estimates.blade_sign_pricing;
RENAME TABLE sign_manufacturing.channel_letter_types TO estimates.channel_letter_types;
RENAME TABLE sign_manufacturing.custom_pricing TO estimates.custom_pricing;
RENAME TABLE sign_manufacturing.discount_ranges TO estimates.discount_ranges;
RENAME TABLE sign_manufacturing.face_materials TO estimates.face_materials;
RENAME TABLE sign_manufacturing.labor_rates_pricing TO estimates.labor_rates_pricing;
RENAME TABLE sign_manufacturing.led_neon_pricing TO estimates.led_neon_pricing;
RENAME TABLE sign_manufacturing.leds TO estimates.leds;
RENAME TABLE sign_manufacturing.material_cut_pricing TO estimates.material_cut_pricing;
RENAME TABLE sign_manufacturing.multiplier_ranges TO estimates.multiplier_ranges;
RENAME TABLE sign_manufacturing.painting_pricing TO estimates.painting_pricing;
RENAME TABLE sign_manufacturing.power_supplies TO estimates.power_supplies;
RENAME TABLE sign_manufacturing.pricing_change_requests TO estimates.pricing_change_requests;
RENAME TABLE sign_manufacturing.pricing_system_config TO estimates.pricing_system_config;
RENAME TABLE sign_manufacturing.push_thru_pricing TO estimates.push_thru_pricing;
RENAME TABLE sign_manufacturing.return_colors TO estimates.return_colors;
RENAME TABLE sign_manufacturing.shipping_rates_pricing TO estimates.shipping_rates_pricing;
RENAME TABLE sign_manufacturing.substrate_cut_pricing TO estimates.substrate_cut_pricing;
RENAME TABLE sign_manufacturing.substrate_materials_pricing TO estimates.substrate_materials_pricing;
RENAME TABLE sign_manufacturing.ul_listing_pricing TO estimates.ul_listing_pricing;
RENAME TABLE sign_manufacturing.vinyl_materials_pricing TO estimates.vinyl_materials_pricing;
RENAME TABLE sign_manufacturing.vinyl_types_pricing TO estimates.vinyl_types_pricing;
RENAME TABLE sign_manufacturing.wiring_pricing TO estimates.wiring_pricing;

-- VINYL SCHEMA TABLES
RENAME TABLE sign_manufacturing.vinyl_inventory TO vinyl.vinyl_inventory;
RENAME TABLE sign_manufacturing.vinyl_products TO vinyl.vinyl_products;
RENAME TABLE sign_manufacturing.vinyl_job_links TO vinyl.vinyl_job_links;

-- TIME_MANAGEMENT SCHEMA TABLES
RENAME TABLE sign_manufacturing.time_entries TO time_management.time_entries;
RENAME TABLE sign_manufacturing.time_edit_requests TO time_management.time_edit_requests;
RENAME TABLE sign_manufacturing.time_edit_notifications TO time_management.time_edit_notifications;
RENAME TABLE sign_manufacturing.scheduled_breaks TO time_management.scheduled_breaks;
RENAME TABLE sign_manufacturing.work_schedules TO time_management.work_schedules;
RENAME TABLE sign_manufacturing.vacation_periods TO time_management.vacation_periods;
RENAME TABLE sign_manufacturing.company_holidays TO time_management.company_holidays;
RENAME TABLE sign_manufacturing.user_groups TO time_management.user_groups;
RENAME TABLE sign_manufacturing.user_group_members TO time_management.user_group_members;

-- WAGES SCHEMA TABLES
RENAME TABLE sign_manufacturing.payroll_records TO wages.payroll_records;
RENAME TABLE sign_manufacturing.payroll_record_entries TO wages.payroll_record_entries;
RENAME TABLE sign_manufacturing.payroll_settings TO wages.payroll_settings;
RENAME TABLE sign_manufacturing.payroll_deduction_overrides TO wages.payroll_deduction_overrides;

-- SUPPLY_CHAIN SCHEMA TABLES
RENAME TABLE sign_manufacturing.suppliers TO supply_chain.suppliers;
RENAME TABLE sign_manufacturing.supplier_orders TO supply_chain.supplier_orders;
RENAME TABLE sign_manufacturing.supplier_order_items TO supply_chain.supplier_order_items;
RENAME TABLE sign_manufacturing.supplier_item_costs TO supply_chain.supplier_item_costs;
RENAME TABLE sign_manufacturing.supplier_cost_alerts TO supply_chain.supplier_cost_alerts;
RENAME TABLE sign_manufacturing.product_suppliers TO supply_chain.product_suppliers;
RENAME TABLE sign_manufacturing.low_stock_items TO supply_chain.low_stock_items;

-- Inventory and material management
RENAME TABLE sign_manufacturing.inventory TO supply_chain.inventory;
RENAME TABLE sign_manufacturing.inventory_reservations TO supply_chain.inventory_reservations;
RENAME TABLE sign_manufacturing.product_standards TO supply_chain.product_standards;
RENAME TABLE sign_manufacturing.material_categories TO supply_chain.material_categories;
RENAME TABLE sign_manufacturing.category_fields TO supply_chain.category_fields;

-- Import logs
RENAME TABLE sign_manufacturing.csv_import_log TO supply_chain.csv_import_log;

-- =============================================================================
-- STEP 5: RECREATE TRIGGERS IN NEW SCHEMAS
-- =============================================================================

-- Switch to customers schema for trigger creation
USE customers;

DELIMITER $$

-- Recreate customer address sequence trigger
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

-- Recreate customer creation trigger (updated for new schema)
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

-- =============================================================================
-- STEP 6: UPDATE FOREIGN KEY REFERENCES FOR CROSS-SCHEMA RELATIONSHIPS
-- =============================================================================

-- Update customer address foreign keys
ALTER TABLE customers.customer_addresses DROP FOREIGN KEY customer_addresses_ibfk_1;
ALTER TABLE customers.customer_addresses ADD CONSTRAINT fk_customer_address_customer 
    FOREIGN KEY (customer_id) REFERENCES customers.customers(customer_id);

ALTER TABLE customers.customer_communication_preferences DROP FOREIGN KEY customer_communication_preferences_ibfk_1;
ALTER TABLE customers.customer_communication_preferences ADD CONSTRAINT fk_customer_comm_pref_customer 
    FOREIGN KEY (customer_id) REFERENCES customers.customers(customer_id);

ALTER TABLE customers.customer_history DROP FOREIGN KEY customer_history_ibfk_1;
ALTER TABLE customers.customer_history ADD CONSTRAINT fk_customer_history_customer 
    FOREIGN KEY (customer_id) REFERENCES customers.customers(customer_id);

-- Update estimates foreign keys
ALTER TABLE estimates.job_estimates DROP FOREIGN KEY job_estimates_ibfk_1;
ALTER TABLE estimates.job_estimates ADD CONSTRAINT fk_estimates_customer 
    FOREIGN KEY (customer_id) REFERENCES customers.customers(customer_id);

ALTER TABLE estimates.job_estimates DROP FOREIGN KEY fk_estimates_editing_user;
ALTER TABLE estimates.job_estimates ADD CONSTRAINT fk_estimates_editing_user 
    FOREIGN KEY (editing_user_id) REFERENCES core.users(user_id);

-- Update inventory reservations to use estimates jobs
ALTER TABLE supply_chain.inventory_reservations DROP FOREIGN KEY inventory_reservations_ibfk_1;
ALTER TABLE supply_chain.inventory_reservations ADD CONSTRAINT fk_inventory_res_job 
    FOREIGN KEY (job_id) REFERENCES estimates.jobs(job_id);

-- Update vinyl inventory supplier reference
ALTER TABLE vinyl.vinyl_inventory DROP FOREIGN KEY vinyl_inventory_ibfk_5;
ALTER TABLE vinyl.vinyl_inventory ADD CONSTRAINT fk_vinyl_inventory_supplier 
    FOREIGN KEY (supplier_id) REFERENCES supply_chain.suppliers(supplier_id);

-- Add constraint to ensure vinyl inventory only uses vinyl suppliers
ALTER TABLE vinyl.vinyl_inventory ADD CONSTRAINT chk_vinyl_supplier_type 
    CHECK (supplier_id IS NULL OR 
           supplier_id IN (SELECT supplier_id FROM supply_chain.suppliers 
                          WHERE supplier_type IN ('vinyl', 'both')));

-- =============================================================================
-- STEP 7: CREATE DATABASE VIEWS FOR FILTERED ACCESS
-- =============================================================================

-- Create view for vinyl suppliers only
CREATE VIEW vinyl.vinyl_suppliers AS 
SELECT * FROM supply_chain.suppliers 
WHERE supplier_type IN ('vinyl', 'both');

-- Create view for general suppliers only
CREATE VIEW supply_chain.general_suppliers AS 
SELECT * FROM supply_chain.suppliers 
WHERE supplier_type IN ('general', 'both');

-- Create consolidated customer view with address info
CREATE VIEW customers.customers_with_primary_address AS
SELECT 
    c.customer_id,
    c.company_name,
    c.contact_name,
    c.email,
    c.phone,
    ca.address_line_1,
    ca.address_line_2,
    ca.city,
    ca.province,
    ca.postal_code,
    ca.country
FROM customers.customers c
LEFT JOIN customers.customer_addresses ca ON c.customer_id = ca.customer_id 
    AND ca.address_type = 'billing' AND ca.is_primary = 1;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Log completion
INSERT INTO core.audit_trail (user_id, action, entity_type, entity_id, details, created_at)
VALUES (NULL, 'SCHEMA_MIGRATION', 'DATABASE', 'ALL_SCHEMAS', 
        'Completed database schema modularization migration with proper trigger and context handling', NOW());

-- Show final schema summary
SELECT SCHEMA_NAME as 'New Schemas Created' 
FROM information_schema.SCHEMATA 
WHERE SCHEMA_NAME IN ('core', 'customers', 'estimates', 
                      'vinyl', 'time_management', 'wages', 'supply_chain')
ORDER BY SCHEMA_NAME;

-- Show table counts per schema
SELECT 
    TABLE_SCHEMA as 'Schema',
    COUNT(*) as 'Table Count'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA IN ('core', 'customers', 'estimates', 'vinyl', 'time_management', 'wages', 'supply_chain')
GROUP BY TABLE_SCHEMA
ORDER BY TABLE_SCHEMA;

-- Show remaining tables in original schema (should be empty)
SELECT COUNT(*) as 'Tables remaining in sign_manufacturing'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'sign_manufacturing';