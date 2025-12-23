-- Email Composer Redesign - 3-Part Structure
-- Adds separate fields for beginning, end, and summary config

-- Add new columns to job_estimates
ALTER TABLE job_estimates
  ADD COLUMN email_beginning TEXT NULL AFTER email_body,
  ADD COLUMN email_end TEXT NULL AFTER email_beginning,
  ADD COLUMN email_summary_config JSON NULL AFTER email_end;

-- Migrate existing email_body to email_beginning (one-time migration)
UPDATE job_estimates
SET email_beginning = email_body
WHERE email_body IS NOT NULL AND email_beginning IS NULL;

-- Company settings for email footer
INSERT INTO rbac_settings (setting_name, setting_value, description)
VALUES
  ('company_name', 'The Sign House', 'Company name for email footer'),
  ('company_phone', '', 'Company phone for email footer'),
  ('company_email', '', 'Company email for email footer'),
  ('company_address', '', 'Company address for email footer')
ON DUPLICATE KEY UPDATE updated_at = NOW();
