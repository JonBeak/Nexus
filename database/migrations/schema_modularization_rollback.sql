-- Schema Modularization Rollback Script
-- Rolls back the database schema modularization by moving all tables back to sign_manufacturing
-- 
-- Created: 2025-09-10
-- Author: Claude Code
-- Purpose: Emergency rollback for schema modularization migration

-- =============================================================================
-- WARNING: THIS ROLLBACK SCRIPT WILL UNDO THE SCHEMA MODULARIZATION
-- =============================================================================

-- Log rollback start
INSERT INTO core.audit_trail (user_id, action, entity_type, entity_id, details, created_at)
VALUES (NULL, 'SCHEMA_ROLLBACK_START', 'DATABASE', 'ALL_SCHEMAS', 
        'Starting schema modularization rollback', NOW());

-- =============================================================================
-- STEP 1: MOVE ALL TABLES BACK TO sign_manufacturing SCHEMA
-- =============================================================================

-- CORE SCHEMA ROLLBACK
RENAME TABLE core.users TO sign_manufacturing.users;
RENAME TABLE core.login_logs TO sign_manufacturing.login_logs;
RENAME TABLE core.rbac_actions TO sign_manufacturing.rbac_actions;
RENAME TABLE core.rbac_permission_groups TO sign_manufacturing.rbac_permission_groups;
RENAME TABLE core.rbac_permission_group_members TO sign_manufacturing.rbac_permission_group_members;
RENAME TABLE core.rbac_permission_log TO sign_manufacturing.rbac_permission_log;
RENAME TABLE core.rbac_permissions TO sign_manufacturing.rbac_permissions;
RENAME TABLE core.rbac_resources TO sign_manufacturing.rbac_resources;
RENAME TABLE core.rbac_role_migration_map TO sign_manufacturing.rbac_role_migration_map;
RENAME TABLE core.rbac_role_permissions TO sign_manufacturing.rbac_role_permissions;
RENAME TABLE core.rbac_roles TO sign_manufacturing.rbac_roles;
RENAME TABLE core.rbac_settings TO sign_manufacturing.rbac_settings;
RENAME TABLE core.rbac_user_permissions TO sign_manufacturing.rbac_user_permissions;
RENAME TABLE core.audit_trail TO sign_manufacturing.audit_trail;

-- CUSTOMERS SCHEMA ROLLBACK
RENAME TABLE customers.customers TO sign_manufacturing.customers;
RENAME TABLE customers.customer_addresses TO sign_manufacturing.customer_addresses;
RENAME TABLE customers.customer_communication_preferences TO sign_manufacturing.customer_communication_preferences;
RENAME TABLE customers.customer_history TO sign_manufacturing.customer_history;
RENAME TABLE customers.customer_manufacturing_preferences TO sign_manufacturing.customer_manufacturing_preferences;
RENAME TABLE customers.customer_preference_snapshots TO sign_manufacturing.customer_preference_snapshots;
RENAME TABLE customers.customer_pricing_history TO sign_manufacturing.customer_pricing_history;
RENAME TABLE customers.customer_summary TO sign_manufacturing.customer_summary;
RENAME TABLE customers.customers_with_discounts TO sign_manufacturing.customers_with_discounts;
RENAME TABLE customers.provinces_tax TO sign_manufacturing.provinces_tax;
RENAME TABLE customers.tax_rules TO sign_manufacturing.tax_rules;

-- ESTIMATES SCHEMA ROLLBACK
RENAME TABLE estimates.jobs TO sign_manufacturing.jobs;
RENAME TABLE estimates.job_estimates TO sign_manufacturing.job_estimates;
RENAME TABLE estimates.job_estimate_items TO sign_manufacturing.job_estimate_items;
RENAME TABLE estimates.job_estimate_groups TO sign_manufacturing.job_estimate_groups;
RENAME TABLE estimates.job_estimate_summary TO sign_manufacturing.job_estimate_summary;
RENAME TABLE estimates.job_item_addons TO sign_manufacturing.job_item_addons;
RENAME TABLE estimates.addon_types TO sign_manufacturing.addon_types;
RENAME TABLE estimates.estimate_history TO sign_manufacturing.estimate_history;
RENAME TABLE estimates.product_types TO sign_manufacturing.product_types;
RENAME TABLE estimates.job_invoices TO sign_manufacturing.job_invoices;
RENAME TABLE estimates.job_invoice_items TO sign_manufacturing.job_invoice_items;
RENAME TABLE estimates.job_workflow_status TO sign_manufacturing.job_workflow_status;
RENAME TABLE estimates.job_material_requirements TO sign_manufacturing.job_material_requirements;

