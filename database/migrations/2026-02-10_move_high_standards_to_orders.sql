-- Migration: Move high_standards from job_estimates to orders
-- Date: 2026-02-10
-- Reason: high_standards override belongs at order level, not estimate level

-- Step 1: Add column to orders table
ALTER TABLE orders ADD COLUMN high_standards TINYINT(1) DEFAULT NULL;

-- Step 2: Backfill from job_estimates where override was set
UPDATE orders o
LEFT JOIN job_estimates je ON o.estimate_id = je.id
SET o.high_standards = je.high_standards
WHERE je.high_standards IS NOT NULL;

-- Step 3: Drop column from job_estimates
ALTER TABLE job_estimates DROP COLUMN high_standards;
