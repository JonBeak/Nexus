/**
 * Invoice Email Service
 * Phase 2.e: QB Invoice Automation
 * Created: 2025-12-13
 *
 * Handles invoice email composition, sending, and scheduling.
 * Uses Gmail service for actual email delivery.
 */

import { createGmailClient } from './gmailAuthService';
import * as qbInvoiceRepo from '../repositories/qbInvoiceRepository';
import * as orderPrepRepo from '../repositories/orderPreparationRepository';
import { estimateEmailService } from './estimate/estimateEmailService';
import {
  ScheduledEmailInput,
  ScheduledEmail,
  EmailType,
  EmailPreview,
  TemplateVariables
} from '../types/qbInvoice';
import MailComposer from 'nodemailer/lib/mail-composer';
import * as fs from 'fs/promises';
import { escapeHtml } from '../utils/htmlUtils';

// Gmail API Configuration
const GMAIL_ENABLED = process.env.GMAIL_ENABLED === 'true';
const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || 'info@signhouse.ca';
const SENDER_NAME = process.env.GMAIL_SENDER_NAME || 'Sign House';
const BCC_EMAIL = process.env.GMAIL_BCC_EMAIL || '';

// PDF cache directory
const PDF_CACHE_DIR = '/tmp/invoice-pdf-cache';

// =============================================
// PDF DOWNLOAD HELPERS
// =============================================

/**
 * Ensure PDF cache directory exists
 */
async function ensurePdfCacheDir(): Promise<void> {
  try {
    await fs.access(PDF_CACHE_DIR);
  } catch {
    await fs.mkdir(PDF_CACHE_DIR, { recursive: true });
  }
}

/**
 * Download invoice PDF from QuickBooks with retry logic
 * Caches PDF locally to avoid repeated downloads
 *
 * @param qbInvoiceId - QuickBooks invoice ID
 * @param qbDocNumber - QB invoice doc number for filename
 * @returns Local file path to the downloaded PDF
 * @throws Error if download fails after all retries
 */
