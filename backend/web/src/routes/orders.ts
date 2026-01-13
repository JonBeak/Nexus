// File Clean up Finished: 2025-11-15
// Analysis: File is pristine - no cleanup needed
// - Perfect 3-layer architecture (Route → Controller with proper middleware)
// - All 4 imported controllers exist, are used, and are already cleaned
// - No database access (correct - routes delegate to controllers)
// - Excellent documentation and organization
// - 467 lines (within limits)
// - No technical debt
/**
 * Order Routes
 * API Routes for Orders System
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as orderController from '../controllers/orders';
import * as orderConversionController from '../controllers/orderConversionController';
import * as orderFormController from '../controllers/orderFormController';
import * as orderImageController from '../controllers/orderImageController';
import * as qbInvoiceController from '../controllers/qbInvoiceController';

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

/**
 * Get task metadata - Single Source of Truth (Phase 2.a)
 * GET /api/orders/metadata/tasks
 * Returns TASK_ORDER, TASK_ROLE_MAP, and AUTO_HIDE_COLUMNS
 * Used by frontend TasksTable for column ordering and role colors
 */
router.get(
  '/metadata/tasks',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.getTaskMetadata
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
 * Get customer tax from billing address
 * GET /api/orders/:orderNumber/customer-tax
 * Returns tax_name for order's customer based on billing address province
 */
router.get(
  '/:orderNumber/customer-tax',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.getCustomerTax
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
 * Update order point persons
 * PUT /api/orders/:orderNumber/point-persons
 * Body: { pointPersons: Array<{ contact_id?, contact_email, contact_name?, saveToDatabase? }> }
 */
router.put(
  '/:orderNumber/point-persons',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.updateOrderPointPersons
);

/**
 * Update order accounting emails
 * PUT /api/orders/:orderNumber/accounting-emails
 * Body: { accountingEmails: Array<{ email, email_type, label?, saveToDatabase? }> }
 */
router.put(
  '/:orderNumber/accounting-emails',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.updateOrderAccountingEmails
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
 * Reorder parts in bulk (for drag-and-drop)
 * PATCH /api/orders/:orderNumber/parts/reorder
 * Body: { partIds: number[] }
 */
router.patch(
  '/:orderNumber/parts/reorder',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.reorderParts
);

/**
 * Duplicate a part row with specified data mode (Phase 1.5.e)
 * POST /api/orders/:orderNumber/parts/:partId/copy
 * Body: { mode: 'specs' | 'invoice' | 'both' }
 */
router.post(
  '/:orderNumber/parts/:partId/copy',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.duplicatePart
);

/**
 * Add a new part row to the order
 * POST /api/orders/:orderNumber/parts/add
 */
router.post(
  '/:orderNumber/parts/add',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.addPartRow
);

/**
 * Remove a part row from the order
 * DELETE /api/orders/:orderNumber/parts/:partId/remove
 */
router.delete(
  '/:orderNumber/parts/:partId/remove',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.removePartRow
);

/**
 * Add task to order part (Phase 1.5.e)
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

/**
 * Remove all tasks for a specific part
 * DELETE /api/orders/parts/:partId/tasks
 * Used to exclude a part from Job Progress view
 */
router.delete(
  '/parts/:partId/tasks',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.removeTasksForPart
);

/**
 * Update task notes
 * PUT /api/orders/tasks/:taskId/notes
 */
router.put(
  '/tasks/:taskId/notes',
  authenticateToken,
  requirePermission('orders.update'),
  orderController.updateTaskNotes
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
 * Get all parts with tasks for the Tasks Table (Phase 2.a)
 * GET /api/orders/parts/with-tasks
 * Query params: status, hideCompleted, search
 */
router.get(
  '/parts/with-tasks',
  authenticateToken,
  requirePermission('orders.view'),
  orderController.getPartsWithTasks
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

// =============================================
// QB INVOICE AUTOMATION (Phase 2.e)
// =============================================

/**
 * Create QB invoice from order (Manager+ only)
 * POST /api/orders/:orderNumber/qb-invoice
 */
router.post(
  '/:orderNumber/qb-invoice',
  authenticateToken,
  requirePermission('orders.update'),
  qbInvoiceController.createInvoice
);

/**
 * Update QB invoice from order (Manager+ only)
 * PUT /api/orders/:orderNumber/qb-invoice
 */
router.put(
  '/:orderNumber/qb-invoice',
  authenticateToken,
  requirePermission('orders.update'),
  qbInvoiceController.updateInvoice
);

/**
 * Get invoice details
 * GET /api/orders/:orderNumber/qb-invoice
 */
router.get(
  '/:orderNumber/qb-invoice',
  authenticateToken,
  requirePermission('orders.view'),
  qbInvoiceController.getInvoice
);

/**
 * Link existing QB invoice to order (Manager+ only)
 * POST /api/orders/:orderNumber/qb-invoice/link
 */
router.post(
  '/:orderNumber/qb-invoice/link',
  authenticateToken,
  requirePermission('orders.update'),
  qbInvoiceController.linkInvoice
);

/**
 * Unlink QB invoice from order (Manager+ only)
 * DELETE /api/orders/:orderNumber/qb-invoice/link
 */
router.delete(
  '/:orderNumber/qb-invoice/link',
  authenticateToken,
  requirePermission('orders.update'),
  qbInvoiceController.unlinkInvoice
);

/**
 * Verify if linked QB invoice still exists in QuickBooks
 * GET /api/orders/:orderNumber/qb-invoice/verify
 */
router.get(
  '/:orderNumber/qb-invoice/verify',
  authenticateToken,
  requirePermission('orders.view'),
  qbInvoiceController.verifyInvoice
);

/**
 * List customer's QB invoices available for linking
 * GET /api/orders/:orderNumber/customer-invoices?page=1&pageSize=10
 */
router.get(
  '/:orderNumber/customer-invoices',
  authenticateToken,
  requirePermission('orders.view'),
  qbInvoiceController.listCustomerInvoices
);

/**
 * Check if invoice needs update (staleness check - local only, fast)
 * GET /api/orders/:orderNumber/qb-invoice/check-updates
 */
router.get(
  '/:orderNumber/qb-invoice/check-updates',
  authenticateToken,
  requirePermission('orders.view'),
  qbInvoiceController.checkInvoiceUpdates
);

/**
 * Deep comparison with QuickBooks (Phase 2 bi-directional sync)
 * GET /api/orders/:orderNumber/qb-invoice/compare
 * Fetches current QB invoice and compares with local data
 */
router.get(
  '/:orderNumber/qb-invoice/compare',
  authenticateToken,
  requirePermission('orders.view'),
  qbInvoiceController.compareInvoice
);

/**
 * Resolve sync conflict (Phase 2 bi-directional sync)
 * POST /api/orders/:orderNumber/qb-invoice/resolve-conflict
 * Body: { resolution: 'use_local' | 'use_qb' | 'keep_both' }
 */
router.post(
  '/:orderNumber/qb-invoice/resolve-conflict',
  authenticateToken,
  requirePermission('orders.update'),
  qbInvoiceController.resolveInvoiceConflict
);

/**
 * Get invoice PDF from QuickBooks
 * GET /api/orders/:orderNumber/qb-invoice/pdf
 */
router.get(
  '/:orderNumber/qb-invoice/pdf',
  authenticateToken,
  requirePermission('orders.view'),
  qbInvoiceController.getInvoicePdf
);

/**
 * Record payment against invoice (Manager+ only)
 * POST /api/orders/:orderNumber/qb-payment
 */
router.post(
  '/:orderNumber/qb-payment',
  authenticateToken,
  requirePermission('orders.update'),
  qbInvoiceController.recordPayment
);

// =============================================
// INVOICE EMAIL OPERATIONS (Phase 2.e)
// =============================================

/**
 * Send invoice email immediately (Manager+ only)
 * POST /api/orders/:orderNumber/invoice-email/send
 */
router.post(
  '/:orderNumber/invoice-email/send',
  authenticateToken,
  requirePermission('orders.update'),
  qbInvoiceController.sendInvoiceEmail
);

/**
 * Schedule invoice email for later (Manager+ only)
 * POST /api/orders/:orderNumber/invoice-email/schedule
 */
router.post(
  '/:orderNumber/invoice-email/schedule',
  authenticateToken,
  requirePermission('orders.update'),
  qbInvoiceController.scheduleInvoiceEmail
);

/**
 * Get scheduled email for order
 * GET /api/orders/:orderNumber/invoice-email/scheduled
 */
router.get(
  '/:orderNumber/invoice-email/scheduled',
  authenticateToken,
  requirePermission('orders.view'),
  qbInvoiceController.getScheduledEmail
);

/**
 * Get email history for order
 * GET /api/orders/:orderNumber/invoice-email/history
 */
router.get(
  '/:orderNumber/invoice-email/history',
  authenticateToken,
  requirePermission('orders.view'),
  qbInvoiceController.getEmailHistory
);

/**
 * Update scheduled email (Manager+ only)
 * PUT /api/orders/:orderNumber/invoice-email/scheduled/:id
 */
router.put(
  '/:orderNumber/invoice-email/scheduled/:id',
  authenticateToken,
  requirePermission('orders.update'),
  qbInvoiceController.updateScheduledEmailHandler
);

/**
 * Cancel scheduled email (Manager+ only)
 * DELETE /api/orders/:orderNumber/invoice-email/scheduled/:id
 */
router.delete(
  '/:orderNumber/invoice-email/scheduled/:id',
  authenticateToken,
  requirePermission('orders.update'),
  qbInvoiceController.cancelScheduledEmailHandler
);

/**
 * Get email preview with variables substituted
 * GET /api/orders/:orderNumber/invoice-email/preview/:templateKey
 */
router.get(
  '/:orderNumber/invoice-email/preview/:templateKey',
  authenticateToken,
  requirePermission('orders.view'),
  qbInvoiceController.getEmailPreview
);

/**
 * Get styled email preview (4-part structure with logo/footer)
 * POST /api/orders/:orderNumber/invoice-email/styled-preview
 */
router.post(
  '/:orderNumber/invoice-email/styled-preview',
  authenticateToken,
  requirePermission('orders.view'),
  qbInvoiceController.getStyledEmailPreview
);

// =============================================
// EMAIL TEMPLATES (Phase 2.e)
// =============================================

/**
 * Get email template by key
 * GET /api/email-templates/:templateKey
 * Note: This route is outside the /orders namespace but mounted here for convenience
 */
router.get(
  '/email-templates/:templateKey',
  authenticateToken,
  requirePermission('orders.view'),
  qbInvoiceController.getEmailTemplateHandler
);

export default router;
