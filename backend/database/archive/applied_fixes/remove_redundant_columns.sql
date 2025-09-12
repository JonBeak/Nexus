-- Remove redundant columns from customers table
-- These columns are redundant because we have proper foreign keys:
-- - leds_default_type is replaced by led_id -> leds table
-- - powersupply_default_type is replaced by power_supply_id -> power_supplies table
--
-- Date: August 22, 2025
-- Author: Database cleanup migration

USE sign_manufacturing;

-- First, let's verify the current state
SELECT 
    COUNT(*) as total_customers,
    COUNT(leds_default_type) as customers_with_led_text,
    COUNT(led_id) as customers_with_led_id,
    COUNT(powersupply_default_type) as customers_with_ps_text,
    COUNT(power_supply_id) as customers_with_ps_id
FROM customers;

-- Show some examples of the data we're about to remove
SELECT 
    customer_id,
    company_name,
    leds_default_type,
    led_id,
    l.product_code as led_product_code,
    powersupply_default_type,
    power_supply_id,
    ps.transformer_type as power_supply_transformer_type
FROM customers c
LEFT JOIN leds l ON c.led_id = l.led_id
LEFT JOIN power_supplies ps ON c.power_supply_id = ps.power_supply_id
WHERE c.leds_default_type IS NOT NULL OR c.powersupply_default_type IS NOT NULL
LIMIT 10;

-- Create backup table before dropping columns (just in case)
CREATE TABLE customers_backup_20250822 AS 
SELECT customer_id, leds_default_type, powersupply_default_type 
FROM customers 
WHERE leds_default_type IS NOT NULL OR powersupply_default_type IS NOT NULL;

-- Remove the redundant columns
ALTER TABLE customers 
DROP COLUMN leds_default_type,
DROP COLUMN powersupply_default_type;

-- Verify the columns are gone
SHOW COLUMNS FROM customers LIKE '%default_type%';

-- Show final table structure
DESCRIBE customers;

SELECT CONCAT('✅ Migration completed successfully. Removed redundant columns: leds_default_type, powersupply_default_type') as status;