-- Pricing tables rollback
RENAME TABLE estimates.backer_pricing TO sign_manufacturing.backer_pricing;
RENAME TABLE estimates.blade_sign_pricing TO sign_manufacturing.blade_sign_pricing;
RENAME TABLE estimates.channel_letter_types TO sign_manufacturing.channel_letter_types;
RENAME TABLE estimates.custom_pricing TO sign_manufacturing.custom_pricing;
RENAME TABLE estimates.discount_ranges TO sign_manufacturing.discount_ranges;
RENAME TABLE estimates.face_materials TO sign_manufacturing.face_materials;
RENAME TABLE estimates.labor_rates_pricing TO sign_manufacturing.labor_rates_pricing;
RENAME TABLE estimates.led_neon_pricing TO sign_manufacturing.led_neon_pricing;
RENAME TABLE estimates.leds TO sign_manufacturing.leds;
RENAME TABLE estimates.material_cut_pricing TO sign_manufacturing.material_cut_pricing;
RENAME TABLE estimates.multiplier_ranges TO sign_manufacturing.multiplier_ranges;
RENAME TABLE estimates.painting_pricing TO sign_manufacturing.painting_pricing;
RENAME TABLE estimates.power_supplies TO sign_manufacturing.power_supplies;
RENAME TABLE estimates.pricing_change_requests TO sign_manufacturing.pricing_change_requests;
RENAME TABLE estimates.pricing_system_config TO sign_manufacturing.pricing_system_config;
RENAME TABLE estimates.push_thru_pricing TO sign_manufacturing.push_thru_pricing;
RENAME TABLE estimates.return_colors TO sign_manufacturing.return_colors;
RENAME TABLE estimates.shipping_rates_pricing TO sign_manufacturing.shipping_rates_pricing;
RENAME TABLE estimates.substrate_cut_pricing TO sign_manufacturing.substrate_cut_pricing;
RENAME TABLE estimates.substrate_materials_pricing TO sign_manufacturing.substrate_materials_pricing;
RENAME TABLE estimates.ul_listing_pricing TO sign_manufacturing.ul_listing_pricing;
RENAME TABLE estimates.vinyl_materials_pricing TO sign_manufacturing.vinyl_materials_pricing;
RENAME TABLE estimates.vinyl_types_pricing TO sign_manufacturing.vinyl_types_pricing;
RENAME TABLE estimates.wiring_pricing TO sign_manufacturing.wiring_pricing;

-- VINYL SCHEMA ROLLBACK
RENAME TABLE vinyl.vinyl_inventory TO sign_manufacturing.vinyl_inventory;
RENAME TABLE vinyl.vinyl_products TO sign_manufacturing.vinyl_products;
RENAME TABLE vinyl.vinyl_job_links TO sign_manufacturing.vinyl_job_links;

-- TIME_MANAGEMENT SCHEMA ROLLBACK
RENAME TABLE time_management.time_entries TO sign_manufacturing.time_entries;
RENAME TABLE time_management.time_edit_requests TO sign_manufacturing.time_edit_requests;
RENAME TABLE time_management.time_edit_notifications TO sign_manufacturing.time_edit_notifications;
RENAME TABLE time_management.scheduled_breaks TO sign_manufacturing.scheduled_breaks;
RENAME TABLE time_management.work_schedules TO sign_manufacturing.work_schedules;
RENAME TABLE time_management.vacation_periods TO sign_manufacturing.vacation_periods;
RENAME TABLE time_management.company_holidays TO sign_manufacturing.company_holidays;
RENAME TABLE time_management.user_groups TO sign_manufacturing.user_groups;
RENAME TABLE time_management.user_group_members TO sign_manufacturing.user_group_members;

-- WAGES SCHEMA ROLLBACK
RENAME TABLE wages.payroll_records TO sign_manufacturing.payroll_records;
RENAME TABLE wages.payroll_record_entries TO sign_manufacturing.payroll_record_entries;
RENAME TABLE wages.payroll_settings TO sign_manufacturing.payroll_settings;
RENAME TABLE wages.payroll_deduction_overrides TO sign_manufacturing.payroll_deduction_overrides;

-- SUPPLY_CHAIN SCHEMA ROLLBACK
RENAME TABLE supply_chain.suppliers TO sign_manufacturing.suppliers;
RENAME TABLE supply_chain.supplier_orders TO sign_manufacturing.supplier_orders;
RENAME TABLE supply_chain.supplier_order_items TO sign_manufacturing.supplier_order_items;
RENAME TABLE supply_chain.supplier_item_costs TO sign_manufacturing.supplier_item_costs;
RENAME TABLE supply_chain.supplier_cost_alerts TO sign_manufacturing.supplier_cost_alerts;
RENAME TABLE supply_chain.product_suppliers TO sign_manufacturing.product_suppliers;
RENAME TABLE supply_chain.low_stock_items TO sign_manufacturing.low_stock_items;
RENAME TABLE supply_chain.inventory TO sign_manufacturing.inventory;
RENAME TABLE supply_chain.inventory_reservations TO sign_manufacturing.inventory_reservations;
RENAME TABLE supply_chain.product_standards TO sign_manufacturing.product_standards;
RENAME TABLE supply_chain.material_categories TO sign_manufacturing.material_categories;
RENAME TABLE supply_chain.category_fields TO sign_manufacturing.category_fields;
RENAME TABLE supply_chain.csv_import_log TO sign_manufacturing.csv_import_log;

