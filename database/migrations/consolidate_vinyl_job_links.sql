-- Migration: Consolidate vinyl_job_links table
-- Date: 2025-09-10
-- Purpose: Remove link_type distinction and unify all job associations
-- This fixes the issue where different UIs show different job associations

-- Step 1: Create a backup table with current data
CREATE TABLE vinyl_job_links_backup AS 
SELECT * FROM vinyl_job_links;

-- Step 2: Resequence all associations per vinyl_id to eliminate gaps
-- and consolidate all link_types into a single sequence
SET @row_number = 0;
SET @prev_vinyl_id = 0;

UPDATE vinyl_job_links 
SET sequence_order = (
  SELECT @row_number := CASE 
    WHEN @prev_vinyl_id = vinyl_id THEN @row_number + 1 
    ELSE 1 
  END,
  @prev_vinyl_id := vinyl_id,
  @row_number
)
WHERE vinyl_id = (
  SELECT vinyl_id 
  FROM (SELECT vinyl_id FROM vinyl_job_links ORDER BY vinyl_id, created_at) t 
  WHERE t.vinyl_id = vinyl_job_links.vinyl_id 
  LIMIT 1
);

-- Step 3: Remove the link_type column since all associations are now unified
ALTER TABLE vinyl_job_links DROP COLUMN link_type;

-- Step 4: Add a comment to document the change
ALTER TABLE vinyl_job_links COMMENT = 'Unified vinyl-job associations. All job links are now treated equally regardless of origin.';

-- Verification queries (for manual checking after migration):
-- SELECT COUNT(*) as total_links FROM vinyl_job_links;
-- SELECT vinyl_id, COUNT(*) as job_count FROM vinyl_job_links GROUP BY vinyl_id;
-- SELECT * FROM vinyl_job_links ORDER BY vinyl_id, sequence_order;