-- Phase 2.e: QuickBooks Invoice Automation
-- Created: 2025-12-13
-- Description: Add QB invoice columns to orders, create scheduled_emails and email_templates tables

-- ============================================
-- 1. Add QB Invoice columns to orders table
-- ============================================

ALTER TABLE orders
  ADD COLUMN qb_invoice_id VARCHAR(50) DEFAULT NULL COMMENT 'QuickBooks invoice ID',
  ADD COLUMN qb_invoice_doc_number VARCHAR(50) DEFAULT NULL COMMENT 'QB invoice document number',
  ADD COLUMN qb_invoice_url VARCHAR(500) DEFAULT NULL COMMENT 'QuickBooks invoice URL',
  ADD COLUMN qb_invoice_synced_at DATETIME DEFAULT NULL COMMENT 'When invoice was last synced to QB',
  ADD COLUMN qb_invoice_data_hash VARCHAR(64) DEFAULT NULL COMMENT 'SHA256 hash for staleness detection',
  ADD COLUMN invoice_sent_at DATETIME DEFAULT NULL COMMENT 'When invoice email was sent to customer';

-- Unique index to ensure one QB invoice per order (and prevent linking same invoice to multiple orders)
CREATE UNIQUE INDEX idx_orders_qb_invoice_id ON orders(qb_invoice_id);

-- ============================================
-- 2. Create scheduled_emails table
-- ============================================

CREATE TABLE scheduled_emails (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  email_type ENUM('deposit_request', 'full_invoice', 'reminder') NOT NULL COMMENT 'Type of invoice email',
  recipient_emails JSON NOT NULL COMMENT 'Array of recipient email addresses',
  cc_emails JSON DEFAULT NULL COMMENT 'Array of CC email addresses',
  subject VARCHAR(500) NOT NULL COMMENT 'Email subject line',
  body TEXT NOT NULL COMMENT 'Email body (HTML)',
  scheduled_for DATETIME NOT NULL COMMENT 'When to send the email',
  status ENUM('pending', 'sent', 'cancelled', 'failed') NOT NULL DEFAULT 'pending',
  sent_at DATETIME DEFAULT NULL COMMENT 'When email was actually sent',
  error_message TEXT DEFAULT NULL COMMENT 'Error details if sending failed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL COMMENT 'User who scheduled the email',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_scheduled_emails_order (order_id),
  INDEX idx_scheduled_emails_status_time (status, scheduled_for),
  INDEX idx_scheduled_emails_created_by (created_by),

  CONSTRAINT fk_scheduled_emails_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_scheduled_emails_user
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Scheduled invoice emails for orders';

-- ============================================
-- 3. Create email_templates table
-- ============================================

CREATE TABLE email_templates (
  id INT NOT NULL AUTO_INCREMENT,
  template_key VARCHAR(50) NOT NULL COMMENT 'Unique identifier for template',
  template_name VARCHAR(100) NOT NULL COMMENT 'Human-readable name',
  subject VARCHAR(500) NOT NULL COMMENT 'Subject line template with {variables}',
  body TEXT NOT NULL COMMENT 'HTML body template with {variables}',
  variables JSON DEFAULT NULL COMMENT 'List of available merge variables',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE INDEX idx_email_templates_key (template_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Email templates for invoice communications';

-- ============================================
-- 4. Seed default email templates
-- ============================================

INSERT INTO email_templates (template_key, template_name, subject, body, variables) VALUES
(
  'deposit_request',
  '50% Deposit Request',
  'Invoice #{orderNumber} - Deposit Required | {customerName}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deposit Required</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h1 style="color: #1a56db; margin: 0 0 10px 0; font-size: 24px;">Deposit Required</h1>
    <p style="margin: 0; color: #666;">Order #{orderNumber} for {customerName}</p>
  </div>

  <p>Hello,</p>

  <p>Thank you for your order. Before we begin production, a <strong>50% deposit</strong> is required.</p>

  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
    <p style="margin: 0; font-weight: bold; color: #92400e;">Deposit Amount: ${depositAmount}</p>
    <p style="margin: 5px 0 0 0; color: #92400e;">Invoice Total: ${invoiceTotal}</p>
  </div>

  <p>Please review and pay your invoice using the link below:</p>

  <p style="text-align: center; margin: 25px 0;">
    <a href="{qbInvoiceUrl}" style="background-color: #1a56db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Invoice</a>
  </p>

  <p>Once the deposit is received, we will begin production on your order.</p>

  <p>If you have any questions, please don''t hesitate to contact us.</p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="color: #666; font-size: 14px;">
    Best regards,<br>
    <strong>Sign House Inc.</strong><br>
    Phone: (905) 760-2020<br>
    Email: info@signhouse.ca
  </p>
</body>
</html>',
  '["orderNumber", "customerName", "invoiceTotal", "depositAmount", "qbInvoiceUrl"]'
),
(
  'full_invoice',
  'Full Invoice',
  'Invoice #{orderNumber} | {customerName}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h1 style="color: #1a56db; margin: 0 0 10px 0; font-size: 24px;">Invoice Ready</h1>
    <p style="margin: 0; color: #666;">Order #{orderNumber} for {customerName}</p>
  </div>

  <p>Hello,</p>

  <p>Your order is ready and the invoice has been prepared.</p>

  <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
    <p style="margin: 0; font-weight: bold; color: #065f46;">Invoice Total: ${invoiceTotal}</p>
    <p style="margin: 5px 0 0 0; color: #065f46;">Due Date: {dueDate}</p>
  </div>

  <p>Please review and pay your invoice using the link below:</p>

  <p style="text-align: center; margin: 25px 0;">
    <a href="{qbInvoiceUrl}" style="background-color: #1a56db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View & Pay Invoice</a>
  </p>

  <p>Thank you for your business!</p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="color: #666; font-size: 14px;">
    Best regards,<br>
    <strong>Sign House Inc.</strong><br>
    Phone: (905) 760-2020<br>
    Email: info@signhouse.ca
  </p>
</body>
</html>',
  '["orderNumber", "customerName", "invoiceTotal", "dueDate", "qbInvoiceUrl"]'
);

-- ============================================
-- Verification queries (run manually)
-- ============================================
-- DESCRIBE orders;
-- SELECT * FROM scheduled_emails LIMIT 1;
-- SELECT * FROM email_templates;