-- =============================================================================
-- STEP 2: RESTORE ORIGINAL FOREIGN KEY REFERENCES
-- =============================================================================

-- Restore customer address foreign key
ALTER TABLE sign_manufacturing.customer_addresses DROP FOREIGN KEY fk_customer_address_customer;
ALTER TABLE sign_manufacturing.customer_addresses ADD CONSTRAINT customer_addresses_ibfk_1 
    FOREIGN KEY (customer_id) REFERENCES sign_manufacturing.customers(customer_id);

-- Restore customer communication preferences
ALTER TABLE sign_manufacturing.customer_communication_preferences DROP FOREIGN KEY fk_customer_comm_pref_customer;
ALTER TABLE sign_manufacturing.customer_communication_preferences ADD CONSTRAINT customer_communication_preferences_ibfk_1 
    FOREIGN KEY (customer_id) REFERENCES sign_manufacturing.customers(customer_id);

-- Restore customer history  
ALTER TABLE sign_manufacturing.customer_history DROP FOREIGN KEY fk_customer_history_customer;
ALTER TABLE sign_manufacturing.customer_history ADD CONSTRAINT customer_history_ibfk_1 
    FOREIGN KEY (customer_id) REFERENCES sign_manufacturing.customers(customer_id);

-- Restore estimates foreign keys
ALTER TABLE sign_manufacturing.job_estimates DROP FOREIGN KEY fk_estimates_customer;
ALTER TABLE sign_manufacturing.job_estimates ADD CONSTRAINT job_estimates_ibfk_1 
    FOREIGN KEY (customer_id) REFERENCES sign_manufacturing.customers(customer_id);

ALTER TABLE sign_manufacturing.job_estimates DROP FOREIGN KEY fk_estimates_editing_user;
ALTER TABLE sign_manufacturing.job_estimates ADD CONSTRAINT fk_estimates_editing_user 
    FOREIGN KEY (editing_user_id) REFERENCES sign_manufacturing.users(user_id);

-- Restore inventory reservations foreign key (back to original jobs)
ALTER TABLE sign_manufacturing.inventory_reservations DROP FOREIGN KEY fk_inventory_res_job;
ALTER TABLE sign_manufacturing.inventory_reservations ADD CONSTRAINT inventory_reservations_ibfk_1 
    FOREIGN KEY (job_id) REFERENCES sign_manufacturing.jobs(job_id);

-- Restore vinyl inventory supplier reference
ALTER TABLE sign_manufacturing.vinyl_inventory DROP FOREIGN KEY fk_vinyl_inventory_supplier;
ALTER TABLE sign_manufacturing.vinyl_inventory ADD CONSTRAINT vinyl_inventory_ibfk_5 
    FOREIGN KEY (supplier_id) REFERENCES sign_manufacturing.suppliers(supplier_id);

-- Remove vinyl supplier type constraint
ALTER TABLE sign_manufacturing.vinyl_inventory DROP CONSTRAINT chk_vinyl_supplier_type;

-- =============================================================================
-- STEP 3: REMOVE SUPPLIER TYPE FIELD
-- =============================================================================

ALTER TABLE sign_manufacturing.suppliers DROP COLUMN supplier_type;

-- =============================================================================
-- STEP 4: DROP THE MODULAR SCHEMAS
-- =============================================================================

-- Drop views first
DROP VIEW IF EXISTS vinyl.vinyl_suppliers;
DROP VIEW IF EXISTS supply_chain.general_suppliers;
DROP VIEW IF EXISTS customers.customers_with_primary_address;

-- Drop the schemas
DROP SCHEMA IF EXISTS core;
DROP SCHEMA IF EXISTS customers;
DROP SCHEMA IF EXISTS estimates;
DROP SCHEMA IF EXISTS vinyl;
DROP SCHEMA IF EXISTS time_management;
DROP SCHEMA IF EXISTS wages;
DROP SCHEMA IF EXISTS supply_chain;

-- =============================================================================
-- ROLLBACK COMPLETE
-- =============================================================================

-- Log completion
INSERT INTO sign_manufacturing.audit_trail (user_id, action, entity_type, entity_id, details, created_at)
VALUES (NULL, 'SCHEMA_ROLLBACK_COMPLETE', 'DATABASE', 'sign_manufacturing', 
        'Completed schema modularization rollback - all tables restored to original schema', NOW());

-- Verify all tables are back in original schema
SELECT COUNT(*) as 'Tables in sign_manufacturing' 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'sign_manufacturing';