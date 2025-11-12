-- Phase 1.5.g: Order Folder & Image Management
-- Add folder tracking fields to orders table
-- Date: 2025-11-10

USE sign_manufacturing;

-- Add folder tracking fields
ALTER TABLE orders
  ADD COLUMN folder_name VARCHAR(500) NULL COMMENT 'Folder name in format: {order_name} ----- {customer_company_name}',
  ADD COLUMN folder_exists BOOLEAN DEFAULT FALSE COMMENT 'Whether folder physically exists on SMB share',
  ADD COLUMN folder_location ENUM('active', 'finished', 'none') DEFAULT 'none' COMMENT 'Location of folder: active (root), finished (1Finished), or none',
  ADD COLUMN is_migrated BOOLEAN DEFAULT FALSE COMMENT 'True for orders created from existing SMB folders (legacy tracking)';

-- Add index for fast folder name lookups (case-insensitive conflict detection)
CREATE INDEX idx_folder_name ON orders(folder_name);

-- Add index for filtering by folder location
CREATE INDEX idx_folder_location ON orders(folder_location);

-- sign_image_path already exists in the orders table (VARCHAR 500)
-- Will store just the filename: e.g., "design.jpg"

-- Verify changes
DESCRIBE orders;

-- Show new columns
SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'sign_manufacturing'
  AND TABLE_NAME = 'orders'
  AND COLUMN_NAME IN ('folder_name', 'folder_exists', 'folder_location', 'is_migrated', 'sign_image_path');
