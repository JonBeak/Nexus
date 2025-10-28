-- QuickBooks Integration: Add estimate linking columns
-- Phase 2: Track QB estimates created from Nexus estimates
-- Created: 2025-10-27

-- Add QuickBooks estimate tracking to job_estimates table
ALTER TABLE job_estimates
ADD COLUMN qb_estimate_id VARCHAR(50) NULL COMMENT 'QuickBooks estimate ID',
ADD COLUMN sent_to_qb_at TIMESTAMP NULL COMMENT 'When estimate was sent to QuickBooks',
ADD INDEX idx_qb_estimate_id (qb_estimate_id);
