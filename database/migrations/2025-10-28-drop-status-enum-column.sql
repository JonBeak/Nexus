-- Migration: Drop deprecated status enum column from job_estimates
-- Date: 2025-10-28
-- Description: Complete the status migration by removing the deprecated status enum column.
--              The system now uses individual boolean flags (is_draft, is_sent, is_approved,
--              is_retracted, is_active) instead of the status enum.
--
-- IMPORTANT: Only run this migration after verifying:
-- 1. All frontend code has been updated to use boolean flags
-- 2. All backend services have been updated to use boolean flags
-- 3. The status column is no longer referenced anywhere in the codebase

-- Drop the deprecated status column
ALTER TABLE job_estimates
DROP COLUMN status;

-- Verify the migration
SELECT 'Migration complete: status column dropped from job_estimates' AS result;

-- Show remaining columns for verification
DESC job_estimates;
