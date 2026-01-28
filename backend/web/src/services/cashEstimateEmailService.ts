/**
 * Cash Estimate Email Service
 * Handles estimate email sending for cash jobs
 *
 * @module services/cashEstimateEmailService
 * @created 2025-01-27
 */

import { createGmailClient } from './gmailAuthService';
import { query } from '../config/database';
import MailComposer from 'nodemailer/lib/mail-composer';
import * as fs from 'fs/promises';

// Gmail API Configuration
const GMAIL_ENABLED = process.env.GMAIL_ENABLED === 'true';
const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || 'info@signhouse.ca';
const SENDER_NAME = process.env.GMAIL_SENDER_NAME || 'Sign House';
const BCC_EMAIL = process.env.GMAIL_BCC_EMAIL || '';

// PDF cache directory
const PDF_CACHE_DIR = '/tmp/estimate-pdf-cache';

// =============================================
// PDF DOWNLOAD HELPERS
// =============================================

async function ensurePdfCacheDir(): Promise<void> {
  try {
    await fs.access(PDF_CACHE_DIR);
  } catch {
    await fs.mkdir(PDF_CACHE_DIR, { recursive: true });
  }
}

/**
 * Download estimate PDF from QuickBooks with retry logic
 */
async function downloadEstimatePdfWithRetry(
  qbEstimateId: string,
  qbDocNumber: string | undefined
): Promise<string> {
  await ensurePdfCacheDir();

  const cachePath = `${PDF_CACHE_DIR}/estimate-${qbEstimateId}.pdf`;

  // Check cache first
  try {
    await fs.access(cachePath);
    console.log(`📎 Using cached estimate PDF: ${cachePath}`);
    return cachePath;
  } catch {
    // Cache miss - need to download
  }

  // Get realm ID for QB API
  const { quickbooksRepository } = await import('../repositories/quickbooksRepository');
  const realmId = await quickbooksRepository.getDefaultRealmId();
  if (!realmId) {
    throw new Error('QuickBooks not configured - cannot download estimate PDF');
  }

  // Import the QB estimate PDF function
  const { getQBEstimatePdf } = await import('../utils/quickbooks/apiClient');

  // Retry logic with exponential backoff
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`📎 Downloading estimate PDF (attempt ${attempt}/${MAX_RETRIES})...`);
      const pdfBuffer = await getQBEstimatePdf(qbEstimateId, realmId);

      // Save to cache
      await fs.writeFile(cachePath, pdfBuffer);
      console.log(`✅ Estimate PDF downloaded and cached: ${cachePath} (${Math.round(pdfBuffer.length / 1024)}KB)`);

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

  throw new Error(`Failed to download estimate PDF after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}. Email not sent.`);
}

// =============================================
// EMAIL SENDING
// =============================================

interface SendEstimateEmailParams {
  orderId: number;
  orderNumber: number;
  recipientEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
  subject: string;
  body: string;
  attachEstimatePdf: boolean;
  qbEstimateId?: string;
  qbEstimateDocNumber?: string;
  userId: number;
}

/**
 * Send estimate email to customer
 */
