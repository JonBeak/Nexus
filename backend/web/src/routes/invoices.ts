/**
 * Invoice Listing Routes
 * Created: 2025-12-17
 *
 * API routes for the /invoices page - listing orders with invoice status.
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as invoiceListingController from '../controllers/invoiceListingController';
import * as qbInvoiceController from '../controllers/qbInvoiceController';

const router = Router();

// =============================================
// LISTING
// =============================================

/**
 * Get paginated invoice listing with filters
 * GET /api/invoices
 */
router.get(
  '/',
  authenticateToken,
  requirePermission('orders.view'),
  invoiceListingController.getInvoiceListing
);

/**
 * Get invoice analytics for dashboard cards
 * GET /api/invoices/analytics
 */
router.get(
  '/analytics',
  authenticateToken,
  requirePermission('orders.view'),
  invoiceListingController.getAnalytics
);

// =============================================
// BALANCE SYNC
// =============================================

/**
 * Sync balance for a single order from QuickBooks
 * POST /api/invoices/:orderId/sync-balance
 */
router.post(
  '/:orderId/sync-balance',
  authenticateToken,
  requirePermission('orders.view'),
  invoiceListingController.syncBalance
);

/**
 * Sync balances for multiple orders
 * POST /api/invoices/sync-balances
 */
router.post(
  '/sync-balances',
  authenticateToken,
  requirePermission('orders.view'),
  invoiceListingController.syncBalancesBatch
);

/**
 * Sync balances for orders with stale or missing cache
 * POST /api/invoices/sync-stale
 */
router.post(
  '/sync-stale',
  authenticateToken,
  requirePermission('orders.view'),
  invoiceListingController.syncStaleBalances
);

// =============================================
// QB INVOICE SEARCH
// =============================================

/**
 * Search for a QB invoice by doc number or ID (for linking)
 * GET /api/invoices/search?query=xxx&type=docNumber|id
 */
router.get(
  '/search',
  authenticateToken,
  requirePermission('orders.view'),
  qbInvoiceController.searchInvoice
);

export default router;
