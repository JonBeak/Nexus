-- Migration: Drop template_data column from job_estimate_items
-- Date: 2025-09-15
-- Purpose: Remove template_data column as all templates now use database-only lookup
-- This completes the transition to batch template loading with frontend caching

-- Check if the column exists before dropping it
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_name = 'job_estimate_items'
    AND column_name = 'template_data'
    AND table_schema = DATABASE()
);

-- Drop the column only if it exists
SET @sql = CASE
    WHEN @column_exists > 0 THEN
        'ALTER TABLE job_estimate_items DROP COLUMN template_data;'
    ELSE
        'SELECT "Column template_data does not exist, skipping..." as message;'
END;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the column was dropped
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN 'SUCCESS: template_data column has been dropped'
        ELSE 'ERROR: template_data column still exists'
    END as migration_result
FROM information_schema.columns
WHERE table_name = 'job_estimate_items'
    AND column_name = 'template_data'
    AND table_schema = DATABASE();