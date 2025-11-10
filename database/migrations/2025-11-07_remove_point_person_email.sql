-- Migration: Remove orders.point_person_email column
-- Date: 2025-11-07
-- Description: Remove deprecated point_person_email column from orders table.
--              Point persons are now managed via order_point_persons table (multiple point persons per order)

USE sign_manufacturing;

-- Drop the deprecated column
ALTER TABLE orders DROP COLUMN point_person_email;

-- Verification query (should return 0 rows if column was successfully removed)
-- SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA = 'sign_manufacturing'
-- AND TABLE_NAME = 'orders'
-- AND COLUMN_NAME = 'point_person_email';
