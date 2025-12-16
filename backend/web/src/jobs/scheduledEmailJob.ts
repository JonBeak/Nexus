/**
 * Scheduled Email Job
 * Phase 2.e: QB Invoice Automation
 * Created: 2025-12-15
 *
 * Cron job that processes scheduled invoice emails.
 * Runs every 5 minutes and sends any emails whose scheduled_for time has passed.
 */

import cron from 'node-cron';
import * as qbInvoiceRepo from '../repositories/qbInvoiceRepository';
import { processScheduledEmail } from '../services/invoiceEmailService';

/**
 * Start the scheduled email processing job
 * Runs every 5 minutes to process pending scheduled emails
 */
export function startScheduledEmailJob(): void {
  // Schedule: */5 * * * * = Every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      // Get all pending emails that are due
      const pendingEmails = await qbInvoiceRepo.getPendingScheduledEmails();

      if (pendingEmails.length === 0) {
        // Only log if there was work to check (avoid spamming logs)
        return;
      }

      console.log(`📧 Processing ${pendingEmails.length} scheduled email(s)...`);

      let successCount = 0;
      let failureCount = 0;

      for (const email of pendingEmails) {
        console.log(`  → Sending scheduled email ${email.id} for order ${email.order_id}...`);

        const result = await processScheduledEmail(email);

        if (result.success) {
          successCount++;
          console.log(`    ✅ Sent successfully`);
        } else {
          failureCount++;
          console.error(`    ❌ Failed: ${result.error}`);
        }
      }

      // Summary
      if (successCount > 0 || failureCount > 0) {
        console.log(`📧 Scheduled email job complete: ${successCount} sent, ${failureCount} failed [${new Date().toISOString()}]`);
      }
    } catch (error) {
      console.error('❌ Scheduled email job error:', error instanceof Error ? error.message : 'Unknown error');
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
    }
  });

  console.log('📅 Scheduled email job started (every 5 minutes)');
}
