-- Migration: Add {balanceLine} to email templates
-- Purpose: Show remaining balance when it differs from invoice total (partial payments)
-- Date: 2025-12-16
-- Status: APPLIED

-- Update full_invoice template: add $ prefix and {balanceLine} placeholder
UPDATE email_templates
SET body = REPLACE(
    body,
    '<p><strong>Invoice Total: {invoiceTotal}</strong></p>',
    '<p><strong>Invoice Total: ${invoiceTotal}</strong></p>{balanceLine}'
)
WHERE template_key = 'full_invoice';

-- Update deposit_request template: add $ prefix and {balanceLine} placeholder
UPDATE email_templates
SET body = REPLACE(
    body,
    '<p style="margin-top: 5px;">Invoice Total: {invoiceTotal}</p>',
    '<p style="margin-top: 5px;">Invoice Total: ${invoiceTotal}</p>{balanceLine}'
)
WHERE template_key = 'deposit_request';

-- The {balanceLine} variable is populated in invoiceEmailService.ts
-- It shows "Amount Due: $X.XX" in red when balance differs from total (partial payment made)
-- When balance equals total, it's an empty string and nothing extra is shown
