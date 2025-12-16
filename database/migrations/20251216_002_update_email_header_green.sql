-- =============================================================================
-- Migration: 20251216_002_update_email_header_green.sql
-- Purpose: Update email header color to QuickBooks-style money green
-- =============================================================================

-- Update full_invoice template header color
UPDATE email_templates
SET body = REPLACE(body, 'background: #334155;', 'background: #2CA01C;'),
    updated_at = NOW()
WHERE template_key = 'full_invoice';

-- Update deposit_request template header color
UPDATE email_templates
SET body = REPLACE(body, 'background: #334155;', 'background: #2CA01C;'),
    updated_at = NOW()
WHERE template_key = 'deposit_request';

-- Update CTA button to darker green
UPDATE email_templates
SET body = REPLACE(body, 'background-color: #1a56db;', 'background-color: #15803d;'),
    updated_at = NOW()
WHERE template_key IN ('full_invoice', 'deposit_request');

-- Update dark mode CTA button to darker green
UPDATE email_templates
SET body = REPLACE(body, '.cta-button {\n      background-color: #4F46E5 !important;', '.cta-button {\n      background-color: #1a7c14 !important;'),
    updated_at = NOW()
WHERE template_key IN ('full_invoice', 'deposit_request');

-- Add orderDetailsBlock (Job Name, PO#, Job#) above Invoice Total in full_invoice
UPDATE email_templates
SET body = REPLACE(body,
  '<div class="highlight-box">\n              <p><strong>Invoice Total: {invoiceTotal}</strong></p>',
  '<div class="highlight-box">\n              {orderDetailsBlock}<p><strong>Invoice Total: {invoiceTotal}</strong></p>'),
    updated_at = NOW()
WHERE template_key = 'full_invoice';

-- Add subjectSuffix (PO#, Job#) to email subject
UPDATE email_templates
SET subject = '{orderName} | Invoice #{orderNumber}{subjectSuffix}',
    updated_at = NOW()
WHERE template_key = 'full_invoice';
