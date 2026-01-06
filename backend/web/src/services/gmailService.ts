/**
 * Gmail Service - PRODUCTION IMPLEMENTATION
 * Phase 2: Gmail API Integration
 *
 * Sends real emails via Gmail API using service account authentication.
 * Fetches PDFs from URLs and attaches them to emails.
 *
 * Features:
 * - Real Gmail API integration with service account auth
 * - PDF attachment handling (fetch from URLs, embed as base64)
 * - Customer name personalization
 * - HTML + plain text email versions
 * - Retry logic with exponential backoff
 * - Comprehensive error handling
 * - Feature flag for gradual rollout (GMAIL_ENABLED)
 */

import { createGmailClient } from './gmailAuthService';
import axios from 'axios';
import MailComposer from 'nodemailer/lib/mail-composer';
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

export interface EmailData {
  recipients: string[];
  ccRecipients?: string[];
  bccRecipients?: string[];
  orderNumber: number;
  orderName: string;
  customerName?: string;
  pdfUrls: {
    orderForm: string | null;
    qbEstimate: string | null;
  };
  // New: customizable email content
  emailContent?: OrderEmailContent;
}

// Order confirmation email content structure
export interface OrderEmailContent {
  subject: string;
  beginning: string;
  includeActionRequired: boolean;
  includeAttachments: boolean;
  end: string;
}

// Company settings loaded from database
interface CompanySettings {
  company_name: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_address: string | null;
  company_website: string | null;
  company_business_hours: string | null;
  company_logo_base64: string | null;
}

export interface EmailResult {
  success: boolean;
  message: string;
  messageId?: string;
  error?: string;
}

export interface EstimateEmailData {
  recipients: string[];  // Main recipients (To:) - kept for backward compatibility
  ccRecipients?: string[];  // CC recipients
  bccRecipients?: string[];  // BCC recipients (in addition to GMAIL_BCC_EMAIL)
  estimateId: number;
  estimateNumber: string;
  estimateName: string;
  customerName?: string;
  subject: string;
  body: string;
  qbEstimateUrl: string | null;
  pdfPath: string | null;
}

// Gmail API Configuration
const GMAIL_ENABLED = process.env.GMAIL_ENABLED === 'true';
const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || 'info@signhouse.ca';
const SENDER_NAME = process.env.GMAIL_SENDER_NAME || 'Sign House';
// BCC Email - Automatically BCC on all sent emails
// To disable: Remove GMAIL_BCC_EMAIL from .env or set to empty string
// Future enhancement: Support multiple BCC emails (comma-separated)
const BCC_EMAIL = process.env.GMAIL_BCC_EMAIL || '';

// Company Contact Information (Email Footer) - Fallback from env
const COMPANY_NAME = process.env.COMPANY_NAME;
const COMPANY_PHONE = process.env.COMPANY_PHONE;
const COMPANY_EMAIL = process.env.COMPANY_EMAIL;
const COMPANY_WEBSITE = process.env.COMPANY_WEBSITE;
const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS;
const COMPANY_BUSINESS_HOURS = process.env.COMPANY_BUSINESS_HOURS;

// Navy blue color scheme for orders
const ORDER_COLORS = {
  primary: '#1e3a5f',      // Navy blue - main border/accent
  primaryLight: '#2d4a6f', // Lighter navy for hover
  header: '#1e3a5f',       // Navy header background
  headerText: '#ffffff',   // White text on header
  border: '#1e3a5f',       // Navy border
  accent: '#3b5998',       // Slightly lighter accent
  footer: '#f8fafc',       // Light footer background
  urgency: '#dc2626',      // Red for action required
  attachments: '#1e3a5f'   // Navy for attachments section
};

/**
 * Load company settings from database (rbac_settings table)
 * Falls back to environment variables if database values not found
 */
async function loadCompanySettings(): Promise<CompanySettings> {
  try {
    const rows = await query(
      `SELECT setting_name, setting_value FROM rbac_settings
       WHERE setting_name IN ('company_name', 'company_phone', 'company_email', 'company_address', 'company_website', 'company_business_hours', 'company_logo_base64')`,
      []
    ) as RowDataPacket[];

    const settings: CompanySettings = {
      company_name: COMPANY_NAME || null,
      company_phone: COMPANY_PHONE || null,
      company_email: COMPANY_EMAIL || null,
      company_address: COMPANY_ADDRESS || null,
      company_website: COMPANY_WEBSITE || null,
      company_business_hours: COMPANY_BUSINESS_HOURS || null,
      company_logo_base64: null
    };

    // Override with database values if present
    for (const row of rows) {
      const key = row.setting_name as keyof CompanySettings;
      if (row.setting_value) {
        settings[key] = row.setting_value;
      }
    }

    return settings;
  } catch (error) {
    console.error('[Gmail] Error loading company settings:', error);
    // Return fallback from env vars
    return {
      company_name: COMPANY_NAME || null,
      company_phone: COMPANY_PHONE || null,
      company_email: COMPANY_EMAIL || null,
      company_address: COMPANY_ADDRESS || null,
      company_website: COMPANY_WEBSITE || null,
      company_business_hours: COMPANY_BUSINESS_HOURS || null,
      company_logo_base64: null
    };
  }
}

