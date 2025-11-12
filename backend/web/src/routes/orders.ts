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
import * as orderImageController from '../controllers/orderImageController';

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

/**
 * Validate order name uniqueness for customer (Phase 1.5.a)
 * GET /api/orders/validate-name?orderName=xxx&customerId=123
 */
router.get(
  '/validate-name',
  authenticateToken,
  requirePermission('orders.create'),
  orderController.validateOrderName
);

/**
 * Get order by estimate ID (Phase 1.5.a)
 * GET /api/orders/by-estimate/:estimateId
 */
router.get(
  '/by-estimate/:estimateId',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.getOrderByEstimate
);

/**
 * Calculate due date based on business days (Phase 1.5.a.5)
 * POST /api/orders/calculate-due-date
 * Body: { startDate: string (YYYY-MM-DD), turnaroundDays: number }
 */
router.post(
  '/calculate-due-date',
  authenticateToken,
  requirePermission('orders.create'),
  orderController.calculateDueDate
);

/**
 * Calculate business days between two dates (Phase 1.5.a.5)
 * POST /api/orders/calculate-business-days
 * Body: { startDate: string (YYYY-MM-DD), endDate: string (YYYY-MM-DD) }
 */
router.post(
  '/calculate-business-days',
  authenticateToken,
  requirePermission('orders.create'),
  orderController.calculateBusinessDays
);

/**
 * Get available task templates (Phase 1.5.c)
 * GET /api/orders/task-templates
 */
router.get(
  '/task-templates',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.getTaskTemplates
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

/**
 * Update order parts in bulk (Phase 1.5.c)
 * PUT /api/orders/:orderNumber/parts
 * Body: { parts: Array<{ part_id, product_type?, specifications?, invoice_description?, quantity?, unit_price?, extended_price? }> }
 */
router.put(
  '/:orderNumber/parts',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.updateOrderParts
);

/**
 * Update specs display name and regenerate specifications (Manager+ only)
 * PUT /api/orders/:orderNumber/parts/:partId/specs-display-name
 * Body: { specs_display_name: string }
 */
router.put(
  '/:orderNumber/parts/:partId/specs-display-name',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.updateSpecsDisplayName
);

/**
 * Toggle is_parent status for order part
 * PATCH /api/orders/:orderNumber/parts/:partId/toggle-parent
 */
router.patch(
  '/:orderNumber/parts/:partId/toggle-parent',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.toggleIsParent
);

/**
 * Update specs_qty for order part
 * PATCH /api/orders/:orderNumber/parts/:partId/specs-qty
 * Body: { specs_qty: number }
 */
router.patch(
  '/:orderNumber/parts/:partId/specs-qty',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.updatePartSpecsQty
);

/**
 * Add task to order part (Phase 1.5.c)
 * POST /api/orders/:orderNumber/parts/:partId/tasks
 * Body: { task_name: string, assigned_role?: string }
 */
router.post(
  '/:orderNumber/parts/:partId/tasks',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.addTaskToOrderPart
);

/**
 * Remove task from order (Phase 1.5.c)
 * DELETE /api/orders/tasks/:taskId
 */
router.delete(
  '/tasks/:taskId',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.removeTask
);

// =============================================
// ORDER FINALIZATION & SNAPSHOTS (Phase 1.5.c.3)
// =============================================

/**
 * Finalize order - create snapshots for all parts
 * POST /api/orders/:orderNumber/finalize
 */
router.post(
  '/:orderNumber/finalize',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.finalizeOrder
);

/**
 * Get latest snapshot for a part
 * GET /api/orders/parts/:partId/snapshot/latest
 */
router.get(
  '/parts/:partId/snapshot/latest',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.getPartLatestSnapshot
);

/**
 * Get all snapshots for a part (version history)
 * GET /api/orders/parts/:partId/snapshots
 */
router.get(
  '/parts/:partId/snapshots',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.getPartSnapshotHistory
);

/**
 * Compare part with latest snapshot
 * GET /api/orders/parts/:partId/compare
 */
router.get(
  '/parts/:partId/compare',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.comparePartWithSnapshot
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

// =============================================
// ORDER IMAGES (Phase 1.5.g)
// =============================================

/**
 * Get available images in order folder
 * GET /api/orders/:orderNumber/available-images
 */
router.get(
  '/:orderNumber/available-images',
  authenticateToken,
  requirePermission('orders.view'),
  orderImageController.getAvailableImages
);

/**
 * Set job image for order (Manager+ only)
 * PATCH /api/orders/:orderNumber/job-image
 * Body: { filename: "design.jpg" }
 */
router.patch(
  '/:orderNumber/job-image',
  authenticateToken,
  requirePermission('orders.update'),
  orderImageController.setJobImage
);

export default router;
