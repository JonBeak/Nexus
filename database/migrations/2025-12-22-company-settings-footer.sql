-- Migration: Populate company settings for email footer
-- Date: 2025-12-22
-- Description: Add/update company contact info in rbac_settings for dynamic email footers

-- Update/insert company settings for email footer
INSERT INTO rbac_settings (setting_name, setting_value, description)
VALUES
  ('company_name', 'Sign House Inc.', 'Company name for email footer'),
  ('company_phone', '(905) 760-2020', 'Company phone for email footer'),
  ('company_email', 'info@signhouse.ca', 'Company email for email footer'),
  ('company_address', '9-220 Viceroy Road, Concord, Ontario L4K 3C2', 'Company address for email footer'),
  ('company_website', 'https://www.signhouse.ca', 'Company website for email footer'),
  ('company_business_hours', 'Monday - Friday: 7:30 AM - 4:00 PM', 'Business hours for email footer')
ON DUPLICATE KEY UPDATE
  setting_value = VALUES(setting_value),
  description = VALUES(description);
