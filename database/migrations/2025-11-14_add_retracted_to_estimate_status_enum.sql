-- Migration: Add 'retracted' to job_estimates status ENUM
-- Date: 2025-11-14
-- Purpose: Make status ENUM consistent with existing is_retracted boolean flag
--
-- Context: Technical debt - job_estimates has dual status tracking:
--   1. status ENUM ('draft', 'sent', 'approved', 'ordered', 'deactivated')
--   2. Boolean flags (is_draft, is_sent, is_approved, is_retracted)
--
-- This migration adds 'retracted' to the ENUM to maintain consistency
-- while both tracking mechanisms are in use. Future work will consolidate
-- to a single status mechanism.
--
-- Related TODO: /backend/web/src/repositories/estimateRepository.ts:21-28

-- Add 'retracted' to the status ENUM
ALTER TABLE job_estimates
MODIFY COLUMN status ENUM('draft', 'sent', 'approved', 'ordered', 'retracted', 'deactivated')
COLLATE utf8mb4_unicode_ci
DEFAULT 'draft'
COMMENT 'Estimate status - being migrated to replace boolean flags';

-- Optional: Update existing records where is_retracted=1 but status doesn't reflect it
-- (Only if status is still 'sent' or 'approved' but is_retracted=1)
UPDATE job_estimates
SET status = 'retracted'
WHERE is_retracted = 1
  AND status NOT IN ('ordered', 'deactivated');

-- Verify migration
SELECT
  COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'sign_manufacturing'
  AND TABLE_NAME = 'job_estimates'
  AND COLUMN_NAME = 'status';
