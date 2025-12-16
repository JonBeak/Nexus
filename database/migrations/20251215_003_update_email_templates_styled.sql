-- =============================================================================
-- Migration: 20251215_003_update_email_templates_styled.sql
-- Purpose: Update email templates to match Order Confirmation email styling
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Update full_invoice template with professional styling
-- -----------------------------------------------------------------------------
UPDATE email_templates
SET body = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Invoice #{orderNumber}</title>

<style>
  /* ------------------------------ */
  /* Base Styles – Light Mode */
  /* ------------------------------ */
  body {
    margin: 0;
    padding: 0;
    background-color: #f5f6f8;
    color: #333;
    font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
  }

  a { color: #4F46E5; text-decoration: none; }

  .container {
    max-width: 600px;
    margin: 0 auto;
    border-radius: 6px;
    overflow: hidden;
    background: #ffffff;
  }

  .header {
    background: #334155;
    padding: 28px;
    text-align: center;
    color: #ffffff;
  }

  .header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }

  .content {
    padding: 28px 24px;
    background: #fafafa;
  }

  .greeting {
    margin: 0 0 18px 0;
    font-size: 16px;
    font-weight: normal;
  }

  .highlight-box {
    background: #ecfdf5;
    border-left: 4px solid #10b981;
    padding: 16px 18px;
    margin: 24px 0;
    border-radius: 4px;
    font-size: 15px;
  }

  .highlight-box strong {
    color: #065f46;
  }

  .highlight-box p {
    margin: 0;
    color: #065f46;
  }

  .cta-button {
    display: inline-block;
    background-color: #1a56db;
    color: #ffffff !important;
    padding: 14px 32px;
    text-decoration: none;
    border-radius: 5px;
    font-weight: 600;
    font-size: 16px;
  }

  p {
    margin: 0 0 18px 0;
    font-size: 15px;
  }

  .signature {
    margin-top: 28px;
    font-size: 15px;
  }

  .footer {
    margin-top: 40px;
    padding-top: 24px;
    border-top: 2px solid #e5e7eb;
    font-size: 13px;
    color: #6b7280;
    line-height: 1.8;
  }

  .footer a {
    color: #4F46E5;
    text-decoration: none;
  }

  .footer-company {
    font-weight: 600;
    font-size: 14px;
    color: #374151;
    margin-bottom: 8px;
  }

  .footer-item {
    margin: 4px 0;
  }

  /* ------------------------------ */
  /* Dark Mode */
  /* ------------------------------ */
  @media (prefers-color-scheme: dark) {
    body {
      background-color: #0f172a !important;
      color: #e2e8f0 !important;
    }

    .container {
      background: #1e293b !important;
      color: #e2e8f0 !important;
      border: 1px solid #334155;
    }

    .header {
      background: #1e293b !important;
      color: #f8fafc !important;
      border-bottom: 1px solid #334155;
    }

    .content {
      background: #1e293b !important;
      color: #e2e8f0 !important;
    }

    .highlight-box {
      background: #2b2e36 !important;
      border-left-color: #34d399 !important;
    }

    .highlight-box strong,
    .highlight-box p {
      color: #6ee7b7 !important;
    }

    a {
      color: #818cf8 !important;
    }

    .cta-button {
      background-color: #4F46E5 !important;
    }

    .footer {
      border-top-color: #334155 !important;
      color: #9ca3af !important;
    }

    .footer-company {
      color: #e2e8f0 !important;
    }

    .footer a {
      color: #818cf8 !important;
    }
  }
</style>
</head>

<body>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 24px 0;">
  <tr>
    <td align="center">

      <table class="container" role="presentation" width="100%" cellspacing="0" cellpadding="0">

        <!-- HEADER -->
        <tr>
          <td class="header">
            <h1>Invoice Ready</h1>
          </td>
        </tr>

        <!-- CONTENT -->
        <tr>
          <td class="content">

            <!-- Greeting -->
            <p class="greeting">Dear {customerName},</p>

            <!-- Main Message -->
            <p>Your order <strong>#{orderNumber}</strong> is complete and the invoice has been prepared.</p>

            <!-- Invoice Details Box -->
            <div class="highlight-box">
              <p><strong>Invoice Total: {invoiceTotal}</strong></p>
              <p style="margin-top: 5px;">Due Date: {dueDate}</p>
            </div>

            <p>Please review and pay your invoice using the button below:</p>

            <!-- CTA Button -->
            <p style="text-align: center; margin: 28px 0;">
              <a href="{qbInvoiceUrl}" class="cta-button">View &amp; Pay Invoice</a>
            </p>

            <p>Thank you for your business!</p>

            <!-- Signature -->
            <p class="signature">
              Best regards,<br>
              The Sign House Team
            </p>

            <!-- Footer -->
            <div class="footer">
              <div class="footer-company">Sign House Inc.</div>
              <div class="footer-item">Phone: (905) 760-2020</div>
              <div class="footer-item">Email: <a href="mailto:info@signhouse.ca">info@signhouse.ca</a></div>
              <div class="footer-item">Web: <a href="https://signhouse.ca">signhouse.ca</a></div>
            </div>

          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>',
    updated_at = NOW()
