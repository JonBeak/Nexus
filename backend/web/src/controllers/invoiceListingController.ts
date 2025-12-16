/**
 * Invoice Listing Controller
 * Created: 2025-12-17
 *
 * HTTP handlers for the invoices page API endpoints.
 */

import { Request, Response } from 'express';
import * as invoiceListingService from '../services/invoiceListingService';
import { InvoiceFilters } from '../types/invoiceListing';

// =============================================
// GET /api/invoices
// =============================================

/**
 * Get paginated invoice listing with filters
 */
export async function getInvoiceListing(req: Request, res: Response): Promise<void> {
  try {
    const filters: InvoiceFilters = {
      // Invoice status filters
      invoiceStatus: req.query.invoiceStatus as 'all' | 'invoiced' | 'not_invoiced' | undefined,
      balanceStatus: req.query.balanceStatus as 'all' | 'open' | 'paid' | undefined,
      sentStatus: req.query.sentStatus as 'all' | 'sent' | 'not_sent' | undefined,
      depositStatus: req.query.depositStatus as 'all' | 'required' | 'paid' | 'not_required' | undefined,

      // Order filters
      orderStatus: req.query.orderStatus as string | undefined,
      customerId: req.query.customerId ? parseInt(req.query.customerId as string) : undefined,

      // Date range
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,

      // Search
      search: req.query.search as string | undefined,

      // Sorting
      sortBy: req.query.sortBy as InvoiceFilters['sortBy'],
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,

      // Pagination
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50
    };

    const result = await invoiceListingService.getInvoiceListing(filters);
    res.json(result);
  } catch (error) {
    console.error('Error fetching invoice listing:', error);
    res.status(500).json({
      error: 'Failed to fetch invoice listing',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// =============================================
// GET /api/invoices/analytics
// =============================================

/**
 * Get invoice analytics for dashboard cards
 */
export async function getAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const analytics = await invoiceListingService.getAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching invoice analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch invoice analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// =============================================
// POST /api/invoices/:orderId/sync-balance
// =============================================

/**
 * Sync balance for a single order from QuickBooks
 */
export async function syncBalance(req: Request, res: Response): Promise<void> {
  try {
    const orderId = parseInt(req.params.orderId);

    if (isNaN(orderId)) {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }

    const result = await invoiceListingService.syncOrderBalance(orderId);
    res.json(result);
  } catch (error) {
    console.error('Error syncing balance:', error);
    res.status(500).json({
      error: 'Failed to sync balance',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// =============================================
// POST /api/invoices/sync-balances
// =============================================

/**
 * Sync balances for multiple orders
 */
export async function syncBalancesBatch(req: Request, res: Response): Promise<void> {
  try {
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      res.status(400).json({ error: 'orderIds array is required' });
      return;
    }

    // Limit batch size
    if (orderIds.length > 100) {
      res.status(400).json({ error: 'Maximum 100 orders per batch' });
      return;
    }

    const result = await invoiceListingService.syncBalancesBatch(orderIds);
    res.json(result);
  } catch (error) {
    console.error('Error syncing balances batch:', error);
    res.status(500).json({
      error: 'Failed to sync balances',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// =============================================
// POST /api/invoices/sync-stale
// =============================================

/**
 * Sync balances for orders with stale or missing cache
 */
export async function syncStaleBalances(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.body.limit ? parseInt(req.body.limit) : 50;
    const result = await invoiceListingService.syncStaleBalances(limit);
    res.json(result);
  } catch (error) {
    console.error('Error syncing stale balances:', error);
    res.status(500).json({
      error: 'Failed to sync stale balances',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
