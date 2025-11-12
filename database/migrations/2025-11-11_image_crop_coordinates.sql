-- Migration: Add image crop coordinate fields
-- Date: 2025-11-11
-- Purpose: Support auto-crop feature for order images
--
-- These fields store pixel offsets to trim from each edge of the image
-- Values of 0 mean no cropping on that edge
-- Example: crop_top=50 means trim 50px from the top

USE sign_manufacturing;

-- Add crop coordinate fields to orders table
ALTER TABLE orders
ADD COLUMN crop_top INT UNSIGNED DEFAULT 0 COMMENT 'Pixels to crop from top edge',
ADD COLUMN crop_right INT UNSIGNED DEFAULT 0 COMMENT 'Pixels to crop from right edge',
ADD COLUMN crop_bottom INT UNSIGNED DEFAULT 0 COMMENT 'Pixels to crop from bottom edge',
ADD COLUMN crop_left INT UNSIGNED DEFAULT 0 COMMENT 'Pixels to crop from left edge';

-- Verify the changes
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'sign_manufacturing'
  AND TABLE_NAME = 'orders'
  AND COLUMN_NAME LIKE 'crop_%'
ORDER BY ORDINAL_POSITION;

-- Migration complete
SELECT '✅ Migration complete: Added crop coordinate fields to orders table' AS status;
