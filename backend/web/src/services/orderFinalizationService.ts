/**
 * Order Finalization Service
 * Phase 1.5.c.6.3: Send to Customer
 *
 * Handles the final step of order preparation workflow:
 * - Updates order status to pending_confirmation
 * - Creates status history entry
 * - Sends email to customer (placeholder for Phase 2)
 */

import { pool } from '../config/database';
import { orderService } from './orderService';
import { sendFinalizationEmail, OrderEmailContent } from './gmailService';
import { PoolConnection } from 'mysql2/promise';
import * as orderPrepRepo from '../repositories/orderPreparationRepository';

export interface RecipientSelection {
  to: string[];
  cc: string[];
  bcc: string[];
}

export interface FinalizationOptions {
  orderNumber: number;
  sendEmail: boolean;
  recipients?: string[];  // Legacy: simple list (all To)
  recipientSelection?: RecipientSelection;  // New: To/CC/BCC
  emailContent?: OrderEmailContent;  // New: customizable email content
  userId: number;
  orderName?: string;
  pdfUrls?: {
    orderForm: string | null;
    qbEstimate: string | null;
  };
}

export interface FinalizationResult {
  success: boolean;
  emailSent: boolean;
  statusUpdated: boolean;
  message: string;
  error?: string;
}

/**
 * Finalize order to customer
 *
 * This is the final step in the order preparation workflow.
 * Updates order status to pending_confirmation and optionally sends
 * notification email to customer point persons.
 *
 * @param options - Finalization options including recipients and email flag
 * @returns Result with success status and details
 */
export async function finalizeOrderToCustomer(
  options: FinalizationOptions
): Promise<FinalizationResult> {
  // Get order_id from order_number (before acquiring connection)
  const orderId = await orderService.tryGetOrderIdFromOrderNumber(options.orderNumber);

  if (!orderId) {
    throw new Error(`Order #${options.orderNumber} not found`);
  }

  // Idempotency check: Early return if order is already finalized
  // This prevents duplicate submissions from spam clicking
  const order = await orderService.getOrderById(orderId);

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.status === 'pending_confirmation') {
    console.log(`[OrderFinalization] Order #${options.orderNumber} already finalized (status: pending_confirmation)`);

    return {
      success: true,
      emailSent: false, // Don't send duplicate email
      statusUpdated: false, // Status wasn't changed (already correct)
      message: 'Order already finalized'
    };
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Normalize recipients (support both old and new format)
    const recipients: RecipientSelection = options.recipientSelection || {
      to: options.recipients || [],
      cc: [],
      bcc: []
    };

    const totalRecipients = recipients.to.length + recipients.cc.length + recipients.bcc.length;

    // Build status history notes
    let notes = '';
    if (options.sendEmail && totalRecipients > 0) {
      const parts: string[] = [];
      if (recipients.to.length > 0) parts.push(`To: ${recipients.to.join(', ')}`);
      if (recipients.cc.length > 0) parts.push(`CC: ${recipients.cc.join(', ')}`);
      if (recipients.bcc.length > 0) parts.push(`BCC: ${recipients.bcc.length} recipient(s)`);
      notes = `Order finalized and sent to ${totalRecipients} recipient${totalRecipients > 1 ? 's' : ''}: ${parts.join('; ')}`;
    } else {
      notes = 'Order finalized (email skipped)';
    }

    // Update order status to pending_confirmation
    // Uses existing orderService which handles status validation and history creation
    await orderService.updateOrderStatus(
      orderId,
      'pending_confirmation',
      options.userId,
      notes
    );

    // Commit transaction - order status is now updated
    await connection.commit();

    // Send email (placeholder - doesn't block finalization)
    let emailSent = false;
    if (options.sendEmail && totalRecipients > 0) {
      try {
        // Get customer name for email personalization
        const orderData = await orderPrepRepo.getOrderDataForQBEstimate(orderId);

        // Frontend builds orderName with Job # and PO # already included
        const emailResult = await sendFinalizationEmail({
          recipients: recipients.to,  // To recipients
          ccRecipients: recipients.cc,  // CC recipients
          bccRecipients: recipients.bcc,  // BCC recipients
          orderNumber: options.orderNumber,
          orderName: options.orderName || `Order #${options.orderNumber}`,
          customerName: orderData?.customer_name || undefined,
          emailContent: options.emailContent,
          pdfUrls: options.pdfUrls || { orderForm: null, qbEstimate: null }
        });

        emailSent = emailResult.success;
      } catch (emailError) {
        // Email failure doesn't block finalization
        console.error('[OrderFinalization] Email send failed (non-blocking):', emailError);
        emailSent = false;
      }
    }

    return {
      success: true,
      emailSent,
      statusUpdated: true,
      message: options.sendEmail && totalRecipients > 0
        ? `Order finalized successfully. Email ${emailSent ? 'sent' : 'queued'} to ${totalRecipients} recipient(s).`
        : 'Order finalized successfully (email skipped).'
    };

  } catch (error) {
    // Rollback transaction on any error
    await connection.rollback();

    console.error('[OrderFinalization] Finalization failed:', error);

    return {
      success: false,
      emailSent: false,
      statusUpdated: false,
      message: 'Failed to finalize order',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    connection.release();
  }
}

/**
 * Skip email and finalize order
 * Convenience method that calls finalizeOrderToCustomer with sendEmail=false
 *
 * @param orderNumber - Order number
 * @param userId - User performing the action
 * @returns Finalization result
 */
export async function skipEmailAndFinalize(
  orderNumber: number,
  userId: number
): Promise<FinalizationResult> {
  return await finalizeOrderToCustomer({
    orderNumber,
    sendEmail: false,
    recipients: [],
    userId
  });
}
