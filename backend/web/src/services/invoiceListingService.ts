/**
 * Invoice Listing Service
 * Created: 2025-12-17
 *
 * Business logic for the invoices page.
 * Handles listing, analytics, and balance synchronization with QuickBooks.
 */

import * as invoiceListingRepo from '../repositories/invoiceListingRepository';
import { getQBInvoice, getQBUnpaidInvoices } from '../utils/quickbooks/invoiceClient';
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';
import * as cashPaymentRepo from '../repositories/cashPaymentRepository';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import { orderService } from './orderService';
import { broadcastOrderStatus } from '../websocket/taskBroadcast';
import { checkAndAutoCompleteCashJob } from './cashPaymentService';
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
 * Optimized payment status check using single QB API call
 *
 * Strategy:
 * 1. Fetch ALL unpaid invoices from QB in one query (1 API call)
 * 2. Check awaiting_payment orders:
 *    - QB orders: if NOT in unpaid list → invoice paid → auto-complete
 *    - Cash orders: check local payment records
 * 3. Check completed orders for refunds:
 *    - QB orders: if IN unpaid list → balance reappeared → move to awaiting_payment
 *    - Cash orders: if balance > 0 → move to awaiting_payment
 *
 * Result: Replace N API calls with 1 total, plus catch refunds
 */
export async function checkAwaitingPaymentOrders(): Promise<{
  checked: number;
  autoCompleted: number;
  movedToAwaiting: number;
  errors: number;
}> {
  let autoCompleted = 0;
  let movedToAwaiting = 0;
  let errors = 0;
  let awaitingOrders: Array<{ order_id: number; order_number: number; qb_invoice_id: string | null; is_cash: boolean }> = [];

  try {
    const realmId = await quickbooksRepository.getDefaultRealmId();

    // === SINGLE QB API CALL: Get all unpaid invoices ===
    const unpaidInvoiceMap = new Map<string, { balance: number; total: number }>();
    if (realmId) {
      const unpaidInvoices = await getQBUnpaidInvoices(realmId);
      unpaidInvoices.forEach(inv => {
        unpaidInvoiceMap.set(inv.id, { balance: inv.balance, total: inv.total });
      });
      console.log(`📊 Loaded ${unpaidInvoiceMap.size} unpaid invoice(s) from QuickBooks`);
    }

    // === Check awaiting_payment orders ===
    awaitingOrders = await invoiceListingRepo.getAwaitingPaymentOrders();

    if (awaitingOrders.length > 0) {
      console.log(`🔍 Checking ${awaitingOrders.length} awaiting_payment order(s)...`);
    }

    for (const order of awaitingOrders) {
      try {
        if (order.is_cash) {
          // Cash jobs: check locally (no QB)
          const result = await checkAndAutoCompleteCashJob(order.order_id, order.order_number);
          if (result.autoCompleted) autoCompleted++;
        } else if (order.qb_invoice_id) {
          // QB invoice: check against unpaid list
          const unpaidData = unpaidInvoiceMap.get(order.qb_invoice_id);

          if (unpaidData) {
            // Still unpaid - update cached balance
            await invoiceListingRepo.updateCachedBalance(order.order_id, unpaidData.balance, unpaidData.total);
          } else {
            // NOT in unpaid list = paid! Auto-complete
            await invoiceListingRepo.updateCachedBalance(order.order_id, 0, null);
            await query(
              `UPDATE orders SET status = 'completed', updated_at = NOW() WHERE order_id = ?`,
              [order.order_id]
            );
            // Broadcast status change
            broadcastOrderStatus(order.order_id, order.order_number, 'completed', 'awaiting_payment', 0);
            console.log(`✅ Order #${order.order_number}: Invoice fully paid, moved to completed`);
            autoCompleted++;
          }
        }
      } catch (error) {
        console.error(`Error checking order #${order.order_number}:`, error);
        errors++;
      }
    }

    // === Check completed orders for refunds ===
    if (realmId) {
      const completedOrders = await invoiceListingRepo.getCompletedOrdersWithQBInvoice();

      for (const order of completedOrders) {
        try {
          const unpaidData = unpaidInvoiceMap.get(order.qb_invoice_id);
          if (unpaidData) {
            // Invoice is in unpaid list = refund happened!
            await invoiceListingRepo.updateCachedBalance(order.order_id, unpaidData.balance, unpaidData.total);
            await query(
              `UPDATE orders SET status = 'awaiting_payment', updated_at = NOW() WHERE order_id = ?`,
              [order.order_id]
            );
            // Broadcast status change
            broadcastOrderStatus(order.order_id, order.order_number, 'awaiting_payment', 'completed', 0);
            console.log(`⚠️  Order #${order.order_number}: Invoice has balance $${unpaidData.balance}, moved to awaiting_payment`);
            movedToAwaiting++;
          }
        } catch (error) {
          console.error(`Error checking completed order #${order.order_number}:`, error);
          errors++;
        }
      }
    }

    // === Check completed cash jobs with balance ===
    const cashOrdersWithBalance = await query(
      `SELECT order_id, order_number FROM orders
       WHERE status = 'completed' AND cash = 1
       AND COALESCE(cached_balance, 0) > 0`,
      []
    ) as RowDataPacket[];

    for (const order of cashOrdersWithBalance) {
      try {
        const total = await cashPaymentRepo.calculateOrderTotal(order.order_id);
        const totalPaid = await cashPaymentRepo.getTotalPaymentsForOrder(order.order_id);
        const balance = Math.max(0, total - totalPaid);

        if (balance > 0) {
          await cashPaymentRepo.updateOrderCachedBalance(order.order_id, balance, total);
          await query(
            `UPDATE orders SET status = 'awaiting_payment', updated_at = NOW() WHERE order_id = ?`,
            [order.order_id]
          );
          // Broadcast status change
          broadcastOrderStatus(order.order_id, order.order_number, 'awaiting_payment', 'completed', 0);
          console.log(`⚠️  Cash order #${order.order_number}: Has balance $${balance}, moved to awaiting_payment`);
          movedToAwaiting++;
        }
      } catch (error) {
        console.error(`Error checking cash order #${order.order_number}:`, error);
        errors++;
      }
    }

  } catch (error) {
    console.error('Error in payment check:', error);
    errors++;
  }

  const totalChecked = awaitingOrders.length;
  if (autoCompleted > 0 || movedToAwaiting > 0) {
    console.log(`✅ Payment check: ${autoCompleted} completed, ${movedToAwaiting} moved to awaiting, ${errors} errors`);
  }

  return { checked: totalChecked, autoCompleted, movedToAwaiting, errors };
}