async function downloadInvoicePdfWithRetry(
  qbInvoiceId: string,
  qbDocNumber: string | null
): Promise<string> {
  await ensurePdfCacheDir();

  const cachePath = `${PDF_CACHE_DIR}/invoice-${qbInvoiceId}.pdf`;

  // Check cache first
  try {
    await fs.access(cachePath);
    console.log(`📎 Using cached invoice PDF: ${cachePath}`);
    return cachePath;
  } catch {
    // Cache miss - need to download
  }

  // Get realm ID for QB API
  const { quickbooksRepository } = await import('../repositories/quickbooksRepository');
  const realmId = await quickbooksRepository.getDefaultRealmId();
  if (!realmId) {
    throw new Error('QuickBooks not configured - cannot download invoice PDF');
  }

  // Import the QB invoice PDF function
  const { getQBInvoicePdf } = await import('../utils/quickbooks/invoiceClient');

  // Retry logic with exponential backoff (matching estimate pattern)
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`📎 Downloading invoice PDF (attempt ${attempt}/${MAX_RETRIES})...`);
      const pdfBuffer = await getQBInvoicePdf(qbInvoiceId, realmId);

      // Save to cache
      await fs.writeFile(cachePath, pdfBuffer);
      console.log(`✅ Invoice PDF downloaded and cached: ${cachePath} (${Math.round(pdfBuffer.length / 1024)}KB)`);

      return cachePath;
    } catch (pdfError) {
      lastError = pdfError instanceof Error ? pdfError : new Error(String(pdfError));
      console.error(`⚠️ PDF download attempt ${attempt} failed:`, lastError.message);

      if (attempt < MAX_RETRIES) {
        const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.log(`   Retrying in ${delayMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(`Failed to download invoice PDF after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}. Email not sent.`);
}

// =============================================
// EMAIL SENDING
// =============================================

/**
 * Send invoice email immediately
 *
 * @param orderId - Order ID
 * @param recipientEmails - To recipients
 * @param ccEmails - CC recipients
 * @param subject - Email subject
 * @param body - Email HTML body
 * @param userId - User sending the email
 * @param bccEmails - BCC recipients
 * @param attachInvoicePdf - Whether to attach the invoice PDF (default: false)
 * @param qbInvoiceId - QuickBooks invoice ID (required if attachInvoicePdf is true)
 * @param qbDocNumber - QuickBooks invoice doc number (for filename)
 */
export async function sendInvoiceEmail(
  orderId: number,
  recipientEmails: string[],
  ccEmails: string[],
  subject: string,
  body: string,
  userId: number,
  bccEmails?: string[],
  attachInvoicePdf?: boolean,
  qbInvoiceId?: string,
  qbDocNumber?: string | null
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Validate recipients
    if (!recipientEmails || recipientEmails.length === 0) {
      return { success: false, error: 'No recipients specified' };
    }

    // If PDF attachment requested, validate we have the QB invoice ID
    let pdfPath: string | null = null;
    if (attachInvoicePdf) {
      if (!qbInvoiceId) {
        return { success: false, error: 'Cannot attach PDF: No QuickBooks invoice linked. Please link or create an invoice first.' };
      }

      // Download PDF with retry logic (fails if PDF cannot be attached)
      try {
        pdfPath = await downloadInvoicePdfWithRetry(qbInvoiceId, qbDocNumber || null);
      } catch (pdfError) {
        const errorMsg = pdfError instanceof Error ? pdfError.message : 'Failed to download PDF';
        console.error('❌ PDF attachment failed:', errorMsg);
        return { success: false, error: errorMsg };
      }
    }

    // Check if Gmail is enabled
    if (!GMAIL_ENABLED) {
      console.log('\n' + '='.repeat(80));
      console.log('[GMAIL DISABLED] Invoice email would be sent:');
      console.log('='.repeat(80));
      console.log(`  From: ${SENDER_NAME} <${SENDER_EMAIL}>`);
      console.log(`  To: ${recipientEmails.join(', ')}`);
      if (ccEmails?.length) console.log(`  CC: ${ccEmails.join(', ')}`);
      if (bccEmails?.length) console.log(`  BCC: ${bccEmails.join(', ')}`);
      if (BCC_EMAIL) console.log(`  Auto-BCC: ${BCC_EMAIL}`);
      console.log(`  Subject: ${subject}`);
      if (pdfPath) console.log(`  📎 PDF Attachment: ${pdfPath}`);
      console.log('\n  Body Preview (first 500 chars):');
      console.log('  ' + body.replace(/<[^>]*>/g, '').substring(0, 500) + '...');
      console.log('='.repeat(80) + '\n');

      // Mark invoice as sent even in disabled mode
      const sentAt = new Date();
      await qbInvoiceRepo.updateOrderInvoiceRecord(orderId, {
        invoice_sent_at: sentAt
      });

      // Create email history record for immediate sends
      await qbInvoiceRepo.createScheduledEmail({
        order_id: orderId,
        email_type: 'full_invoice',
        recipient_emails: recipientEmails,
        cc_emails: ccEmails?.length ? ccEmails : undefined,
        subject,
        body,
        scheduled_for: sentAt,
        created_by: userId,
        status: 'sent',
        sent_at: sentAt
      });

      return {
        success: true,
        messageId: `disabled_${Date.now()}`
      };
    }

    // Create Gmail client
    const gmail = await createGmailClient();
    if (!gmail) {
      return { success: false, error: 'Failed to create Gmail client' };
    }

    // Build email message (with or without attachment)
    let encodedMessage: string;
    if (pdfPath) {
      // Use MailComposer for email with PDF attachment
      encodedMessage = await buildEmailMessageWithAttachment(
        recipientEmails,
        ccEmails,
        subject,
        body,
        bccEmails,
        pdfPath,
        qbDocNumber || undefined
      );
    } else {
      // Use simple builder for email without attachment
      encodedMessage = buildEmailMessage(
        recipientEmails,
        ccEmails,
        subject,
        body,
        bccEmails
      );
    }

    // Send email
    console.log(`📧 Sending invoice email for order ${orderId}...`);
    console.log(`   To: ${recipientEmails.join(', ')}`);
    if (ccEmails?.length) console.log(`   CC: ${ccEmails.join(', ')}`);
    if (bccEmails?.length) console.log(`   BCC (user): ${bccEmails.join(', ')}`);
    console.log(`   Auto-BCC: ${BCC_EMAIL || '(not configured)'}`);
    if (pdfPath) console.log(`   📎 PDF attached: ${pdfPath}`);
    const response = await sendWithRetry(gmail, encodedMessage);
    const messageId = response.data?.id;

    console.log(`✅ Invoice email sent: ${messageId}`);

    // Mark invoice as sent
    const sentAt = new Date();
    await qbInvoiceRepo.updateOrderInvoiceRecord(orderId, {
      invoice_sent_at: sentAt
    });

    // Create email history record for immediate sends
    await qbInvoiceRepo.createScheduledEmail({
      order_id: orderId,
      email_type: 'full_invoice',
      recipient_emails: recipientEmails,
      cc_emails: ccEmails?.length ? ccEmails : undefined,
      subject,
      body,
      scheduled_for: sentAt,
      created_by: userId,
      status: 'sent',
      sent_at: sentAt
    });

    return { success: true, messageId };
  } catch (error: any) {
    console.error('Error sending invoice email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
}

// =============================================
// EMAIL SCHEDULING
// =============================================

/**
 * Schedule invoice email for future delivery
 */
export async function scheduleInvoiceEmail(
  orderId: number,
  recipientEmails: string[],
  ccEmails: string[] | undefined,
  subject: string,
  body: string,
  scheduledFor: Date,
  emailType: EmailType,
  userId: number
): Promise<{ scheduledEmailId: number }> {
  const data: ScheduledEmailInput = {
    order_id: orderId,
    email_type: emailType,
    recipient_emails: recipientEmails,
    cc_emails: ccEmails,
    subject,
    body,
    scheduled_for: scheduledFor,
    created_by: userId
  };

  const id = await qbInvoiceRepo.createScheduledEmail(data);
  console.log(`📅 Invoice email scheduled for ${scheduledFor.toISOString()} (ID: ${id})`);

  return { scheduledEmailId: id };
}

/**
 * Get scheduled email for an order
 */
export async function getScheduledEmailForOrder(orderId: number): Promise<ScheduledEmail | null> {
  return qbInvoiceRepo.getScheduledEmailForOrder(orderId);
}

/**
 * Update a scheduled email
 */
export async function updateScheduledEmail(
  id: number,
  updates: Partial<{
    subject: string;
    body: string;
    scheduledFor: Date;
    recipientEmails: string[];
    ccEmails: string[];
  }>
): Promise<void> {
  const updateData: any = {};
  if (updates.subject !== undefined) updateData.subject = updates.subject;
  if (updates.body !== undefined) updateData.body = updates.body;
  if (updates.scheduledFor !== undefined) updateData.scheduled_for = updates.scheduledFor;
  if (updates.recipientEmails !== undefined) updateData.recipient_emails = updates.recipientEmails;
  if (updates.ccEmails !== undefined) updateData.cc_emails = updates.ccEmails;

  await qbInvoiceRepo.updateScheduledEmail(id, updateData);
}

/**
 * Cancel a scheduled email
 */
export async function cancelScheduledEmail(id: number): Promise<void> {
  await qbInvoiceRepo.cancelScheduledEmail(id);
  console.log(`❌ Scheduled email ${id} cancelled`);
}

// =============================================
// EMAIL PREVIEW & TEMPLATES
// =============================================

/**
 * Get email preview with variables replaced
 * @param orderId - Order ID
 * @param templateKey - Template key (full_invoice or deposit_request)
 * @param customMessage - Optional custom message to insert into template
 */
export async function getEmailPreview(
  orderId: number,
  templateKey: EmailType,
  customMessage?: string
): Promise<EmailPreview> {
  // Get order data for variables
  const order = await orderPrepRepo.getOrderDataForQBEstimate(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  // Get invoice data - use fresh data from QB if invoice exists
  const invoiceRecord = await qbInvoiceRepo.getOrderInvoiceRecord(orderId);

  // Determine actual template to use based on deposit payment status
  let effectiveTemplateKey = templateKey;

  // If deposit_request template requested, verify deposit hasn't been paid
  if (templateKey === 'deposit_request' && invoiceRecord?.qb_invoice_id) {
    try {
      const qbInvoiceService = await import('./qbInvoiceService');
      const details = await qbInvoiceService.getInvoiceDetails(orderId);
      // If balance < total, some payment was made - use full_invoice instead
      if (details.balance !== null && details.total !== null && details.balance < details.total) {
        effectiveTemplateKey = 'full_invoice';
        console.log(`Deposit paid for order ${orderId}, switching to full_invoice template`);
      }
    } catch (err) {
      // If we can't check, use the requested template
      console.warn('Failed to check deposit status, using requested template:', err);
    }
  }

  // Get template
  const template = await qbInvoiceRepo.getEmailTemplate(effectiveTemplateKey);
  if (!template) {
    throw new Error(`Email template "${effectiveTemplateKey}" not found`);
  }

  // Try to get fresh payment link and invoice details from QB if invoice exists
  let qbInvoiceUrl = invoiceRecord?.qb_invoice_url || '#';
  let invoiceTotal = '0.00';
  let dueDateLine = ''; // Will contain full HTML line or be empty
  let balanceLine = ''; // Will contain remaining balance line if balance != total

  if (invoiceRecord?.qb_invoice_id) {
    try {
      // Import dynamically to avoid circular dependency
      const qbInvoiceService = await import('./qbInvoiceService');
      const details = await qbInvoiceService.getInvoiceDetails(orderId);
      if (details.invoiceUrl) {
        qbInvoiceUrl = details.invoiceUrl;
      }
      if (details.total !== null && details.total !== undefined) {
        invoiceTotal = details.total.toFixed(2);
      }
      // Show remaining balance if it differs from total (partial payment made)
      if (details.balance !== null && details.total !== null && details.balance !== details.total) {
        const formattedBalance = details.balance.toFixed(2);
        balanceLine = `<br><p style="margin: 0; font-weight: 600; color: #dc2626;">Amount Due: $${formattedBalance}</p>`;
      }
      if (details.dueDate) {
        // Format the due date nicely and wrap in HTML
        const date = new Date(details.dueDate);
        const formattedDate = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        dueDateLine = `<p style="margin-top: 5px;">Due Date: ${formattedDate}</p>`;
      }
    } catch (err) {
      console.error('Failed to get fresh QB invoice data for email preview:', err);
      // Fall back to stored data - no due date line if we can't fetch from QB
    }
  }

  // If no QB invoice total yet, calculate from order parts
  if (invoiceTotal === '0.00') {
    try {
      const orderParts = await orderPrepRepo.getOrderPartsForQBEstimate(orderId);
      // Calculate subtotal from parts
      const subtotal = orderParts.reduce((sum, part) => {
        const extPrice = parseFloat(String(part.extended_price)) || 0;
        return sum + extPrice;
      }, 0);

      // Get tax rate based on order tax_name (default 13% HST if not specified)
      // Note: Tax is handled by QB on invoice creation, this is just for preview
      const taxRate = order.tax_name?.toLowerCase().includes('exempt') ? 0 : 0.13;
      const tax = subtotal * taxRate;
      const total = subtotal + tax;

      if (total > 0) {
        invoiceTotal = total.toFixed(2);
        console.log(`[Email Preview] Calculated total from parts: $${invoiceTotal} (subtotal: $${subtotal.toFixed(2)}, tax: $${tax.toFixed(2)})`);
      }
    } catch (err) {
      console.error('Failed to calculate invoice total from parts:', err);
    }
  }

  // Get point persons for recipients
  const pointPersons = await orderPrepRepo.getOrderPointPersons(orderId);
  const recipientEmails = pointPersons.map((pp: { contact_email: string }) => pp.contact_email);

  // Format custom message - wrap in styled paragraph if provided, empty string if not
  const formattedCustomMessage = customMessage && customMessage.trim()
    ? `<p class="custom-message">${customMessage.trim()}</p>`
    : '';

  // Build order details block (Job Name, PO#, Job# - only include if they exist)
  const orderDetailsLines: string[] = [];
  if (order.order_name) {
    orderDetailsLines.push(`<p style="margin: 0 0 5px 0;"><strong>Job Name:</strong> ${order.order_name}</p>`);
  }
  if (order.customer_po) {
    orderDetailsLines.push(`<p style="margin: 0 0 5px 0;"><strong>PO #:</strong> ${order.customer_po}</p>`);
  }
  if (order.customer_job_number) {
    orderDetailsLines.push(`<p style="margin: 0 0 5px 0;"><strong>Job #:</strong> ${order.customer_job_number}</p>`);
  }
  const orderDetailsBlock = orderDetailsLines.length > 0
    ? orderDetailsLines.join('\n') + '\n'
    : '';

  // Build subject suffix for PO# and Job# (optional)
  const subjectParts: string[] = [];
  if (order.customer_po) {
    subjectParts.push(`PO# ${order.customer_po}`);
  }
  if (order.customer_job_number) {
    subjectParts.push(`Job# ${order.customer_job_number}`);
  }
  const subjectSuffix = subjectParts.length > 0 ? ` | ${subjectParts.join(' | ')}` : '';

  // Calculate deposit amount (50% of invoice total) for deposit_request template
  const invoiceTotalNum = parseFloat(invoiceTotal) || 0;
  const depositAmount = effectiveTemplateKey === 'deposit_request'
    ? `$${(invoiceTotalNum * 0.5).toFixed(2)}`
    : undefined;

  // Build variables
  const variables: TemplateVariables = {
    orderNumber: String(order.order_number),
    orderName: order.order_name || `Order #${order.order_number}`,
    customerName: order.customer_name,
    invoiceTotal,
    invoiceNumber: invoiceRecord?.qb_invoice_doc_number || undefined, // QB invoice number (e.g., "6152")
    depositAmount,
    dueDateLine,
    balanceLine,
    qbInvoiceUrl,
    customMessage: formattedCustomMessage,
    orderDetailsBlock,
    subjectSuffix
  };

  // Replace variables in subject and body
  let subject = replaceVariables(template.subject, variables);
  const body = replaceVariables(template.body, variables);

  // Fix Invoice # vs Order # in subject:
  // - If we have a QB invoice number, use "Invoice #[invoiceNumber]"
  // - If no invoice number, use "Order #[orderNumber]"
  // This handles templates that might incorrectly use {orderNumber} for Invoice #
  if (invoiceRecord?.qb_invoice_doc_number) {
    // Replace any "Invoice #[orderNumber]" with correct "Invoice #[invoiceNumber]"
    subject = subject.replace(
      new RegExp(`Invoice\\s*#\\s*${order.order_number}`, 'gi'),
      `Invoice #${invoiceRecord.qb_invoice_doc_number}`
    );
  } else {
    // No QB invoice yet - change "Invoice #" to "Order #"
    subject = subject.replace(
      new RegExp(`Invoice\\s*#\\s*${order.order_number}`, 'gi'),
      `Order #${order.order_number}`
    );
  }

  // Add [Deposit Required] prefix for deposit emails (only if deposit not yet paid)
  if (effectiveTemplateKey === 'deposit_request' && !subject.startsWith('[Deposit Required]')) {
    subject = `[Deposit Required] ${subject}`;
  }

  return {
    subject,
    body,
    recipient_emails: recipientEmails
  };
}

