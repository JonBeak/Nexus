-- Migration: Add QB Estimate URL to Job Estimates
-- Created: 2025-12-19
-- Purpose: Store QuickBooks estimate URL for email preview and traceability
-- Impact: Enables proper QB link display in email preview modal

-- Add qb_estimate_url column to job_estimates table
-- Matches the pattern used in order_qb_estimates table
-- Column placed after sent_to_qb_at for logical grouping
ALTER TABLE job_estimates
ADD COLUMN qb_estimate_url VARCHAR(500) DEFAULT NULL
COMMENT 'QuickBooks estimate URL for linking to QB'
AFTER sent_to_qb_at;

-- Add index for performance when filtering by QB estimate URL
ALTER TABLE job_estimates
ADD INDEX idx_qb_estimate_url (qb_estimate_url);

-- Verification query (optional - run manually to verify migration)
-- SELECT * FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_NAME = 'job_estimates'
-- AND COLUMN_NAME IN ('qb_estimate_id', 'qb_estimate_url', 'sent_to_qb_at');
