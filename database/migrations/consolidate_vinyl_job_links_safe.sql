-- Safe Migration: Consolidate vinyl_job_links table
-- Date: 2025-09-10
-- Purpose: Remove link_type distinction and unify all job associations

-- Step 1: Create backup table
CREATE TABLE vinyl_job_links_backup AS 
SELECT * FROM vinyl_job_links;

-- Step 2: Create a temporary column to mark rows for resequencing
ALTER TABLE vinyl_job_links ADD COLUMN temp_sequence int DEFAULT NULL;

-- Step 3: Resequence all records per vinyl_id
-- We'll do this with a safer approach using session variables
SET @row_number = 0;
SET @prev_vinyl_id = -1;

UPDATE vinyl_job_links 
SET temp_sequence = (
  CASE 
    WHEN @prev_vinyl_id != vinyl_id THEN (@row_number := 1, @prev_vinyl_id := vinyl_id, 1)
    ELSE (@row_number := @row_number + 1)
  END
)
ORDER BY vinyl_id, created_at;

-- Step 4: Update the actual sequence_order column
UPDATE vinyl_job_links SET sequence_order = temp_sequence;

-- Step 5: Drop the temporary column
ALTER TABLE vinyl_job_links DROP COLUMN temp_sequence;

-- Step 6: Remove the link_type column
ALTER TABLE vinyl_job_links DROP COLUMN link_type;

-- Step 7: Add comment
ALTER TABLE vinyl_job_links COMMENT = 'Unified vinyl-job associations. All job links are now treated equally regardless of origin.';