/**
 * Substitute template variables in email content
 * Variables: {{customerName}}, {{orderNumber}}, {{orderName}}
 */
function substituteOrderVariables(template: string, data: EmailData): string {
  return template
    .replace(/\{\{customerName\}\}/g, data.customerName || 'Valued Customer')
    .replace(/\{\{orderNumber\}\}/g, String(data.orderNumber))
    .replace(/\{\{orderName\}\}/g, data.orderName || '');
}

/**
 * Build email template for order finalization
 *
 * Uses SINGLE SOURCE OF TRUTH for content - HTML and plain text are generated
 * from the same content structure to ensure they always stay in sync.
 *
 * @param data - Email data including order info and attachments
 * @returns HTML email template with subject and plain text version
 */
function buildEmailTemplate(data: EmailData): { subject: string; html: string; text: string } {
  // ============================================================================
  // SINGLE SOURCE OF TRUTH - All email content defined here
  // ============================================================================
 
  const content = {
    subject: `[Requires Confirmation] ${data.orderName} - #${data.orderNumber}`,
    title: 'Order Ready for Review',
    greeting: data.customerName ? `Dear ${data.customerName},` : 'Dear Valued Customer,',

    paragraphs: [
      `The details for your order #${data.orderNumber} - ${data.orderName} have been prepared and are ready for your review and confirmation.`
    ],

    attachmentsTitle: 'Attached Documents:',
    attachments: [
      data.pdfUrls.orderForm ? 'Specifications Order Form' : null,
      data.pdfUrls.qbEstimate ? 'QuickBooks Estimate' : null
    ].filter(Boolean) as string[],

    urgencyBox: {
      title: '⚠ Action Required:',
      message: 'Please review and confirm your order promptly so we can begin production.'
    },

    closingParagraphs: [
      `If you have any questions or need changes, please reply to this email or contact us directly.`,
      `Thank you for your business!`
    ],

    signature: {
      line1: 'Best regards,',
      line2: 'The Sign House Team'
    },

    footer: {
      companyName: COMPANY_NAME,
      phone: COMPANY_PHONE,
      email: COMPANY_EMAIL,
      website: COMPANY_WEBSITE,
      address: COMPANY_ADDRESS,
      businessHours: COMPANY_BUSINESS_HOURS
    }
  };

  // ============================================================================
  // HTML Version - Generated from content structure
  // ============================================================================

  const html = `
  <!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${content.subject}</title>

<style>
  /* ------------------------------ */
  /* Base Styles – Light Mode */
  /* ------------------------------ */
  body {
    margin: 0;
    padding: 0;
    background-color: #f5f6f8;
    color: #333;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
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
    background: #fff5f5;
    border-left: 4px solid #dc2626;
    padding: 16px 18px;
    margin: 24px 0;
    border-radius: 4px;
    font-size: 15px;
  }

  .attachments {
    background: #ffffff;
    border-left: 4px solid #4F46E5;
    padding: 16px 18px;
    margin: 24px 0;
    border-radius: 4px;
    font-size: 15px;
  }

  .attachments h3 {
    margin: 0 0 10px 0;
    font-size: 16px;
    font-weight: 600;
  }

  /* Paragraph styling */
  p {
    margin: 0 0 18px 0;
    font-size: 15px;
  }

  /* Signature */
  .signature {
    margin-top: 28px;
    font-size: 15px;
  }

  /* Footer */
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

  .footer a:hover {
    text-decoration: underline;
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
      border-left-color: #f87171 !important;
      color: #fca5a5 !important;
    }

    .attachments {
      background: #2b2e36 !important;
      border-left-color: #818cf8 !important;
      color: #e2e8f0 !important;
    }

    a {
      color: #818cf8 !important;
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
            <h1>${content.title}</h1>
          </td>
        </tr>

        <!-- CONTENT -->
        <tr>
          <td class="content">

            <!-- Greeting -->
            <p class="greeting">${content.greeting}</p>

            <!-- Main Paragraphs -->
            ${content.paragraphs
              .map(
                p => `<p>${p}</p>`
              )
              .join("")}

            <!-- Urgency Box -->
            <div class="urgency-box">
              <strong>${content.urgencyBox.title}</strong><br>
              ${content.urgencyBox.message}
            </div>

            <!-- Attachments -->
            <div class="attachments">
              <h3>📎 ${content.attachmentsTitle}</h3>
              <ul style="margin:0; padding-left:20px; line-height:1.6;">
                ${content.attachments.map(a => `<li>${a}</li>`).join("")}
              </ul>
            </div>

            <!-- Closing Paragraphs -->
            ${content.closingParagraphs
              .map(
                p => `<p>${p}</p>`
              )
              .join("")}

            <!-- Signature -->
            <p class="signature">
              ${content.signature.line1}<br>
              ${content.signature.line2}
            </p>

            <!-- Footer -->
            <div class="footer">
              <div class="footer-company">${content.footer.companyName}</div>
              ${content.footer.phone ? `<div class="footer-item">📞 ${content.footer.phone}</div>` : ''}
              ${content.footer.email ? `<div class="footer-item">📧 <a href="mailto:${content.footer.email}">${content.footer.email}</a></div>` : ''}
              ${content.footer.website ? `<div class="footer-item">🌐 <a href="${content.footer.website}">${content.footer.website.replace('https://', '')}</a></div>` : ''}
              ${content.footer.address ? `<div class="footer-item">📍 ${content.footer.address}</div>` : ''}
              ${content.footer.businessHours ? `<div class="footer-item">🕒 ${content.footer.businessHours}</div>` : ''}
            </div>

          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>
  `;


  // ============================================================================
  // Plain Text Version - Generated from same content structure
  // ============================================================================

  const text = `
${content.title}

${content.greeting}

${content.paragraphs.join('\n\n')}

${content.urgencyBox.title}
${content.urgencyBox.message}

${content.attachmentsTitle}
${content.attachments.map(a => `- ${a}`).join('\n')}

${content.closingParagraphs.join('\n\n')}

${content.signature.line1}
${content.signature.line2}

${'─'.repeat(50)}
${content.footer.companyName}
${content.footer.phone ? `Phone: ${content.footer.phone}` : ''}
${content.footer.email ? `Email: ${content.footer.email}` : ''}
${content.footer.website ? `Website: ${content.footer.website}` : ''}
${content.footer.address ? `Address: ${content.footer.address}` : ''}
${content.footer.businessHours ? `Hours: ${content.footer.businessHours}` : ''}
  `.trim();

  return {
    subject: content.subject,
    html,
    text
  };
}

