-- Migration: Update shipping_rates_pricing table structure
-- Add columns for shipping rate types: b, bb, B, BB, tailgate
-- Date: 2025-10-17

USE sign_manufacturing;

-- Add new rate columns to shipping_rates_pricing table
ALTER TABLE shipping_rates_pricing
ADD COLUMN b_rate DECIMAL(8,2) DEFAULT 25.00 COMMENT 'Rate for small box (b)',
ADD COLUMN bb_rate DECIMAL(8,2) DEFAULT 40.00 COMMENT 'Rate for medium box (bb)',
ADD COLUMN big_b_rate DECIMAL(8,2) DEFAULT 55.00 COMMENT 'Rate for large box (B)',
ADD COLUMN big_bb_rate DECIMAL(8,2) DEFAULT 80.00 COMMENT 'Rate for extra large box (BB)',
ADD COLUMN tailgate_rate DECIMAL(8,2) DEFAULT 80.00 COMMENT 'Rate for tailgate delivery';

-- Insert or update default shipping rates
INSERT INTO shipping_rates_pricing
(shipping_type, shipping_code, base_rate, pallet_rate, crate_rate, b_rate, bb_rate, big_b_rate, big_bb_rate, tailgate_rate, effective_date, is_active)
VALUES
('Standard Shipping', 'STANDARD', 0.00, 0.00, 0.00, 25.00, 40.00, 55.00, 80.00, 80.00, CURDATE(), 1)
ON DUPLICATE KEY UPDATE
b_rate = 25.00,
bb_rate = 40.00,
big_b_rate = 55.00,
big_bb_rate = 80.00,
tailgate_rate = 80.00,
effective_date = CURDATE();

-- Verify the changes
SELECT * FROM shipping_rates_pricing;
