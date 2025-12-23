-- Migration: Add customer_job_number to jobs table and qb_doc_number to job_estimates
-- Date: 2025-12-22
-- Purpose: Enable customer reference numbers in job estimation and QB estimate number display in emails

-- 1. Add customer reference number to jobs table
ALTER TABLE jobs
ADD COLUMN customer_job_number VARCHAR(100) DEFAULT NULL
COMMENT 'Customer-provided reference number (PO, project code)'
AFTER job_name;

CREATE INDEX idx_customer_job_number ON jobs(customer_job_number);

-- 2. Add QB doc number to job_estimates table (to display in email subject)
ALTER TABLE job_estimates
ADD COLUMN qb_doc_number VARCHAR(50) DEFAULT NULL
COMMENT 'QuickBooks estimate document number for display in emails'
AFTER qb_estimate_id;

-- 3. Update email template subject format
UPDATE email_templates
SET subject = '{{jobNameWithRef}} - Estimate #{{qbEstimateNumber}}'
WHERE template_key = 'estimate_send';
