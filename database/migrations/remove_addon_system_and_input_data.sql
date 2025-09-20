-- Migration: Remove Addon System and input_data Column
-- Date: 2025-01-15
-- Purpose: Remove unused addon system (addon_types, job_item_addons) and redundant input_data column

-- Drop addon tables (job_item_addons first due to FK constraint)
DROP TABLE IF EXISTS job_item_addons;
DROP TABLE IF EXISTS addon_types;

-- Remove redundant input_data column from job_estimate_items
-- (grid_data column serves the same purpose and is actually used)
ALTER TABLE job_estimate_items DROP COLUMN input_data;