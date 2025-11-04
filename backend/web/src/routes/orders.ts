/**
 * Order Routes
 * API Routes for Orders System
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as orderController from '../controllers/orderController';
import * as orderConversionController from '../controllers/orderConversionController';
import * as orderFormController from '../controllers/orderFormController';

const router = Router();

// =============================================
// ORDER CONVERSION
// =============================================

/**
 * Convert estimate to order (Manager+ only)
 * POST /api/orders/convert-estimate
 */
router.post(
  '/convert-estimate',
  authenticateToken,
  requirePermission('orders.create'),
  orderConversionController.convertEstimateToOrder
);

/**
 * Validate estimate can be converted (Manager+ only)
 * GET /api/orders/convert-estimate/validate/:estimateId
 */
router.get(
  '/convert-estimate/validate/:estimateId',
  authenticateToken,
  requirePermission('orders.create'),
  orderConversionController.validateEstimateForConversion
);

// =============================================
// ORDER CRUD
// =============================================

/**
 * Get all orders (with optional filters)
 * GET /api/orders
 * Query params: status, customer_id, search, limit, offset
 */
router.get(
  '/',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.getAllOrders
);

/**
 * Get single order with details
 * GET /api/orders/:orderNumber
 */
router.get(
  '/:orderNumber',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.getOrderById
);

/**
 * Update order (Manager+ only)
 * PUT /api/orders/:orderNumber
 */
router.put(
  '/:orderNumber',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.updateOrder
);

/**
 * Delete order (pre-confirmation only, Manager+ only)
 * DELETE /api/orders/:orderNumber
 */
router.delete(
  '/:orderNumber',
  authenticateToken,
  requirePermission('orders.delete'),
  orderController.deleteOrder
);

// =============================================
// ORDER STATUS
// =============================================

/**
 * Update order status (Manager+ only)
 * PUT /api/orders/:orderNumber/status
 */
router.put(
  '/:orderNumber/status',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.updateOrderStatus
);

/**
 * Get status history
 * GET /api/orders/:orderNumber/status-history
 */
router.get(
  '/:orderNumber/status-history',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.getStatusHistory
);

// =============================================
// ORDER PROGRESS & TASKS
// =============================================

/**
 * Get order progress
 * GET /api/orders/:orderNumber/progress
 */
router.get(
  '/:orderNumber/progress',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.getOrderProgress
);

/**
 * Get all tasks for order (flat list)
 * GET /api/orders/:orderNumber/tasks
 */
router.get(
  '/:orderNumber/tasks',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.getOrderTasks
);

/**
 * Get tasks grouped by part
 * GET /api/orders/:orderNumber/tasks/by-part
 */
router.get(
  '/:orderNumber/tasks/by-part',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.getTasksByPart
);

/**
 * Update task completion (Manager+ only)
 * PUT /api/orders/:orderNumber/tasks/:taskId
 */
router.put(
  '/:orderNumber/tasks/:taskId',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.updateTaskCompletion
);

/**
 * Get all tasks grouped by production role (Manager+ only)
 * GET /api/orders/tasks/by-role
 * Query params: includeCompleted (boolean), hoursBack (number)
 */
router.get(
  '/tasks/by-role',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.getTasksByRole
);

/**
 * Batch update tasks (start/complete) (Manager+ only)
 * PUT /api/orders/tasks/batch-update
 * Body: { updates: Array<{ task_id, started?, completed? }> }
 */
router.put(
  '/tasks/batch-update',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.batchUpdateTasks
);

// =============================================
// ORDER FORMS (PDF Generation)
// =============================================

/**
 * Generate/regenerate all order forms (Manager+ only)
 * POST /api/orders/:orderNumber/forms
 * Body: { createNewVersion?: boolean }
 */
router.post(
  '/:orderNumber/forms',
  authenticateToken,
  requirePermission('orders.forms'),
  orderFormController.generateOrderForms
);

/**
 * Get form paths for an order
 * GET /api/orders/:orderNumber/forms
 * Query params: version (optional)
 */
router.get(
  '/:orderNumber/forms',
  authenticateToken,
  requirePermission('orders.view'),
  orderFormController.getFormPaths
);

/**
 * Check if forms exist for an order
 * GET /api/orders/:orderNumber/forms/exists
 */
router.get(
  '/:orderNumber/forms/exists',
  authenticateToken,
  requirePermission('orders.view'),
  orderFormController.checkFormsExist
);

/**
 * Download specific form (Manager+ only)
 * GET /api/orders/:orderNumber/forms/:formType
 * formType: 'master' | 'shop' | 'customer' | 'packing'
 * Query params: version (optional)
 */
router.get(
  '/:orderNumber/forms/:formType',
  authenticateToken,
  requirePermission('orders.forms'),
  orderFormController.downloadOrderForm
);

export default router;