/**
 * Build order confirmation email template with navy blue styling and company logo
 *
 * Features:
 * - Company logo from database
 * - Customizable beginning/end text
 * - Optional "Action Required" section
 * - Optional "Attached Documents" section (dynamic based on available PDFs)
 * - Navy blue color scheme
 * - Proper company footer with divider
 *
 * @param data - Email data including order info and attachments
 * @param settings - Company settings from database
 * @returns HTML email template with subject and plain text version
 */
function buildOrderConfirmationEmailTemplate(
  data: EmailData,
  settings: CompanySettings
): { subject: string; html: string; text: string } {
  const emailContent = data.emailContent;

  // Substitute variables in content
  const subject = emailContent
    ? substituteOrderVariables(emailContent.subject, data)
    : `[Requires Confirmation] ${data.orderName} - #${data.orderNumber}`;

  const beginning = emailContent
    ? substituteOrderVariables(emailContent.beginning, data)
    : `Dear ${data.customerName || 'Valued Customer'},\n\nThe details for your order #${data.orderNumber} - ${data.orderName} have been prepared and are ready for your review and confirmation.`;

  const end = emailContent
    ? substituteOrderVariables(emailContent.end, data)
    : `If you have any questions or need changes, please reply to this email or contact us directly.\n\nThank you for your business!\n\nBest regards,\nThe Sign House Team`;

  const includeActionRequired = emailContent?.includeActionRequired ?? true;
  const includeAttachments = emailContent?.includeAttachments ?? true;

  // Build attachments list dynamically
  const attachmentsList: string[] = [];
  if (data.pdfUrls.orderForm) attachmentsList.push('Specifications Order Form');
  if (data.pdfUrls.qbEstimate) attachmentsList.push('QuickBooks Estimate');

  // Build logo HTML
  const logoHtml = settings.company_logo_base64
    ? `<div style="text-align: center; margin-bottom: 20px;">
        <img src="data:image/png;base64,${settings.company_logo_base64}"
             alt="${settings.company_name || 'Company Logo'}"
             style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />
        <hr style="border: none; border-top: 1px solid #ccc; margin: 15px auto 0; width: 80%;" />
       </div>`
    : '';

  // Build Action Required section (full border, centered, light background)
  const actionRequiredHtml = includeActionRequired
    ? `<div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px 18px; margin: 24px 0; border-radius: 8px; text-align: center;">
        <strong style="color: ${ORDER_COLORS.urgency};">Action Required</strong><br>
        <span style="color: #7f1d1d;">Please review and confirm your order promptly so we can begin production.</span>
       </div>`
    : '';

  // Build Attachments section (full border, centered, light background)
  const attachmentsHtml = includeAttachments && attachmentsList.length > 0
    ? `<div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 16px 18px; margin: 24px 0; border-radius: 8px; text-align: center;">
        <strong style="color: ${ORDER_COLORS.primary};">Attached Documents</strong><br>
        <span style="color: #374151;">${attachmentsList.join('<br>')}</span>
       </div>`
    : '';

  // Build footer (match Estimate Email exactly - no icons, simple layout)
  const footerParts: string[] = [];
  if (settings.company_name) footerParts.push(`<p style="margin: 0 0 5px 0;"><strong>${settings.company_name}</strong></p>`);
  if (settings.company_phone) footerParts.push(`<p style="margin: 0 0 5px 0;">${settings.company_phone}</p>`);
  if (settings.company_email) footerParts.push(`<p style="margin: 0 0 5px 0;">${settings.company_email}</p>`);
  if (settings.company_address) footerParts.push(`<p style="margin: 0 0 5px 0;">${settings.company_address}</p>`);
  if (settings.company_website) {
    const displayUrl = settings.company_website.replace(/^https?:\/\//, '');
    footerParts.push(`<p style="margin: 0 0 5px 0;"><a href="${settings.company_website}" style="color: #0066cc;">${displayUrl}</a></p>`);
  }
  if (settings.company_business_hours) footerParts.push(`<p style="margin: 0;">${settings.company_business_hours}</p>`);

  const footerHtml = footerParts.length > 0
    ? `<hr style="border: none; border-top: 1px solid #ccc; margin: 30px auto 0; width: 80%;" />
       <div style="margin-top: 15px; font-size: 12px; color: #666;">
         ${footerParts.join('')}
       </div>`
    : '';

  // Build complete HTML email (match Estimate Email structure)
  const html = `
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; border: 2px solid ${ORDER_COLORS.border}; border-radius: 24px; background-color: #f5f5f5; }
      .logo { text-align: center; }
      .content { margin: 20px 0; white-space: pre-wrap; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      ${logoHtml}
      <div class="content">${beginning.replace(/\n/g, '<br>')}</div>
      ${actionRequiredHtml}
      ${attachmentsHtml}
      <div class="content">${end.replace(/\n/g, '<br>')}</div>
      ${footerHtml}
    </div>
  </body>
</html>`;

  // Build plain text version (no emojis)
  const text = [
    beginning,
    '',
    includeActionRequired ? 'ACTION REQUIRED:\nPlease review and confirm your order promptly so we can begin production.' : '',
    '',
    includeAttachments && attachmentsList.length > 0 ? `ATTACHED DOCUMENTS:\n${attachmentsList.map(a => `- ${a}`).join('\n')}` : '',
    '',
    end,
    '',
    '-'.repeat(50),
    settings.company_name || '',
    settings.company_phone || '',
    settings.company_email || '',
    settings.company_address || '',
    settings.company_website || '',
    settings.company_business_hours || ''
  ].filter(line => line !== '').join('\n').trim();

  return { subject, html, text };
}

/**
 * Get email preview HTML for frontend display
 * Uses order confirmation template if emailContent is provided,
 * otherwise falls back to legacy template.
 *
 * @param data - Email data
 * @returns HTML preview with subject and body
 */
export async function getOrderEmailPreviewHtml(data: EmailData): Promise<{ subject: string; html: string }> {
  // Load company settings for logo and footer
  const settings = await loadCompanySettings();

  // Build using new order confirmation template
  const template = buildOrderConfirmationEmailTemplate(data, settings);

  return {
    subject: template.subject,
    html: template.html
  };
}

/**
 * Get email preview HTML for frontend display (legacy - synchronous)
 * Uses same template as actual email sending - guaranteed consistency
 *
 * @param data - Email data
 * @returns HTML preview with subject and body
 */
export function getEmailPreviewHtml(data: EmailData): { subject: string; html: string } {
  const template = buildEmailTemplate(data);
  return {
    subject: template.subject,
    html: template.html
  };
}

/**
 * Fetch PDF from URL and convert to base64
 *
 * @param url - URL to fetch PDF from
 * @returns Base64 encoded PDF data
 */
async function fetchPDFAsBase64(url: string): Promise<string | null> {
  try {
    console.log(`[Gmail] Fetching PDF from: ${url}`);

    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 30000 // 30 second timeout
    });

    const base64 = Buffer.from(response.data as ArrayBuffer).toString('base64');
    // Wrap at 76 characters per line (RFC 2045 requirement for MIME base64)
    const wrappedBase64 = base64.match(/.{1,76}/g)?.join('\r\n') || base64;
    console.log(`✅ [Gmail] PDF fetched successfully (${Math.round(base64.length / 1024)}KB)`);

    return wrappedBase64;
  } catch (error) {
    console.error(`❌ [Gmail] Failed to fetch PDF from ${url}:`, error);
    return null;
  }
}