export async function sendEstimateEmailToCustomer(
  params: SendEstimateEmailParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    orderId,
    orderNumber,
    recipientEmails,
    ccEmails,
    bccEmails,
    subject,
    body,
    attachEstimatePdf,
    qbEstimateId,
    qbEstimateDocNumber,
    userId
  } = params;

  try {
    // Validate recipients
    if (!recipientEmails || recipientEmails.length === 0) {
      return { success: false, error: 'No recipients specified' };
    }

    // Download PDF if requested
    let pdfPath: string | null = null;
    if (attachEstimatePdf) {
      if (!qbEstimateId) {
        return { success: false, error: 'Cannot attach PDF: No QuickBooks estimate linked.' };
      }

      try {
        pdfPath = await downloadEstimatePdfWithRetry(qbEstimateId, qbEstimateDocNumber);
      } catch (pdfError) {
        const errorMsg = pdfError instanceof Error ? pdfError.message : 'Failed to download PDF';
        console.error('❌ PDF attachment failed:', errorMsg);
        return { success: false, error: errorMsg };
      }
    }

    // Check if Gmail is enabled
    if (!GMAIL_ENABLED) {
      console.log('\n' + '='.repeat(80));
      console.log('[GMAIL DISABLED] Estimate email would be sent:');
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

      // Mark estimate as sent and create email history
      const sentAt = new Date();
      await query('UPDATE orders SET invoice_sent_at = ? WHERE order_id = ?', [sentAt, orderId]);

      await query(
        `INSERT INTO scheduled_emails
          (order_id, email_type, recipient_emails, cc_emails, subject, body, scheduled_for, created_by, status, sent_at)
        VALUES (?, 'cash_estimate', ?, ?, ?, ?, ?, ?, 'sent', ?)`,
        [orderId, JSON.stringify(recipientEmails), ccEmails?.length ? JSON.stringify(ccEmails) : null, subject, body, sentAt, userId, sentAt]
      );

      return { success: true, messageId: 'gmail-disabled' };
    }

    // Gmail is enabled - send the actual email
    const gmail = await createGmailClient();

    // Build attachments
    const attachments: Array<{ filename: string; path: string }> = [];
    if (pdfPath) {
      const filename = qbEstimateDocNumber
        ? `Estimate-${qbEstimateDocNumber}.pdf`
        : `Estimate-${orderNumber}.pdf`;
      attachments.push({ filename, path: pdfPath });
    }

    // Combine BCC lists
    const allBcc = [...bccEmails];
    if (BCC_EMAIL && !allBcc.includes(BCC_EMAIL)) {
      allBcc.push(BCC_EMAIL);
    }

    // Build email with MailComposer
    const mail = new MailComposer({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: recipientEmails.join(', '),
      cc: ccEmails?.length ? ccEmails.join(', ') : undefined,
      bcc: allBcc.length ? allBcc.join(', ') : undefined,
      subject,
      html: body,
      attachments
    });

    const message = await mail.compile().build();
    const encodedMessage = message.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`✅ Estimate email sent successfully. Message ID: ${response.data.id}`);

    // Update sent timestamp and create email history
    const sentAt = new Date();
    await query('UPDATE orders SET invoice_sent_at = ? WHERE order_id = ?', [sentAt, orderId]);

    await query(
      `INSERT INTO scheduled_emails
        (order_id, email_type, recipient_emails, cc_emails, subject, body, scheduled_for, created_by, status, sent_at)
      VALUES (?, 'cash_estimate', ?, ?, ?, ?, ?, ?, 'sent', ?)`,
      [orderId, JSON.stringify(recipientEmails), ccEmails?.length ? JSON.stringify(ccEmails) : null, subject, body, sentAt, userId, sentAt]
    );

    return { success: true, messageId: response.data.id || undefined };
  } catch (error) {
    console.error('Error sending estimate email:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to send email';
    return { success: false, error: errorMsg };
  }
}

// =============================================
// EMAIL SCHEDULING
// =============================================

interface ScheduleEstimateEmailParams {
  orderId: number;
  recipientEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
  subject: string;
  body: string;
  attachEstimatePdf: boolean;
  scheduledFor: Date;
  userId: number;
}

/**
 * Schedule estimate email for later delivery
 */
export async function scheduleEstimateEmailForLater(
  params: ScheduleEstimateEmailParams
): Promise<{ scheduledEmailId: number }> {
  const {
    orderId,
    recipientEmails,
    ccEmails,
    bccEmails,
    subject,
    body,
    scheduledFor,
    userId
  } = params;

  // Create scheduled email record
  const result = await query(
    `INSERT INTO scheduled_emails
      (order_id, email_type, recipient_emails, cc_emails, subject, body, scheduled_for, created_by, status)
    VALUES (?, 'cash_estimate', ?, ?, ?, ?, ?, ?, 'pending')`,
    [orderId, JSON.stringify(recipientEmails), ccEmails?.length ? JSON.stringify(ccEmails) : null, subject, body, scheduledFor, userId]
  ) as any;

  console.log(`📅 Estimate email scheduled for ${scheduledFor.toISOString()}. ID: ${result.insertId}`);

  return { scheduledEmailId: result.insertId };
}
