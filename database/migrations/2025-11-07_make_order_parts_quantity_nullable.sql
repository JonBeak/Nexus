-- Migration: Make order_parts.quantity nullable
-- Date: 2025-11-07
-- Reason: Order parts can exist without a quantity (e.g., during initial setup or when quantity is TBD)

-- Make quantity column nullable
ALTER TABLE order_parts
MODIFY COLUMN quantity decimal(10,2) DEFAULT NULL
COMMENT 'Part quantity - nullable for parts where quantity is not yet determined';

-- Verify the change
SELECT
    COLUMN_NAME,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_TYPE,
    COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'sign_manufacturing'
    AND TABLE_NAME = 'order_parts'
    AND COLUMN_NAME = 'quantity';
