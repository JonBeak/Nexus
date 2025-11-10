-- Add tax_name field to orders table
-- This will be auto-filled from customer's billing address province tax_name
-- and can be edited per order via dropdown

ALTER TABLE orders
ADD COLUMN tax_name VARCHAR(50) NULL COMMENT 'Tax name for this order (initialized from billing address province tax, editable)' AFTER discount;

-- Add foreign key to tax_rules table
ALTER TABLE orders
ADD CONSTRAINT fk_orders_tax_name
FOREIGN KEY (tax_name) REFERENCES tax_rules(tax_name);

-- Backfill existing orders with tax from their customer's billing address
UPDATE orders o
JOIN customers c ON o.customer_id = c.customer_id
JOIN customer_addresses ca ON c.customer_id = ca.customer_id AND ca.is_billing = 1
JOIN provinces_tax pt ON ca.province_state_short = pt.province_short
SET o.tax_name = pt.tax_name
WHERE o.tax_name IS NULL;

-- For any orders that still don't have tax (no billing address), set to GST as default
UPDATE orders
SET tax_name = 'GST'
WHERE tax_name IS NULL;
