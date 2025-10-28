-- Migration: Simplify Estimate Status Architecture
-- Date: 2025-10-27
-- Purpose: Replace status enum with is_active flag for single source of truth

-- Step 1: Add is_active column (default to active)
ALTER TABLE job_estimates
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER is_draft;

-- Step 2: Set is_active based on current status
-- Deactivated estimates become inactive, all others stay active
UPDATE job_estimates
SET is_active = FALSE
WHERE status = 'deactivated';

-- Step 3: Verify data integrity - all active estimates should have at least one status flag
-- This query should return 0 rows after migration
SELECT id, version_number, is_active, is_draft, is_sent, is_approved, is_retracted, status
FROM job_estimates
WHERE is_active = TRUE
  AND is_draft = FALSE
  AND is_sent = FALSE
  AND is_approved = FALSE
  AND is_retracted = FALSE;

-- Step 4: Add index for performance
CREATE INDEX idx_is_active ON job_estimates(is_active);

-- Step 5: Add check constraint to ensure active estimates have at least one status flag
ALTER TABLE job_estimates
ADD CONSTRAINT chk_active_has_status CHECK (
  is_active = FALSE OR
  is_draft = TRUE OR
  is_sent = TRUE OR
  is_approved = TRUE OR
  is_retracted = TRUE
);

-- Step 6 (FUTURE): Drop status column once all code is updated
-- ALTER TABLE job_estimates DROP COLUMN status;

-- Rollback script (if needed):
-- ALTER TABLE job_estimates DROP CONSTRAINT chk_active_has_status;
-- DROP INDEX idx_is_active ON job_estimates;
-- ALTER TABLE job_estimates DROP COLUMN is_active;
