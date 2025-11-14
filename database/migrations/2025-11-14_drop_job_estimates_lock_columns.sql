-- Migration: Drop unused lock columns from job_estimates table
-- Date: Nov 14, 2025
-- Reason: Phase 1 Cleanup - Remove legacy estimate-specific lock system
--
-- Context:
-- - Database evidence shows 0 locks ever used in these columns (195 estimates, all NULL)
-- - Active lock system uses resource_locks table (331 active locks)
-- - Frontend migrated to use generic lockService (resource_locks) instead
-- - Removed: editLockService.ts, editLockController.ts, lock routes from jobEstimation.ts
--
-- Columns to drop:
-- - editing_user_id: FK to users, always NULL
-- - editing_started_at: timestamp, always NULL
-- - editing_expires_at: timestamp, always NULL
-- - editing_locked_by_override: tinyint(1), always 0

-- Safety check: Verify no active locks before dropping columns
-- Expected: 0 (all should be NULL)
SELECT COUNT(*) as active_locks_count
FROM job_estimates
WHERE editing_user_id IS NOT NULL;

-- If the above returns 0, proceed with dropping columns
-- Otherwise, investigate why locks exist and migrate them to resource_locks first

-- Step 1: Drop foreign key constraint first
ALTER TABLE job_estimates
  DROP FOREIGN KEY fk_estimates_editing_user;

-- Step 2: Now drop the columns
ALTER TABLE job_estimates
  DROP COLUMN editing_user_id,
  DROP COLUMN editing_started_at,
  DROP COLUMN editing_expires_at,
  DROP COLUMN editing_locked_by_override;

-- Verification: Check table structure
SHOW CREATE TABLE job_estimates;
