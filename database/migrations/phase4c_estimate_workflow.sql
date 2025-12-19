-- Phase 4c: Estimate Workflow Redesign
-- - New estimate_point_persons table
-- - Add is_prepared, email_subject, email_body columns to job_estimates
-- - Add estimate_send email template

-- =====================================================
-- 1. Create estimate_point_persons table
-- =====================================================
CREATE TABLE IF NOT EXISTS estimate_point_persons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  estimate_id INT NOT NULL,
  contact_id INT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NULL,
  contact_phone VARCHAR(50) NULL,
  contact_role VARCHAR(100) NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (estimate_id) REFERENCES job_estimates(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES customer_contacts(contact_id) ON DELETE SET NULL,
  INDEX idx_estimate_id (estimate_id)
);

-- =====================================================
-- 2. Add columns to job_estimates table
-- =====================================================
-- Add is_prepared column (locked but not yet sent to QB)
ALTER TABLE job_estimates
  ADD COLUMN is_prepared TINYINT(1) NOT NULL DEFAULT 0 AFTER is_draft;

-- Add email composition fields
ALTER TABLE job_estimates
  ADD COLUMN email_subject VARCHAR(500) NULL AFTER notes,
  ADD COLUMN email_body TEXT NULL AFTER email_subject;

-- =====================================================
-- 3. Add estimate_send email template
-- =====================================================
INSERT INTO email_templates (template_key, template_name, subject, body, variables, is_active)
VALUES (
  'estimate_send',
  'Estimate - Send to Customer',
  '[Quote Ready] {{jobName}} - {{customerName}}',
  'Dear {{customerName}},\n\nPlease find attached the estimate for {{jobName}}.\n\nIf you have any questions, please don''t hesitate to reach out.\n\nThank you for your business!\n\nBest regards,\nThe Sign House Team',
  '["customerName", "jobName", "estimateNumber", "total"]',
  1
)
ON DUPLICATE KEY UPDATE
  template_name = VALUES(template_name),
  subject = VALUES(subject),
  body = VALUES(body),
  variables = VALUES(variables);
