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

  return {
    orderId,
    orderNumber: order.order_number,
    qbInvoiceId: order.qb_invoice_id,
    previousBalance: order.cached_balance,
    newBalance: qbInvoice.Balance,
    total: qbInvoice.TotalAmt,
    syncedAt: new Date().toISOString()
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