/**
 * Extract filename from URL
 */
function getFilenameFromUrl(url: string): string {
  const parts = url.split('/');
  const filenameWithQuery = parts[parts.length - 1];
  const filename = filenameWithQuery.split('?')[0];
  return decodeURIComponent(filename);
}

/**
 * Create RFC 2822 compliant multipart email with attachments
 *
 * Uses nested MIME structure for proper HTML/text alternative handling:
 * - multipart/mixed (outer) - for attachments
 *   - multipart/alternative (inner) - email clients pick ONE
 *     - text/plain (fallback for old clients)
 *     - text/html (modern clients display this)
 *   - application/pdf (attachments)
 *
 * This ensures only the formatted HTML version displays in modern clients,
 * while maintaining compatibility with text-only clients.
 *
 * @param data - Email data
 * @param template - Email template (subject, html, text)
 * @returns Base64url encoded email message for Gmail API
 */
async function createEmailMessage(
  data: EmailData,
  template: { subject: string; html: string; text: string }
): Promise<string> {
  // Two boundaries: one for mixed (outer), one for alternative (inner)
  const mixedBoundary = '----=_Part_Mixed_' + Date.now() + '_' + Math.random().toString(36).substring(7);
  const altBoundary = '----=_Part_Alt_' + Date.now() + '_' + Math.random().toString(36).substring(7);

  // Email headers
  const headers = [
    `From: ${SENDER_NAME} <${SENDER_EMAIL}>`,
    `To: ${data.recipients.join(', ')}`,
    `Subject: ${template.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`
  ];

  // Add BCC header if configured
  if (BCC_EMAIL && BCC_EMAIL.trim() !== '') {
    headers.splice(3, 0, `Bcc: ${BCC_EMAIL}`); // Insert after "To" header
  }

  // Email body parts
  const bodyParts: string[] = [];

  // Part 1: multipart/alternative section (HTML + plain text)
  bodyParts.push(
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``
  );

  // Part 1a: Plain text version (fallback for text-only clients)
  bodyParts.push(
    `--${altBoundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    template.text
  );

  // Part 1b: HTML version (modern clients prefer this)
  bodyParts.push(
    `--${altBoundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    template.html
  );

  // Close alternative boundary
  bodyParts.push(`--${altBoundary}--`);

  // Part 3 & 4: PDF attachments
  const attachments: Array<{ url: string; name: string }> = [];

  if (data.pdfUrls.orderForm) {
    attachments.push({
      url: data.pdfUrls.orderForm,
      name: getFilenameFromUrl(data.pdfUrls.orderForm)
    });
  }

  if (data.pdfUrls.qbEstimate) {
    attachments.push({
      url: data.pdfUrls.qbEstimate,
      name: getFilenameFromUrl(data.pdfUrls.qbEstimate)
    });
  }

  // Part 2+: PDF attachments (in the outer mixed section)
  // IMPORTANT: Fail if attachments cannot be fetched (per user requirement - no silent failures)
  for (const attachment of attachments) {
    let pdfBase64: string | null = null;
    let lastError: Error | null = null;

    // Retry logic for attachment fetching (3 attempts with exponential backoff)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        pdfBase64 = await fetchPDFAsBase64(attachment.url);
        if (pdfBase64) break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`⚠️ [Gmail] Attachment fetch attempt ${attempt}/3 failed: ${attachment.name}`);
        if (attempt < 3) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (pdfBase64) {
      bodyParts.push(
        `--${mixedBoundary}`,
        `Content-Type: application/pdf; name="${attachment.name}"`,
        `Content-Disposition: attachment; filename="${attachment.name}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        pdfBase64
      );
    } else {
      // FAIL the email send - don't silently skip attachments
      throw new Error(`Failed to attach "${attachment.name}" after 3 attempts. Email not sent.`);
    }
  }

  // Close mixed boundary
  bodyParts.push(`--${mixedBoundary}--`);

  // Combine everything
  const email = headers.concat([''], bodyParts).join('\r\n');

  // Base64url encode for Gmail API (RFC 4648)
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Send email with retry logic (exponential backoff)
 *
 * @param gmail - Authenticated Gmail client
 * @param encodedMessage - Base64url encoded email message
 * @param maxRetries - Maximum number of retry attempts
 * @returns Gmail API response
 */
async function sendWithRetry(
  gmail: any,
  encodedMessage: string,
  maxRetries: number = 3
): Promise<any> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });
    } catch (error: any) {
      lastError = error;

      // Don't retry on permanent failures
      if (error.code === 400 || error.code === 403 || error.code === 404) {
        throw error;
      }

      // Retry on transient failures (500, 503, network errors)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⚠️ [Gmail] Send failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Send finalization email to customer point persons
 * Uses the new order confirmation template with company logo and customizable content
 *
 * @param data - Email data including recipients, order info, and optional email content
 * @returns Email result with success status and message ID
 */
export async function sendFinalizationEmail(data: EmailData): Promise<EmailResult> {
  // Load company settings for logo and footer
  const settings = await loadCompanySettings();

  // Build email template using new order confirmation template
  const template = data.emailContent
    ? buildOrderConfirmationEmailTemplate(data, settings)
    : buildEmailTemplate(data);

  // Build complete BCC list
  const allBccRecipients: string[] = [...(data.bccRecipients || [])];
  if (BCC_EMAIL && BCC_EMAIL.trim() !== '' && !allBccRecipients.includes(BCC_EMAIL)) {
    allBccRecipients.push(BCC_EMAIL);
  }

  // Check if Gmail is enabled
  if (!GMAIL_ENABLED) {
    console.log('\n' + '='.repeat(80));
    console.log('[GMAIL DISABLED] Email would be sent with the following details:');
    console.log('='.repeat(80));

    console.log('\n📧 EMAIL DETAILS:');
    console.log(`  From: ${SENDER_NAME} <${SENDER_EMAIL}>`);
    console.log(`  To: ${data.recipients.join(', ')}`);
    if (data.ccRecipients && data.ccRecipients.length > 0) {
      console.log(`  CC: ${data.ccRecipients.join(', ')}`);
    }
    if (allBccRecipients.length > 0) {
      console.log(`  Bcc: ${allBccRecipients.join(', ')}`);
    }
    console.log(`  Subject: ${template.subject}`);
    console.log(`  Using new template: ${data.emailContent ? 'Yes' : 'No (legacy)'}`);
    console.log(`  Company logo: ${settings.company_logo_base64 ? 'Yes' : 'No'}`);

    console.log('\n📎 ATTACHMENTS:');
    if (data.pdfUrls.orderForm) {
      console.log(`  - Specifications Order Form: ${data.pdfUrls.orderForm}`);
    }
    if (data.pdfUrls.qbEstimate) {
      console.log(`  - QuickBooks Estimate: ${data.pdfUrls.qbEstimate}`);
    }
    if (!data.pdfUrls.orderForm && !data.pdfUrls.qbEstimate) {
      console.log('  (No attachments)');
    }

    console.log('\n📄 EMAIL BODY (Plain Text):');
    console.log('-'.repeat(80));
    console.log(template.text);
    console.log('-'.repeat(80));

    console.log('\n✅ Email would be sent successfully');
    console.log('   (Actual sending disabled - set GMAIL_ENABLED=true to enable)');
    console.log('='.repeat(80) + '\n');

    return {
      success: true,
      message: 'Email logged to console (Gmail disabled)',
      messageId: `disabled_${Date.now()}`
    };
  }

  // Validate configuration
  if (!SENDER_EMAIL) {
    return {
      success: false,
      message: 'Gmail sender email not configured',
      error: 'GMAIL_SENDER_EMAIL not set in environment'
    };
  }

  // Validate recipients
  if (!data.recipients || data.recipients.length === 0) {
    return {
      success: false,
      message: 'No recipients specified',
      error: 'Recipients array is empty'
    };
  }

  try {
    console.log('\n📧 [Gmail] Preparing to send order confirmation email...');
    console.log(`   From: ${SENDER_NAME} <${SENDER_EMAIL}>`);
    console.log(`   To: ${data.recipients.join(', ')}`);
    if (data.ccRecipients && data.ccRecipients.length > 0) {
      console.log(`   CC: ${data.ccRecipients.join(', ')}`);
    }
    if (allBccRecipients.length > 0) {
      console.log(`   Bcc: ${allBccRecipients.join(', ')}`);
    }
    console.log(`   Subject: ${template.subject}`);
    console.log(`   Using new template: ${data.emailContent ? 'Yes' : 'No (legacy)'}`);
    console.log(`   Company logo: ${settings.company_logo_base64 ? 'Yes' : 'No'}`);
    console.log(`   Attachments: ${[data.pdfUrls.orderForm, data.pdfUrls.qbEstimate].filter(Boolean).length}`);

    // Create Gmail client
    const gmail = await createGmailClient();

    // Create email message with attachments
    const encodedMessage = await createEmailMessage(data, template);

    console.log('📤 [Gmail] Sending email via Gmail API...');

    // Send email via Gmail API with retry logic
    const response = await sendWithRetry(gmail, encodedMessage);

    console.log('\n✅ [Gmail API] Email sent successfully');
    console.log(`   Message ID: ${response.data.id}`);
    console.log(`   To: ${data.recipients.join(', ')}`);
    console.log(`   Subject: ${template.subject}\n`);

    return {
      success: true,
      message: 'Email sent successfully',
      messageId: response.data.id || undefined
    };

  } catch (error: any) {
    console.error('\n❌ [Gmail API] Email send failed:', error);

    // Log detailed error for debugging
    if (error.response?.data) {
      console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
    }

    // User-friendly error messages
    let errorMessage = 'Failed to send email via Gmail API';
    let errorDetail = error.message || 'Unknown error';

    if (error.code === 403) {
      errorMessage = 'Gmail API access denied';
      errorDetail = 'Check domain-wide delegation and service account permissions';
    } else if (error.code === 429) {
      errorMessage = 'Gmail API rate limit exceeded';
      errorDetail = 'Too many emails sent. Try again later.';
    } else if (error.code === 400) {
      errorMessage = 'Invalid email format';
      errorDetail = error.message || 'Check email addresses and content';
    } else if (error.name === 'GmailAuthError') {
      errorMessage = 'Gmail authentication failed';
      errorDetail = error.message;
    }

    return {
      success: false,
      message: errorMessage,
      error: errorDetail
    };
  }
}

/**
 * Send estimate email to customer point persons
 *
 * @param data - Estimate email data including recipients and estimate info
 * @returns Email result with success status and message ID
 */
export async function sendEstimateEmail(data: EstimateEmailData): Promise<EmailResult> {
  // Build full BCC list for logging
  const logBccRecipients: string[] = [...(data.bccRecipients || [])];
  if (BCC_EMAIL && BCC_EMAIL.trim() !== '' && !logBccRecipients.includes(BCC_EMAIL)) {
    logBccRecipients.push(BCC_EMAIL);
  }

  // Check if Gmail is enabled
  if (!GMAIL_ENABLED) {
    console.log('\n' + '='.repeat(80));
    console.log('[GMAIL DISABLED] Estimate email would be sent with the following details:');
    console.log('='.repeat(80));
    console.log('\n📧 EMAIL DETAILS:');
    console.log(`  From: ${SENDER_NAME} <${SENDER_EMAIL}>`);
    console.log(`  To: ${data.recipients.join(', ')}`);
    if (data.ccRecipients && data.ccRecipients.length > 0) {
      console.log(`  CC: ${data.ccRecipients.join(', ')}`);
    }
    if (logBccRecipients.length > 0) {
      console.log(`  Bcc: ${logBccRecipients.join(', ')}`);
    }
    console.log(`  Subject: ${data.subject}`);
    console.log(`\n📎 ATTACHMENTS:`);
    if (data.pdfPath) {
      console.log(`  - QB Estimate PDF: ${data.pdfPath}`);
    }
    if (data.qbEstimateUrl) {
      console.log(`  - QB Estimate Link: ${data.qbEstimateUrl}`);
    }
    if (!data.pdfPath && !data.qbEstimateUrl) {
      console.log('  (No attachments)');
    }
    console.log('\n✅ Email would be sent successfully');
    console.log('   (Actual sending disabled - set GMAIL_ENABLED=true to enable)');
    console.log('='.repeat(80) + '\n');

    return {
      success: true,
      message: 'Estimate email logged to console (Gmail disabled)',
      messageId: `estimate_disabled_${Date.now()}`
    };
  }

  // Validate configuration
  if (!SENDER_EMAIL) {
    return {
      success: false,
      message: 'Gmail sender email not configured',
      error: 'GMAIL_SENDER_EMAIL not set in environment'
    };
  }

  // Validate recipients
  if (!data.recipients || data.recipients.length === 0) {
    return {
      success: false,
      message: 'No recipients specified',
      error: 'Recipients array is empty'
    };
  }

  try {
    console.log('\n📧 [Gmail] Preparing to send estimate email...');
    console.log(`   From: ${SENDER_NAME} <${SENDER_EMAIL}>`);
    console.log(`   To: ${data.recipients.join(', ')}`);
    if (data.ccRecipients && data.ccRecipients.length > 0) {
      console.log(`   CC: ${data.ccRecipients.join(', ')}`);
    }
    if (logBccRecipients.length > 0) {
      console.log(`   Bcc: ${logBccRecipients.join(', ')}`);
    }
    console.log(`   Subject: ${data.subject}`);
    console.log(`   Estimate: #${data.estimateNumber} - ${data.estimateName}`);

    // Create Gmail client
    const gmail = await createGmailClient();

    // Build email message with attachments
    const encodedMessage = await createEstimateEmailMessage(data);

    // Send email with retry logic
    const result = await sendWithRetry(gmail, encodedMessage);

    console.log(`✅ [Gmail] Estimate email sent successfully (Message ID: ${result.messageId})`);

    return {
      success: true,
      message: 'Estimate email sent successfully',
      messageId: result.messageId
    };
  } catch (error) {
    console.error('❌ [Gmail] Error sending estimate email:', error);

    let errorMessage = 'Failed to send estimate email';
    let errorDetail = error instanceof Error ? error.message : 'Unknown error';

    if (error instanceof Error) {
      const errorWithCode = error as any;
      if (errorWithCode.code === 403) {
        errorMessage = 'Gmail API access denied';
        errorDetail = 'Check domain-wide delegation and service account permissions';
      } else if (errorWithCode.code === 429) {
        errorMessage = 'Gmail API rate limit exceeded';
        errorDetail = 'Too many emails sent. Try again later.';
      } else if (errorWithCode.code === 400) {
        errorMessage = 'Invalid email format';
        errorDetail = error.message || 'Check email addresses and content';
      } else if (error.name === 'GmailAuthError') {
        errorMessage = 'Gmail authentication failed';
        errorDetail = error.message;
      }
    }

    return {
      success: false,
      message: errorMessage,
      error: errorDetail
    };
  }
}

/**
 * Create email message for estimate with optional PDF attachment
 * Uses Nodemailer's MailComposer for proper MIME construction
 */
async function createEstimateEmailMessage(data: EstimateEmailData): Promise<string> {
  const pdfFilename = `Estimate-${data.estimateNumber || 'document'}.pdf`;

  console.log(`   📎 PDF path received: ${data.pdfPath || '(none provided)'}`);

  // Build mail options for MailComposer
  const mailOptions: any = {
    from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
    to: data.recipients.join(', '),
    subject: data.subject,
    html: data.body,
    attachments: []
  };

  // Add CC recipients if provided
  if (data.ccRecipients && data.ccRecipients.length > 0) {
    mailOptions.cc = data.ccRecipients.join(', ');
    console.log(`   CC: ${mailOptions.cc}`);
  }

  // Build BCC list: combine user-selected BCC with company BCC
  const allBccRecipients: string[] = [];
  if (data.bccRecipients && data.bccRecipients.length > 0) {
    allBccRecipients.push(...data.bccRecipients);
  }
  if (BCC_EMAIL && BCC_EMAIL.trim() !== '' && !allBccRecipients.includes(BCC_EMAIL)) {
    allBccRecipients.push(BCC_EMAIL);
  }
  if (allBccRecipients.length > 0) {
    mailOptions.bcc = allBccRecipients.join(', ');
  }

  // Add PDF attachment if path provided
  if (data.pdfPath) {
    try {
      let pdfContent: Buffer;

      if (data.pdfPath.startsWith('http://') || data.pdfPath.startsWith('https://')) {
        // URL - fetch remotely
        console.log(`   📎 Fetching PDF from URL: ${data.pdfPath}`);
        const response = await axios.get<ArrayBuffer>(data.pdfPath, {
          responseType: 'arraybuffer',
          timeout: 30000
        });
        pdfContent = Buffer.from(response.data);
        console.log(`   📎 PDF fetched: ${Math.round(pdfContent.length / 1024)}KB`);
      } else {
        // Local file path
        console.log(`   📎 Reading PDF from local path: ${data.pdfPath}`);
        const fs = await import('fs').then(m => m.promises);
        pdfContent = await fs.readFile(data.pdfPath);
        console.log(`   📎 PDF loaded: ${Math.round(pdfContent.length / 1024)}KB`);
      }

      mailOptions.attachments.push({
        filename: pdfFilename,
        content: pdfContent,
        contentType: 'application/pdf'
      });

      console.log(`   📎 PDF attachment added: ${pdfFilename}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('   ❌ Could not load PDF attachment:', errorMsg);
      throw new Error(`Failed to load PDF attachment: ${errorMsg}`);
    }
  } else {
    console.log('   ⚠️ No PDF path provided - email will be sent without attachment');
  }

  // Use MailComposer to build proper MIME message
  const mail = new MailComposer(mailOptions);

  return new Promise((resolve, reject) => {
    mail.compile().build((err, message) => {
      if (err) {
        reject(err);
        return;
      }

      let messageStr = message.toString();

      // MailComposer strips BCC headers (standard SMTP behavior), but Gmail API
      // needs the BCC header in the raw message to deliver to BCC recipients.
      // Manually insert BCC header after the To: line.
      if (allBccRecipients.length > 0) {
        // Find the To: header line and insert BCC after it
        const toHeaderMatch = messageStr.match(/^To: .+$/m);
        if (toHeaderMatch) {
          const toHeader = toHeaderMatch[0];
          const bccHeader = `Bcc: ${allBccRecipients.join(', ')}`;
          messageStr = messageStr.replace(toHeader, `${toHeader}\r\n${bccHeader}`);
          console.log(`   📧 BCC header injected: ${allBccRecipients.join(', ')}`);
        }
      }

      // Debug: Log first 2000 chars of message
      const debugContent = messageStr.substring(0, 2000).replace(/[A-Za-z0-9+/=]{100,}/g, '[BASE64...]');
      console.log('   📋 MailComposer output preview:\n' + debugContent);

      // Encode for Gmail API (URL-safe base64)
      const encodedMessage = Buffer.from(messageStr).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      resolve(encodedMessage);
    });
  });
}
