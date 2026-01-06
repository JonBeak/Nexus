// File Clean up Finished: 2025-11-18
// Cleanup Summary:
// - ✅ Removed savePDFsToFolder route (endpoint removed from controller)
// - ✅ 8 active routes remain (all used by frontend orderPreparationApi)
// - ✅ All routes use proper middleware chain: authenticateToken + requirePermission
// - ✅ File size: 126 lines (reduced from 135 lines)

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
 * GET /api/order-preparation/:orderNumber/pdfs/staleness
 * Check if order form PDFs are stale (order data changed since PDFs were generated)
 */
router.get(
  '/:orderNumber/pdfs/staleness',
  authenticateToken,
  requirePermission('orders.prepare'),
  orderPrepController.checkPDFStaleness
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
 * GET /api/order-preparation/:orderNumber/tasks/staleness
 * Check if production tasks are stale (order data changed since tasks were generated)
 */
router.get(
  '/:orderNumber/tasks/staleness',
  authenticateToken,
  requirePermission('orders.prepare'),
  orderPrepController.checkTaskStaleness
);

/**
 * POST /api/order-preparation/:orderNumber/tasks
 * Generate production tasks from order specifications
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

/**
 * GET /api/order-preparation/:orderNumber/email-preview
 * Get email preview HTML for Send to Customer step (legacy)
 */
router.get(
  '/:orderNumber/email-preview',
  authenticateToken,
  requirePermission('orders.view'),
  orderPrepController.getEmailPreview
);

/**
 * POST /api/order-preparation/:orderNumber/email-preview
 * Get styled email preview with customizable content
 */
router.post(
  '/:orderNumber/email-preview',
  authenticateToken,
  requirePermission('orders.view'),
  orderPrepController.getOrderEmailPreviewWithContent
);

/**
 * POST /api/order-preparation/:orderNumber/finalize
 * Finalize order and optionally send to customer
 * (Phase 1.5.c.6.3 - Send to Customer)
 */
router.post(
  '/:orderNumber/finalize',
  authenticateToken,
  requirePermission('orders.prepare'),
  orderPrepController.finalizeOrder
);

export default router;