/**
 * Get email template
 */
export async function getEmailTemplate(templateKey: string) {
  return qbInvoiceRepo.getEmailTemplate(templateKey);
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Replace template variables with values
 */
function replaceVariables(text: string, variables: TemplateVariables): string {
  let result = text;

  // Replace {variableName} format - escape values to prevent XSS
  result = result.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key as keyof TemplateVariables];
    return value !== undefined ? escapeHtml(String(value)) : match;
  });

  // Also replace #{variableName} format (for order numbers)
  result = result.replace(/#\{(\w+)\}/g, (match, key) => {
    const value = variables[key as keyof TemplateVariables];
    return value !== undefined ? `#${escapeHtml(String(value))}` : match;
  });

  return result;
}

/**
 * Build RFC 2822 compliant email message
 */
function buildEmailMessage(
  recipients: string[],
  ccEmails: string[] | undefined,
  subject: string,
  htmlBody: string,
  bccEmails?: string[]
): string {
  const boundary = '----=_Part_' + Date.now() + '_' + Math.random().toString(36).substring(7);

  // Build headers
  const headers = [
    `From: ${SENDER_NAME} <${SENDER_EMAIL}>`,
    `To: ${recipients.join(', ')}`,
  ];

  if (ccEmails && ccEmails.length > 0) {
    headers.push(`Cc: ${ccEmails.join(', ')}`);
  }

  // Combine user BCC emails with auto-BCC from config
  const allBccEmails: string[] = [];
  if (bccEmails && bccEmails.length > 0) {
    allBccEmails.push(...bccEmails);
  }
  if (BCC_EMAIL && BCC_EMAIL.trim() !== '' && !allBccEmails.includes(BCC_EMAIL)) {
    allBccEmails.push(BCC_EMAIL);
  }
  if (allBccEmails.length > 0) {
    headers.push(`Bcc: ${allBccEmails.join(', ')}`);
  }

  headers.push(
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  );

  // Build plain text version (strip HTML tags)
  const plainText = htmlBody
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  // Build email parts
  const parts = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    plainText,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
    `--${boundary}--`
  ];

  // Combine headers and body
  const email = headers.concat([''], parts).join('\r\n');

  // Base64url encode for Gmail API
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Build email message with PDF attachment using MailComposer
 * Used when attachInvoicePdf is true
 */
