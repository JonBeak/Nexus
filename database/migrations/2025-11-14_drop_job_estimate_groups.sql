-- Migration: Drop job_estimate_groups table
-- Date: Nov 14, 2025
-- Reason: Legacy groups-based architecture completely replaced by grid system
--
-- Evidence:
-- - job_estimate_groups table has 0 rows (completely unused)
-- - No foreign keys from other tables reference this table
-- - assembly_group_id in job_estimate_items is NOT a foreign key to this table
-- - All estimate creation uses new grid system (gridDataService.ts)
-- - Frontend never implemented groups-based UI
-- - bulkEstimateService.ts archived (only service that wrote to this table)
--
-- Impact: ZERO - No production data, no references, no active code path
--
-- Rollback: Table structure backed up in archived/job_estimate_groups_backup_2025-11-14.sql

-- =============================================
-- SAFETY CHECKS
-- =============================================

-- Verify table is empty (should return 0)
SELECT COUNT(*) as row_count FROM job_estimate_groups;

-- Verify no tables reference this table (should return empty)
SELECT TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME = 'job_estimate_groups'
AND TABLE_SCHEMA = 'sign_manufacturing';

-- =============================================
-- DROP TABLE
-- =============================================

DROP TABLE IF EXISTS job_estimate_groups;

-- =============================================
-- VERIFICATION
-- =============================================

-- Verify table is gone
SHOW TABLES LIKE 'job_estimate_groups';  -- Should return empty

-- Verify job_estimates still exists
SELECT COUNT(*) as estimate_count FROM job_estimates;

-- Verify job_estimate_items still exists
SELECT COUNT(*) as item_count FROM job_estimate_items;
