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

-- 3. Add body_beginning and body_end columns to email_templates for split email body content
ALTER TABLE email_templates
ADD COLUMN body_beginning TEXT NULL AFTER body,
ADD COLUMN body_end TEXT NULL AFTER body_beginning;

-- 4. Update email template with complete subject and body values
UPDATE email_templates
SET
  subject = '{{jobNameWithRef}} - Estimate #{{qbEstimateNumber}} from Sign House Inc.',
  body_beginning = 'Hi {{customerName}},\n\nPlease find the attached estimate for your review.\n\nNOTE: This estimate is pending your approval. Please reply to confirm and we will verify all details before beginning production.',
  body_end = 'If you have any questions, please don''t hesitate to reach out.\n\nBest regards,\nThe Sign House Team'
WHERE template_key = 'estimate_send';