async function buildEmailMessageWithAttachment(
  recipients: string[],
  ccEmails: string[] | undefined,
  subject: string,
  htmlBody: string,
  bccEmails: string[] | undefined,
  pdfPath: string,
  invoiceDocNumber?: string
): Promise<string> {
  const pdfFilename = `Invoice-${invoiceDocNumber || 'document'}.pdf`;

  console.log(`   📎 Building email with PDF attachment: ${pdfFilename}`);

  // Generate plain text version from HTML body
  const plainText = htmlBody
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  // Build mail options for MailComposer
  const mailOptions: any = {
    from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
    to: recipients.join(', '),
    subject,
    text: plainText,
    html: htmlBody,
    attachments: []
  };

  // Add CC recipients if provided
  if (ccEmails && ccEmails.length > 0) {
    mailOptions.cc = ccEmails.join(', ');
  }

  // Build BCC list: combine user-selected BCC with company BCC
  const allBccRecipients: string[] = [];
  if (bccEmails && bccEmails.length > 0) {
    allBccRecipients.push(...bccEmails);
  }
  if (BCC_EMAIL && BCC_EMAIL.trim() !== '' && !allBccRecipients.includes(BCC_EMAIL)) {
    allBccRecipients.push(BCC_EMAIL);
  }
  if (allBccRecipients.length > 0) {
    mailOptions.bcc = allBccRecipients.join(', ');
  }

  // Load PDF attachment
  try {
    console.log(`   📎 Reading PDF from: ${pdfPath}`);
    const pdfContent = await fs.readFile(pdfPath);
    console.log(`   📎 PDF loaded: ${Math.round(pdfContent.length / 1024)}KB`);

    mailOptions.attachments.push({
      filename: pdfFilename,
      content: pdfContent,
      contentType: 'application/pdf',
      contentDisposition: 'attachment'
    });

    console.log(`   📎 PDF attachment added: ${pdfFilename}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('   ❌ Could not load PDF attachment:', errorMsg);
    throw new Error(`Failed to load PDF attachment: ${errorMsg}`);
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
      // Insert BCC header before the Subject: line
      if (allBccRecipients.length > 0) {
        const bccValue = allBccRecipients.join(', ');
        const subjectMatch = messageStr.match(/^Subject: /m);
        if (subjectMatch) {
          messageStr = messageStr.replace(/^Subject: /m, `Bcc: ${bccValue}\r\nSubject: `);
          console.log(`   📧 BCC header injected: ${bccValue}`);
        }
      }

      // Encode for Gmail API (URL-safe base64)
      const encodedMessage = Buffer.from(messageStr).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      resolve(encodedMessage);
    });
  });
}

/**
 * Send email with retry logic
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

      // Retry on transient failures
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`⚠️ Send failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Process and send a scheduled email (called by cron job)
 * Always attempts to attach invoice PDF (matches immediate send behavior)
 */
export async function processScheduledEmail(
  scheduledEmail: ScheduledEmail
): Promise<{ success: boolean; error?: string }> {
  try {
    // Look up invoice record to get PDF attachment info
    // Always attach PDF for scheduled invoice emails
    const invoiceRecord = await qbInvoiceRepo.getOrderInvoiceRecord(scheduledEmail.order_id);
    const qbInvoiceId = invoiceRecord?.qb_invoice_id || undefined;
    const qbDocNumber = invoiceRecord?.qb_invoice_doc_number || null;

    const result = await sendInvoiceEmail(
      scheduledEmail.order_id,
      scheduledEmail.recipient_emails,
      scheduledEmail.cc_emails || [],
      scheduledEmail.subject,
      scheduledEmail.body,
      scheduledEmail.created_by,
      undefined, // bccEmails - not stored in scheduled email currently
      true, // attachInvoicePdf - always true for invoice emails
      qbInvoiceId,
      qbDocNumber
    );

    if (result.success) {
      // Update scheduled email status
      await qbInvoiceRepo.updateScheduledEmail(scheduledEmail.id, {
        status: 'sent',
        sent_at: new Date()
      });
      return { success: true };
    } else {
      await qbInvoiceRepo.updateScheduledEmail(scheduledEmail.id, {
        status: 'failed',
        error_message: result.error
      });
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    await qbInvoiceRepo.updateScheduledEmail(scheduledEmail.id, {
      status: 'failed',
      error_message: error.message
    });
    return { success: false, error: error.message };
  }
}

// =============================================
// STYLED EMAIL PREVIEW (4-part structure like estimates)
// =============================================

/**
 * Invoice summary config - matches frontend InvoiceSummaryConfig
 */
export interface InvoiceSummaryConfig {
  includeJobName: boolean;
  includeJobNumber: boolean;
  includePO: boolean;
  includeInvoiceNumber: boolean;
  includeInvoiceDate: boolean;
  includeDueDate: boolean;
  includeSubtotal: boolean;
  includeTax: boolean;
  includeTotal: boolean;
  includeBalanceDue: boolean;
}

/**
 * Invoice data for email preview
 */
export interface InvoiceEmailPreviewData {
  jobName?: string;
  jobNumber?: string;
  customerPO?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  balanceDue?: number;
  qbInvoiceUrl?: string;
  customerName?: string;
}

/**
 * Email content from frontend
 */
export interface InvoiceEmailContent {
  subject?: string;
  beginning?: string;
  end?: string;
  summaryConfig?: Partial<InvoiceSummaryConfig>;
  includePayButton?: boolean;
  invoiceData?: InvoiceEmailPreviewData;
}

/**
 * Summary field definitions for invoice email
 */
interface InvoiceSummaryField {
  key: keyof InvoiceSummaryConfig;
  label: string;
  dataKey: keyof InvoiceEmailPreviewData;
  isTotal?: boolean;
  requiresValue?: boolean;
  formatAsCurrency?: boolean;
}

const INVOICE_SUMMARY_FIELDS: InvoiceSummaryField[] = [
  { key: 'includeJobName', label: 'Job Name:', dataKey: 'jobName' },
  { key: 'includeJobNumber', label: 'Job #:', dataKey: 'jobNumber', requiresValue: true },
  { key: 'includePO', label: 'PO #:', dataKey: 'customerPO', requiresValue: true },
  { key: 'includeInvoiceNumber', label: 'Invoice #:', dataKey: 'invoiceNumber' },
  { key: 'includeInvoiceDate', label: 'Invoice Date:', dataKey: 'invoiceDate' },
  { key: 'includeDueDate', label: 'Due Date:', dataKey: 'dueDate' },
  { key: 'includeSubtotal', label: 'Subtotal:', dataKey: 'subtotal', formatAsCurrency: true },
  { key: 'includeTax', label: 'Tax:', dataKey: 'tax', formatAsCurrency: true },
  { key: 'includeTotal', label: 'Total:', dataKey: 'total', isTotal: true, formatAsCurrency: true },
  { key: 'includeBalanceDue', label: 'Balance Due:', dataKey: 'balanceDue', formatAsCurrency: true }
];

/**
 * Format currency for display
 */
function formatCurrency(amount: number | undefined | null): string {
  if (amount === null || amount === undefined) return '-';
  return `$${amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format date for display (e.g., "January 15, 2025")
 */
function formatDateForEmail(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return '-';
  }
}

// escapeHtml imported from '../utils/htmlUtils'

/**
 * Build invoice summary box HTML (green theme)
 */
function buildInvoiceSummaryHtml(
  config: Partial<InvoiceSummaryConfig> | null,
  data: InvoiceEmailPreviewData
): string {
  if (!config) return '';

  const rows: string[] = [];

  for (const field of INVOICE_SUMMARY_FIELDS) {
    if (!config[field.key]) continue;

    const rawValue = data[field.dataKey];
    if (field.requiresValue && !rawValue) continue;

    let displayValue: string;
    if (field.formatAsCurrency && typeof rawValue === 'number') {
      displayValue = formatCurrency(rawValue);
    } else if (field.dataKey === 'invoiceDate' || field.dataKey === 'dueDate') {
      displayValue = formatDateForEmail(rawValue as string);
    } else {
      displayValue = String(rawValue ?? '-');
    }

    if (field.isTotal) {
      // Total row with green background
      rows.push(`<tr style="background-color: #86efac;"><td style="padding: 8px 12px; font-weight: 700; color: #166534; text-align: left;">${field.label}</td><td style="padding: 8px 12px; font-weight: 700; color: #166534; text-align: right;">${displayValue}</td></tr>`);
    } else {
      rows.push(`<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 6px 12px; font-weight: 600; color: #555; width: 40%; text-align: left;">${field.label}</td><td style="padding: 6px 12px; color: #333; text-align: right;">${displayValue}</td></tr>`);
    }
  }

  if (rows.length === 0) return '';

  // Green-themed summary box (light green background)
  return `
    <div style="border: 1px solid #16a34a; border-radius: 6px; padding: 0; margin: 20px auto; max-width: 350px; background: #f0fdf4; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Build pay button HTML
 * Shows button even without URL (for preview purposes)
 */
function buildPayButtonHtml(qbInvoiceUrl: string | undefined): string {
  // Use the URL if available, otherwise use # as placeholder for preview
  const href = qbInvoiceUrl || '#';

  return `
    <div style="text-align: center; margin: 25px 0;">
      <a href="${href}"
         style="display: inline-block; padding: 14px 32px; background-color: #16a34a; color: white; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        View &amp; Pay Invoice
      </a>
    </div>
  `;
}

/**
 * Generate styled invoice email preview HTML
 * Matches the 4-part estimate email structure but with green theme
 */
export async function generateInvoiceEmailPreview(
  orderId: number,
  emailContent?: InvoiceEmailContent
): Promise<{ subject: string; html: string }> {
  // Get order data
  const order = await orderPrepRepo.getOrderDataForQBEstimate(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  // Get invoice record
  const invoiceRecord = await qbInvoiceRepo.getOrderInvoiceRecord(orderId);

  // Load company settings for logo and footer
  const companySettings = await estimateEmailService.loadCompanySettings();
  const footerHtml = estimateEmailService.buildEmailFooterHtml(companySettings);

  // Build subject
  const subject = emailContent?.subject || `Invoice for Order #${order.order_number} - ${order.order_name}`;

  // Substitute template variables in beginning/end
  const customerName = order.customer_name || 'Valued Customer';
  const templateVars: Record<string, string> = {
    customerName,
    orderNumber: String(order.order_number),
    orderName: order.order_name || '',
    jobName: order.order_name || '',
    invoiceNumber: invoiceRecord?.qb_invoice_doc_number || ''
  };

  const substituteVars = (text: string): string => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => templateVars[key] ?? match);
  };

  const beginningText = substituteVars(emailContent?.beginning || '');
  const endText = substituteVars(emailContent?.end || '');

  // Prepare invoice data with defaults from order/invoice
  const invoiceData: InvoiceEmailPreviewData = {
    ...emailContent?.invoiceData,
    jobName: emailContent?.invoiceData?.jobName || order.order_name || undefined,
    jobNumber: emailContent?.invoiceData?.jobNumber || order.customer_job_number || undefined,
    customerPO: emailContent?.invoiceData?.customerPO || order.customer_po || undefined,
    invoiceNumber: emailContent?.invoiceData?.invoiceNumber || invoiceRecord?.qb_invoice_doc_number || undefined,
    qbInvoiceUrl: emailContent?.invoiceData?.qbInvoiceUrl || invoiceRecord?.qb_invoice_url || undefined,
    customerName
  };

  // Build summary HTML
  const summaryHtml = buildInvoiceSummaryHtml(emailContent?.summaryConfig || null, invoiceData);

  // Build pay button HTML
  const payButtonHtml = emailContent?.includePayButton !== false
    ? buildPayButtonHtml(invoiceData.qbInvoiceUrl)
    : '';

  // Build logo HTML
  const logoHtml = companySettings.company_logo_base64
    ? `<div style="margin-bottom: 20px; text-align: center;">
        <img src="data:image/png;base64,${companySettings.company_logo_base64}" alt="Company Logo" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />
        <hr style="border: none; border-top: 1px solid #ccc; margin: 15px auto 0; width: 80%;" />
       </div>`
    : '';

  // Build beginning/end HTML
  const beginningHtml = beginningText
    ? `<div style="margin: 20px 0; text-align: center; white-space: pre-wrap;">${escapeHtml(beginningText).replace(/\n/g, '<br>')}</div>`
    : '';
  const endHtml = endText
    ? `<div style="margin: 20px 0; text-align: center; white-space: pre-wrap;">${escapeHtml(endText).replace(/\n/g, '<br>')}</div>`
    : '';

  // Build full email HTML (green theme - border color #16a34a)
  const html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; border: 2px solid #16a34a; border-radius: 24px; background-color: #f7f7f5; }
        </style>
      </head>
      <body>
        <div class="container">
          ${logoHtml}
          ${beginningHtml}
          ${summaryHtml}
          ${payButtonHtml}
          ${endHtml}
          ${footerHtml}
        </div>
      </body>
    </html>
  `.trim();

  return { subject, html };
}
