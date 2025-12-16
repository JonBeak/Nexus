/**
 * Payment Routes
 * Created: 2025-12-17
 *
 * API Routes for Multi-Invoice Payment Operations
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as qbPaymentController from '../controllers/qbPaymentController';

const router = Router();

// =============================================
// OPEN INVOICES
// =============================================

/**
 * Get open invoices for a customer
 * GET /api/payments/customer/:customerId/open-invoices
 * Returns all unpaid QB invoices for the customer
 */
router.get(
  '/customer/:customerId/open-invoices',
  authenticateToken,
  requirePermission('orders.view'),
  qbPaymentController.getOpenInvoices
);

// =============================================
// PAYMENT OPERATIONS
// =============================================

/**
 * Record a payment against multiple invoices
 * POST /api/payments
 * Creates a payment in QuickBooks that applies to selected invoices
 */
router.post(
  '/',
  authenticateToken,
  requirePermission('orders.create'),
  qbPaymentController.recordPayment
);

export default router;
