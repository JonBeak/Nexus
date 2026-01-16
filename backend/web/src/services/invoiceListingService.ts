/**
 * Invoice Listing Service
 * Created: 2025-12-17
 *
 * Business logic for the invoices page.
 * Handles listing, analytics, and balance synchronization with QuickBooks.
 */

import * as invoiceListingRepo from '../repositories/invoiceListingRepository';
import { getQBInvoice } from '../utils/quickbooks/invoiceClient';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import { orderService } from './orderService';
import { broadcastOrderStatus } from '../websocket/taskBroadcast';
import {
  InvoiceFilters,
  InvoiceListingResponse,
  InvoiceAnalytics,
  BalanceSyncResult,
  BatchBalanceSyncResult
} from '../types/invoiceListing';

// =============================================
// LISTING
// =============================================

/**
 * Get paginated invoice listing with filters
 */
export async function getInvoiceListing(
  filters: InvoiceFilters
): Promise<InvoiceListingResponse> {
  return invoiceListingRepo.getOrdersForInvoiceListing(filters);
}

// =============================================
// ANALYTICS
// =============================================

/**
 * Get invoice analytics for the dashboard cards
 */
export async function getAnalytics(): Promise<InvoiceAnalytics> {
  return invoiceListingRepo.getInvoiceAnalytics();
}

// =============================================
// BALANCE SYNC
// =============================================

/**
 * Sync balance for a single order from QuickBooks
 */
export async function syncOrderBalance(orderId: number): Promise<BalanceSyncResult> {
  // 1. Get order data
  const order = await invoiceListingRepo.getOrderForBalanceSync(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  if (!order.qb_invoice_id) {
    throw new Error('Order has no linked invoice');
  }

  // 2. Get QuickBooks realm ID
  const realmId = await quickbooksRepository.getDefaultRealmId();
  if (!realmId) {
    throw new Error('QuickBooks realm ID not configured');
  }

  // 3. Fetch invoice from QB
  const qbInvoice = await getQBInvoice(order.qb_invoice_id, realmId);

  // 4. Update cached values
  await invoiceListingRepo.updateCachedBalance(
    orderId,
    qbInvoice.Balance,
    qbInvoice.TotalAmt
  );

  console.log(`Synced balance for order #${order.order_number}: $${qbInvoice.Balance} / $${qbInvoice.TotalAmt}`);

  // 5. Auto-complete if balance is 0 and order is in awaiting_payment
  let autoCompleted = false;
  if (qbInvoice.Balance === 0 && order.status === 'awaiting_payment') {
    try {
      await orderService.updateOrderStatus(
        orderId,
        'completed',
        0, // System user ID
        'Auto-completed: Invoice fully paid'
      );
      // Broadcast status change via WebSocket
      broadcastOrderStatus(orderId, order.order_number, 'completed', 'awaiting_payment', 0);
      console.log(`✅ Order #${order.order_number} auto-completed: invoice fully paid`);
      autoCompleted = true;
    } catch (error) {
      console.error(`Failed to auto-complete order #${order.order_number}:`, error);
    }
  }

  return {
    orderId,
    orderNumber: order.order_number,
    qbInvoiceId: order.qb_invoice_id,
    previousBalance: order.cached_balance,
    newBalance: qbInvoice.Balance,
    total: qbInvoice.TotalAmt,
    syncedAt: new Date().toISOString(),
    autoCompleted
  };
}

/**
 * Sync balances for multiple orders
 */
export async function syncBalancesBatch(
  orderIds: number[]
): Promise<BatchBalanceSyncResult> {
  const synced: BalanceSyncResult[] = [];
  const errors: Array<{ orderId: number; orderNumber: number; error: string }> = [];

  for (const orderId of orderIds) {
    try {
      const result = await syncOrderBalance(orderId);
      synced.push(result);
    } catch (error) {
      const order = await invoiceListingRepo.getOrderForBalanceSync(orderId);
      errors.push({
        orderId,
        orderNumber: order?.order_number || 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return {
    synced,
    errors,
    totalSynced: synced.length,
    totalErrors: errors.length
  };
}

/**
 * Sync balances for orders with stale or missing cache data
 * Called by background job or manual refresh
 */
export async function syncStaleBalances(
  limit: number = 50
): Promise<BatchBalanceSyncResult> {
  // Get orders needing sync
  const ordersToSync = await invoiceListingRepo.getOrdersNeedingBalanceSync(limit);

  if (ordersToSync.length === 0) {
    return {
      synced: [],
      errors: [],
      totalSynced: 0,
      totalErrors: 0
    };
  }

  const orderIds = ordersToSync.map(o => o.order_id);
  return syncBalancesBatch(orderIds);
}

// =============================================
// AUTO-COMPLETE AWAITING PAYMENT ORDERS
// =============================================

/**
 * Check all orders in awaiting_payment status with linked invoices
 * Syncs balance from QB and auto-completes if fully paid
 * Called on page load and every 5 minutes via server interval
 */
export async function checkAwaitingPaymentOrders(): Promise<{
  checked: number;
  autoCompleted: number;
  errors: number;
}> {
  const orders = await invoiceListingRepo.getAwaitingPaymentOrders();

  if (orders.length === 0) {
    return { checked: 0, autoCompleted: 0, errors: 0 };
  }

  console.log(`🔍 Checking ${orders.length} awaiting_payment order(s) for payment...`);

  let autoCompleted = 0;
  let errors = 0;

  for (const order of orders) {
    try {
      const result = await syncOrderBalance(order.order_id);
      if (result.autoCompleted) {
        autoCompleted++;
      }
    } catch (error) {
      console.error(`Error checking order #${order.order_number}:`, error);
      errors++;
    }
  }

  console.log(`✅ Payment check complete: ${orders.length} checked, ${autoCompleted} auto-completed, ${errors} errors`);

  return {
    checked: orders.length,
    autoCompleted,
    errors
  };
}
