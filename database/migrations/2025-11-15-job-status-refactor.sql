-- Migration: Refactor jobs.status to match estimate lifecycle
-- Date: 2025-11-15
-- Purpose: Fix Jobs panel to show correct status based on estimate states
--
-- Status priority (highest to lowest): approved > sent > draft
-- Trigger recalculates job status based on ALL estimates for the job

-- Step 1: Add 'draft' and 'sent' to enum temporarily (if not already there)
ALTER TABLE jobs
  MODIFY COLUMN status ENUM('quote', 'draft', 'sent', 'approved', 'active', 'production', 'completed', 'cancelled')
  DEFAULT 'quote'
  NOT NULL;

-- Step 2: Convert 'quote' to 'draft'
UPDATE jobs SET status = 'draft' WHERE status = 'quote';

-- Step 3: Remove old unused values from enum
ALTER TABLE jobs
  MODIFY COLUMN status ENUM('draft', 'sent', 'approved')
  DEFAULT 'draft'
  NOT NULL;

-- Step 4: Backfill existing data based on estimates
-- Set to 'approved' if any estimate has is_approved = 1
UPDATE jobs j
  SET j.status = 'approved'
  WHERE EXISTS (
    SELECT 1 FROM job_estimates e
    WHERE e.job_id = j.job_id AND e.is_approved = 1
  );

-- Set to 'sent' if any estimate has is_sent = 1 (but not approved)
UPDATE jobs j
  SET j.status = 'sent'
  WHERE j.status = 'draft'
    AND EXISTS (
      SELECT 1 FROM job_estimates e
      WHERE e.job_id = j.job_id AND e.is_sent = 1
    );

-- Step 5: Create trigger to keep status in sync with estimate states
DELIMITER $$

DROP TRIGGER IF EXISTS tr_job_estimates_update_job_status$$

CREATE TRIGGER tr_job_estimates_update_job_status
AFTER UPDATE ON job_estimates
FOR EACH ROW
BEGIN
  DECLARE new_job_status VARCHAR(20);

  -- Only proceed if is_sent or is_approved changed
  IF (NEW.is_sent != OLD.is_sent OR NEW.is_approved != OLD.is_approved) THEN

    -- Calculate new status based on ALL estimates for this job
    -- Priority: approved > sent > draft
    SELECT
      CASE
        WHEN MAX(is_approved) = 1 THEN 'approved'
        WHEN MAX(is_sent) = 1 THEN 'sent'
        ELSE 'draft'
      END INTO new_job_status
    FROM job_estimates
    WHERE job_id = NEW.job_id;

    -- Update job status (allows both upgrades and downgrades)
    UPDATE jobs
    SET status = new_job_status, updated_at = NOW()
    WHERE job_id = NEW.job_id;

  END IF;
END$$

DELIMITER ;

-- Verification queries
SELECT 'Migration complete. Job status distribution:' as message;
SELECT
  status,
  COUNT(*) as count
FROM jobs
GROUP BY status
ORDER BY FIELD(status, 'approved', 'sent', 'draft');

-- Show sample of updated jobs with their estimate states
SELECT
  j.job_id,
  j.job_name,
  j.status as job_status,
  COUNT(e.id) as estimate_count,
  SUM(e.is_approved) as approved_count,
  SUM(e.is_sent) as sent_count
FROM jobs j
LEFT JOIN job_estimates e ON j.job_id = e.job_id
GROUP BY j.job_id, j.job_name, j.status
HAVING estimate_count > 0
ORDER BY j.created_at DESC
LIMIT 10;
