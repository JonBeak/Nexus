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
  userId: number
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
      if (BCC_EMAIL) console.log(`  Bcc: ${BCC_EMAIL}`);
      console.log(`  Subject: ${subject}`);
      console.log('\n  Body Preview (first 500 chars):');
      console.log('  ' + body.replace(/<[^>]*>/g, '').substring(0, 500) + '...');
      console.log('='.repeat(80) + '\n');

      // Mark invoice as sent even in disabled mode
      await qbInvoiceRepo.updateOrderInvoiceRecord(orderId, {
        invoice_sent_at: new Date()
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
      body
    );

    // Send email
    console.log(`📧 Sending invoice email for order ${orderId}...`);
    const response = await sendWithRetry(gmail, encodedMessage);
    const messageId = response.data?.id;

    console.log(`✅ Invoice email sent: ${messageId}`);

    // Mark invoice as sent
    await qbInvoiceRepo.updateOrderInvoiceRecord(orderId, {
      invoice_sent_at: new Date()
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
 */
export async function getEmailPreview(
  orderId: number,
  templateKey: EmailType
): Promise<EmailPreview> {
  // Get template
  const template = await qbInvoiceRepo.getEmailTemplate(templateKey);
  if (!template) {
    throw new Error(`Email template "${templateKey}" not found`);
  }

  // Get order data for variables
  const order = await orderPrepRepo.getOrderDataForQBEstimate(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  // Get invoice data
  const invoiceRecord = await qbInvoiceRepo.getOrderInvoiceRecord(orderId);

  // Get point persons for recipients
  const pointPersons = await orderPrepRepo.getOrderPointPersons(orderId);
  const recipientEmails = pointPersons.map((pp: { contact_email: string }) => pp.contact_email);

  // Build variables
  const variables: TemplateVariables = {
    orderNumber: String(order.order_number),
    customerName: order.customer_name,
    invoiceTotal: '0.00', // Will be updated when invoice exists
    qbInvoiceUrl: invoiceRecord?.qb_invoice_url || '#'
  };

  // Replace variables in subject and body
  const subject = replaceVariables(template.subject, variables);
  const body = replaceVariables(template.body, variables);

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
  htmlBody: string
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

  if (BCC_EMAIL && BCC_EMAIL.trim() !== '') {
    headers.push(`Bcc: ${BCC_EMAIL}`);
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