WHERE template_key = 'full_invoice';

-- -----------------------------------------------------------------------------
-- Update deposit_request template with professional styling
-- -----------------------------------------------------------------------------
UPDATE email_templates
SET body = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Deposit Required - Order #{orderNumber}</title>

<style>
  /* ------------------------------ */
  /* Base Styles – Light Mode */
  /* ------------------------------ */
  body {
    margin: 0;
    padding: 0;
    background-color: #f5f6f8;
    color: #333;
    font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
  }

  a { color: #4F46E5; text-decoration: none; }

  .container {
    max-width: 600px;
    margin: 0 auto;
    border-radius: 6px;
    overflow: hidden;
    background: #ffffff;
  }

  .header {
    background: #334155;
    padding: 28px;
    text-align: center;
    color: #ffffff;
  }

  .header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }

  .content {
    padding: 28px 24px;
    background: #fafafa;
  }

  .greeting {
    margin: 0 0 18px 0;
    font-size: 16px;
    font-weight: normal;
  }

  .urgency-box {
    background: #fef3c7;
    border-left: 4px solid #f59e0b;
    padding: 16px 18px;
    margin: 24px 0;
    border-radius: 4px;
    font-size: 15px;
  }

  .urgency-box strong {
    color: #92400e;
  }

  .urgency-box p {
    margin: 0;
    color: #92400e;
  }

  .cta-button {
    display: inline-block;
    background-color: #1a56db;
    color: #ffffff !important;
    padding: 14px 32px;
    text-decoration: none;
    border-radius: 5px;
    font-weight: 600;
    font-size: 16px;
  }

  p {
    margin: 0 0 18px 0;
    font-size: 15px;
  }

  .signature {
    margin-top: 28px;
    font-size: 15px;
  }

  .footer {
    margin-top: 40px;
    padding-top: 24px;
    border-top: 2px solid #e5e7eb;
    font-size: 13px;
    color: #6b7280;
    line-height: 1.8;
  }

  .footer a {
    color: #4F46E5;
    text-decoration: none;
  }

  .footer-company {
    font-weight: 600;
    font-size: 14px;
    color: #374151;
    margin-bottom: 8px;
  }

  .footer-item {
    margin: 4px 0;
  }

  /* ------------------------------ */
  /* Dark Mode */
  /* ------------------------------ */
  @media (prefers-color-scheme: dark) {
    body {
      background-color: #0f172a !important;
      color: #e2e8f0 !important;
    }

    .container {
      background: #1e293b !important;
      color: #e2e8f0 !important;
      border: 1px solid #334155;
    }

    .header {
      background: #1e293b !important;
      color: #f8fafc !important;
      border-bottom: 1px solid #334155;
    }

    .content {
      background: #1e293b !important;
      color: #e2e8f0 !important;
    }

    .urgency-box {
      background: #2b2e36 !important;
      border-left-color: #fbbf24 !important;
    }

    .urgency-box strong,
    .urgency-box p {
      color: #fcd34d !important;
    }

    a {
      color: #818cf8 !important;
    }

    .cta-button {
      background-color: #4F46E5 !important;
    }

    .footer {
      border-top-color: #334155 !important;
      color: #9ca3af !important;
    }

    .footer-company {
      color: #e2e8f0 !important;
    }

    .footer a {
      color: #818cf8 !important;
    }
  }
</style>
</head>

<body>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 24px 0;">
  <tr>
    <td align="center">

      <table class="container" role="presentation" width="100%" cellspacing="0" cellpadding="0">

        <!-- HEADER -->
        <tr>
          <td class="header">
            <h1>Deposit Required</h1>
          </td>
        </tr>

        <!-- CONTENT -->
        <tr>
          <td class="content">

            <!-- Greeting -->
            <p class="greeting">Dear {customerName},</p>

            <!-- Main Message -->
            <p>Thank you for your order <strong>#{orderNumber}</strong>. Before we begin production, a <strong>50% deposit</strong> is required.</p>

            <!-- Deposit Details Box -->
            <div class="urgency-box">
              <p><strong>Deposit Amount: {depositAmount}</strong></p>
              <p style="margin-top: 5px;">Invoice Total: {invoiceTotal}</p>
            </div>

            <p>Please review and pay your deposit using the button below:</p>

            <!-- CTA Button -->
            <p style="text-align: center; margin: 28px 0;">
              <a href="{qbInvoiceUrl}" class="cta-button">View Invoice</a>
            </p>

            <p>Once the deposit is received, we will begin production on your order.</p>

            <p>If you have any questions, please don''t hesitate to contact us.</p>

            <!-- Signature -->
            <p class="signature">
              Best regards,<br>
              The Sign House Team
            </p>

            <!-- Footer -->
            <div class="footer">
              <div class="footer-company">Sign House Inc.</div>
              <div class="footer-item">Phone: (905) 760-2020</div>
              <div class="footer-item">Email: <a href="mailto:info@signhouse.ca">info@signhouse.ca</a></div>
              <div class="footer-item">Web: <a href="https://signhouse.ca">signhouse.ca</a></div>
            </div>

          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>',
    updated_at = NOW()
WHERE template_key = 'deposit_request';
