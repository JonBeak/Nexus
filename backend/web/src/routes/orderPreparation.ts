/**
 * Order Preparation Routes
 *
 * HTTP routing for order preparation workflow endpoints.
 * Handles QB estimate creation, PDF generation, and preparation steps.
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as orderPrepController from '../controllers/orderPreparationController';

const router = express.Router();

/**
 * GET /api/order-preparation/:orderNumber/qb-estimate/staleness
 * Check if QB estimate is stale (order data changed since estimate created)
 */
router.get(
  '/:orderNumber/qb-estimate/staleness',
  authenticateToken,
  requirePermission('orders.prepare'),
  orderPrepController.checkQBEstimateStaleness
);

/**
 * POST /api/order-preparation/:orderNumber/qb-estimate
 * Create or recreate QB estimate for order
 */
router.post(
  '/:orderNumber/qb-estimate',
  authenticateToken,
  requirePermission('orders.prepare'),
  orderPrepController.createQBEstimate
);

/**
 * POST /api/order-preparation/:orderNumber/pdfs/order-form
 * Generate order form PDF
 */
router.post(
  '/:orderNumber/pdfs/order-form',
  authenticateToken,
  requirePermission('orders.prepare'),
  orderPrepController.generateOrderFormPDF
);

/**
 * POST /api/order-preparation/:orderNumber/pdfs/qb-estimate
 * Download QB estimate PDF and save to order folder
 */
router.post(
  '/:orderNumber/pdfs/qb-estimate',
  authenticateToken,
  requirePermission('orders.prepare'),
  orderPrepController.downloadQBEstimatePDF
);

/**
 * POST /api/order-preparation/:orderNumber/pdfs/save-to-folder
 * Save all PDFs to order folder (coordination step)
 */
router.post(
  '/:orderNumber/pdfs/save-to-folder',
  authenticateToken,
  requirePermission('orders.prepare'),
  orderPrepController.savePDFsToFolder
);

/**
 * GET /api/order-preparation/:orderNumber/validate
 * Validate order for preparation (placeholder for future validation logic)
 */
router.get(
  '/:orderNumber/validate',
  authenticateToken,
  requirePermission('orders.prepare'),
  orderPrepController.validateForPreparation
);

/**
 * POST /api/order-preparation/:orderNumber/tasks
 * Generate production tasks (placeholder for Phase 1.5.d)
 */
router.post(
  '/:orderNumber/tasks',
  authenticateToken,
  requirePermission('orders.prepare'),
  orderPrepController.generateProductionTasks
);

/**
 * GET /api/order-preparation/:orderNumber/point-persons
 * Get point persons for order (for Phase 1.5.c.6.3 - Send to Customer)
 */
router.get(
  '/:orderNumber/point-persons',
  authenticateToken,
  requirePermission('orders.view'),
  orderPrepController.getPointPersons
);

export default router;
