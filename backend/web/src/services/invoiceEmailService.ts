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
import {
  ScheduledEmailInput,
  ScheduledEmail,
  EmailType,
  EmailPreview,
  TemplateVariables
} from '../types/qbInvoice';

// Gmail API Configuration
const GMAIL_ENABLED = process.env.GMAIL_ENABLED === 'true';
const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || 'info@signhouse.ca';
const SENDER_NAME = process.env.GMAIL_SENDER_NAME || 'Sign House';
const BCC_EMAIL = process.env.GMAIL_BCC_EMAIL || '';

// =============================================
// EMAIL SENDING
// =============================================

/**
 * Send invoice email immediately
 */
export async function sendInvoiceEmail(
  orderId: number,
  recipientEmails: string[],
  ccEmails: string[],
  subject: string,
  body: string,
  userId: number,
  bccEmails?: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Validate recipients
    if (!recipientEmails || recipientEmails.length === 0) {
      return { success: false, error: 'No recipients specified' };
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

    // Build email message
    const encodedMessage = buildEmailMessage(
      recipientEmails,
      ccEmails,
      subject,
      body,
      bccEmails
    );

    // Send email
    console.log(`📧 Sending invoice email for order ${orderId}...`);
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
      if (details.total) {
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

  // Replace {variableName} format
  result = result.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key as keyof TemplateVariables];
    return value !== undefined ? String(value) : match;
  });

  // Also replace #{variableName} format (for order numbers)
  result = result.replace(/#\{(\w+)\}/g, (match, key) => {
    const value = variables[key as keyof TemplateVariables];
    return value !== undefined ? `#${value}` : match;
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
 */
export async function processScheduledEmail(
  scheduledEmail: ScheduledEmail
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await sendInvoiceEmail(
      scheduledEmail.order_id,
      scheduledEmail.recipient_emails,
      scheduledEmail.cc_emails || [],
      scheduledEmail.subject,
      scheduledEmail.body,
      scheduledEmail.created_by
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
