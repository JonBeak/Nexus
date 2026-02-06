-- Add hide_company_name flag to customers table
-- Allows customers to hide "Sign House Inc." from order forms (Packing List, Shop Order, etc.)
ALTER TABLE customers ADD COLUMN hide_company_name TINYINT(1) NOT NULL DEFAULT 0 AFTER high_standards;
