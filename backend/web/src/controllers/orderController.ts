// FINISHED: Migrated to ServiceResult<T> system - Completed 2025-11-15
// Changes:
// - Added imports: parseIntParam, sendErrorResponse from controllerHelpers
// - Replaced 12 instances of parseInt() with parseIntParam()
// - Replaced 75+ instances of manual res.status().json() with sendErrorResponse()
// - Updated helper function getOrderIdFromNumber() to use parseIntParam()
// - All validation errors now use 'VALIDATION_ERROR' code
// - All 404 errors now use 'NOT_FOUND' code
// - All 401 errors now use 'UNAUTHORIZED' code
// - All internal errors now use 'INTERNAL_ERROR' code
// - Fixed type compatibility issues (number | null → number with null coalescing)
// - Automated migration via Python script for consistency

// File Clean up Finished: Nov 14, 2025
// Analysis: This file is already fairly clean
// - Only 2 auth checks (and they're used, not redundant)
// - Consistent error handling pattern throughout
// - Well-structured with helper functions
// - No significant cleanup opportunities identified
// Note: Could optionally change Request → AuthRequest and use req.user! in future refactor
/**
 * Order Controller
 * HTTP Request Handlers for Order CRUD Operations
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { orderService } from '../services/orderService';
import { orderRepository } from '../repositories/orderRepository';
import { OrderFilters, UpdateOrderData } from '../types/orders';
import { BusinessDaysCalculator } from '../utils/businessDaysCalculator';  // Phase 1.5.a.5
import { TimeAnalyticsRepository } from '../repositories/timeManagement/TimeAnalyticsRepository';  // Phase 1.5.a.5
import { mapSpecsDisplayNameToTypes } from '../utils/specsTypeMapper';  // Specs mapping utility
import { parseIntParam, sendErrorResponse } from '../utils/controllerHelpers';

/**
 * Helper: Convert orderNumber to orderId
 * Returns orderId or null if not found
 */
async function getOrderIdFromNumber(orderNumber: string): Promise<number | null> {
  const orderNum = parseIntParam(orderNumber, 'order number');
  if (orderNum === null) {
    return null;
  }
  return await orderRepository.getOrderIdFromOrderNumber(orderNum);
}

/**
 * Get all orders with optional filters
 * GET /api/orders
 * Permission: orders.view (All roles)
 */
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { status, customer_id, search, limit = '50', offset = '0' } = req.query;

    const filters: OrderFilters = {
      status: status as string,
      customer_id: customer_id ? parseIntParam(customer_id as string, 'customer ID') ?? undefined : undefined,
      search: search as string,
      limit: parseIntParam(limit as string, 'limit') ?? 50,
      offset: parseIntParam(offset as string, 'offset') ?? 0
    };

    const orders = await orderService.getAllOrders(filters);

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch orders', 'INTERNAL_ERROR');
  }
};

/**
 * Get single order with details
 * GET /api/orders/:orderNumber
 * Permission: orders.view (All roles)
 */
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const order = await orderService.getOrderById(orderId);

    if (!order) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch order', 'INTERNAL_ERROR');
  }
};

/**
 * Get customer tax from billing address
 * GET /api/orders/:orderNumber/customer-tax
 * Permission: orders.view (All roles)
 * Returns the tax_name for the order's customer based on billing address
 */
export const getCustomerTax = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderNum = parseIntParam(orderNumber, 'order number');

    if (orderNum === null) {
      return sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    }

    const taxName = await orderService.getCustomerTaxFromBillingAddress(orderNum);

    res.json({
      success: true,
      data: { tax_name: taxName }
    });
  } catch (error) {
    console.error('Error fetching customer tax:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch customer tax', 'INTERNAL_ERROR');
  }
};

/**
 * Update order
 * PUT /api/orders/:orderId
 * Permission: orders.update (Manager+ only)
 */
export const updateOrder = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const updateData: UpdateOrderData = req.body;

    await orderService.updateOrder(orderId, updateData);

    res.json({
      success: true,
      message: 'Order updated successfully'
    });
  } catch (error) {
    console.error('Error updating order:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to update order';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Delete order (pre-confirmation only)
 * DELETE /api/orders/:orderId
 * Permission: orders.delete (Manager+ only)
 */
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    await orderService.deleteOrder(orderId);

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting order:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete order';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    if (errorMessage.includes('Cannot delete')) {
      return sendErrorResponse(res, errorMessage, 'VALIDATION_ERROR');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Update order status
 * PUT /api/orders/:orderId/status
 * Permission: orders.update (Manager+ only)
 */
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const { status, notes } = req.body;

    if (!status) {
      return sendErrorResponse(res, 'Status is required', 'VALIDATION_ERROR');
    }

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    await orderService.updateOrderStatus(
      orderId,
      status,
      user.user_id,
      notes
    );

    res.json({
      success: true,
      message: 'Order status updated successfully'
    });
  } catch (error) {
    console.error('Error updating order status:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to update order status';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    if (errorMessage.includes('Invalid status')) {
      return sendErrorResponse(res, errorMessage, 'VALIDATION_ERROR');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Get status history for order
 * GET /api/orders/:orderId/status-history
 * Permission: orders.view (All roles)
 */
export const getStatusHistory = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const history = await orderService.getStatusHistory(orderId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching status history:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch status history';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Get order progress
 * GET /api/orders/:orderId/progress
 * Permission: orders.view (All roles)
 */
export const getOrderProgress = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const progress = await orderService.getOrderProgress(orderId);

    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('Error fetching order progress:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch order progress';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Get all tasks for order (flat list)
 * GET /api/orders/:orderId/tasks
 * Permission: orders.view (All roles)
 */
export const getOrderTasks = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const tasks = await orderService.getOrderTasks(orderId);

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Error fetching order tasks:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tasks';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Get tasks grouped by part with details
 * GET /api/orders/:orderId/tasks/by-part
 * Permission: orders.view (All roles)
 */
export const getTasksByPart = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const tasksByPart = await orderService.getTasksByPart(orderId);

    res.json({
      success: true,
      data: tasksByPart
    });
  } catch (error) {
    console.error('Error fetching tasks by part:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tasks by part';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Update task completion status
 * PUT /api/orders/:orderId/tasks/:taskId
 * Permission: orders.update (Manager+ only)
 */
export const updateTaskCompletion = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { taskId } = req.params;
    const { completed } = req.body;
    const taskIdNum = parseIntParam(taskId, 'task ID');

    if (taskIdNum === null) {
      return sendErrorResponse(res, 'Invalid task ID', 'VALIDATION_ERROR');
    }

    if (typeof completed !== 'boolean') {
      return sendErrorResponse(res, 'completed must be a boolean value', 'VALIDATION_ERROR');
    }

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    await orderService.updateTaskCompletion(taskIdNum, completed, user.user_id);

    res.json({
      success: true,
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('Error updating task completion:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to update task', 'INTERNAL_ERROR');
  }
};

/**
 * Get all tasks grouped by production role
 * GET /api/orders/tasks/by-role
 */
export const getTasksByRole = async (req: Request, res: Response) => {
  try {
    const includeCompleted = req.query.includeCompleted === 'true';
    const hoursBack = req.query.hoursBack ? parseIntParam(req.query.hoursBack as string, 'hoursBack') ?? 24 : 24;

    const tasksByRole = await orderService.getTasksByRole(includeCompleted, hoursBack);

    res.json({
      success: true,
      data: tasksByRole
    });
  } catch (error) {
    console.error('Error fetching tasks by role:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch tasks by role', 'INTERNAL_ERROR');
  }
};

/**
 * Batch update tasks (start/complete)
 * PUT /api/orders/tasks/batch-update
 */
export const batchUpdateTasks = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return sendErrorResponse(res, 'Updates array is required', 'VALIDATION_ERROR');
    }

    await orderService.batchUpdateTasks(updates, user.user_id);

    res.json({
      success: true,
      message: `Successfully updated ${updates.length} tasks`
    });
  } catch (error) {
    console.error('Error batch updating tasks:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to batch update tasks', 'INTERNAL_ERROR');
  }
};

/**
 * Validate order name uniqueness for a customer (Phase 1.5.a)
 * GET /api/orders/validate-name?orderName=xxx&customerId=123
 */
export const validateOrderName = async (req: Request, res: Response) => {
  try {
    const { orderName, customerId } = req.query;

    if (!orderName || !customerId) {
      return sendErrorResponse(res, 'orderName and customerId are required', 'VALIDATION_ERROR');
    }

    const isUnique = await orderRepository.isOrderNameUniqueForCustomer(
      String(orderName),
      Number(customerId)
    );

    res.json({
      success: true,
      unique: isUnique
    });
  } catch (error) {
    console.error('Error validating order name:', error);
    return sendErrorResponse(res, 'Failed to validate order name', 'INTERNAL_ERROR');
  }
};

/**
 * Get order for estimate (Phase 1.5.a)
 * GET /api/orders/by-estimate/:estimateId
 */
export const getOrderByEstimate = async (req: Request, res: Response) => {
  try {
    const { estimateId } = req.params;

    const order = await orderRepository.getOrderByEstimateId(Number(estimateId));

    res.json({
      success: true,
      order: order || null
    });
  } catch (error) {
    console.error('Error getting order by estimate:', error);
    return sendErrorResponse(res, 'Failed to get order', 'INTERNAL_ERROR');
  }
};

/**
 * Calculate due date based on business days (Phase 1.5.a.5)
 * POST /api/orders/calculate-due-date
 * Body: { startDate: string (YYYY-MM-DD), turnaroundDays: number }
 * Permission: orders.create
 */
export const calculateDueDate = async (req: Request, res: Response) => {
  try {
    const { startDate, turnaroundDays } = req.body;

    // Validation
    if (!startDate || !turnaroundDays) {
      return sendErrorResponse(res, 'startDate and turnaroundDays are required', 'VALIDATION_ERROR');
    }

    const start = new Date(startDate);
    const days = parseIntParam(turnaroundDays, 'turnaroundDays');

    if (isNaN(start.getTime())) {
      return sendErrorResponse(res, 'Invalid startDate format. Use YYYY-MM-DD', 'VALIDATION_ERROR');
    }

    if (days === null || days <= 0) {
      return sendErrorResponse(res, 'turnaroundDays must be a positive number', 'VALIDATION_ERROR');
    }

    // Calculate due date
    const dueDate = await BusinessDaysCalculator.calculateDueDate(start, days);

    res.json({
      success: true,
      dueDate: dueDate.toISOString().split('T')[0], // YYYY-MM-DD format
      businessDaysCalculated: days
    });
  } catch (error) {
    console.error('Error calculating due date:', error);
    return sendErrorResponse(res, 'Failed to calculate due date', 'INTERNAL_ERROR');
  }
};

/**
 * Calculate business days between two dates (Phase 1.5.a.5)
 * POST /api/orders/calculate-business-days
 * Body: { startDate: string (YYYY-MM-DD), endDate: string (YYYY-MM-DD) }
 * Permission: orders.create
 */
export const calculateBusinessDays = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;

    // Validation
    if (!startDate || !endDate) {
      return sendErrorResponse(res, 'startDate and endDate are required', 'VALIDATION_ERROR');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return sendErrorResponse(res, 'Invalid date format. Use YYYY-MM-DD', 'VALIDATION_ERROR');
    }

    // If end is before start, return 0
    if (end < start) {
      return res.json({
        success: true,
        businessDays: 0
      });
    }

    // Calculate business days between dates
    const businessDays = await BusinessDaysCalculator.calculateBusinessDaysBetween(start, end);

    res.json({
      success: true,
      businessDays
    });
  } catch (error) {
    console.error('Error calculating business days:', error);
    return sendErrorResponse(res, 'Failed to calculate business days', 'INTERNAL_ERROR');
  }
};

/**
 * Update order parts in bulk (Phase 1.5.c)
 * PUT /api/orders/:orderNumber/parts
 * Permission: orders.update (Manager+ only)
 */
export const updateOrderParts = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const { parts } = req.body;

    if (!Array.isArray(parts) || parts.length === 0) {
      return sendErrorResponse(res, 'Parts array is required', 'VALIDATION_ERROR');
    }

    // Update each part
    for (const part of parts) {
      if (!part.part_id) {
        continue;
      }

      await orderRepository.updateOrderPart(part.part_id, {
        product_type: part.product_type,
        part_scope: part.part_scope,
        qb_item_name: part.qb_item_name,
        qb_description: part.qb_description,
        specifications: part.specifications,
        invoice_description: part.invoice_description,
        quantity: part.quantity,
        unit_price: part.unit_price,
        extended_price: part.extended_price,
        production_notes: part.production_notes
      });
    }

    res.json({
      success: true,
      message: 'Order parts updated successfully'
    });
  } catch (error) {
    console.error('Error updating order parts:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to update order parts', 'INTERNAL_ERROR');
  }
};

/**
 * Add task to order part (Phase 1.5.c)
 * POST /api/orders/:orderNumber/parts/:partId/tasks
 * Permission: orders.update (Manager+ only)
 */
export const addTaskToOrderPart = async (req: Request, res: Response) => {
  try {
    const { orderNumber, partId } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const { task_name, assigned_role } = req.body;

    if (!task_name) {
      return sendErrorResponse(res, 'task_name is required', 'VALIDATION_ERROR');
    }

    const partIdNum = parseIntParam(partId, 'part ID');
    if (partIdNum === null) {
      return sendErrorResponse(res, 'Invalid part ID', 'VALIDATION_ERROR');
    }

    const taskId = await orderRepository.createOrderTask({
      order_id: orderId,
      part_id: partIdNum,
      task_name,
      assigned_role: assigned_role || null
    });

    res.json({
      success: true,
      task_id: taskId,
      message: 'Task added successfully'
    });
  } catch (error) {
    console.error('Error adding task:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to add task', 'INTERNAL_ERROR');
  }
};

/**
 * Remove task from order (Phase 1.5.c)
 * DELETE /api/orders/tasks/:taskId
 * Permission: orders.update (Manager+ only)
 */
export const removeTask = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    await orderRepository.deleteTask(parseIntParam(taskId, 'task ID')!);

    res.json({
      success: true,
      message: 'Task removed successfully'
    });
  } catch (error) {
    console.error('Error removing task:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to remove task', 'INTERNAL_ERROR');
  }
};

/**
 * Get available task templates (Phase 1.5.c)
 * GET /api/orders/task-templates
 * Permission: orders.view (All roles)
 */
export const getTaskTemplates = async (req: Request, res: Response) => {
  try {
    const tasks = await orderRepository.getAvailableTasks();

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Error fetching task templates:', error);
    return sendErrorResponse(res, 'Failed to fetch task templates', 'INTERNAL_ERROR');
  }
};

/**
 * Finalize order - create snapshots for all parts (Phase 1.5.c.3)
 * POST /api/orders/:orderNumber/finalize
 * Permission: orders.update (Manager+ only)
 */
export const finalizeOrder = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const userId = (req as any).user?.user_id;

    if (!userId) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Create snapshots and finalize
    await orderService.finalizeOrder(orderId, userId);

    res.json({
      success: true,
      message: 'Order finalized successfully'
    });
  } catch (error) {
    console.error('Error finalizing order:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to finalize order', 'INTERNAL_ERROR');
  }
};

/**
 * Get latest snapshot for a part (Phase 1.5.c.3)
 * GET /api/orders/parts/:partId/snapshot/latest
 * Permission: orders.view
 */
export const getPartLatestSnapshot = async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;

    const snapshot = await orderService.getLatestSnapshot(parseIntParam(partId, 'part ID')!);

    res.json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    console.error('Error fetching latest snapshot:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch snapshot', 'INTERNAL_ERROR');
  }
};

/**
 * Get snapshot history for a part (Phase 1.5.c.3)
 * GET /api/orders/parts/:partId/snapshots
 * Permission: orders.view
 */
export const getPartSnapshotHistory = async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;

    const snapshots = await orderService.getSnapshotHistory(parseIntParam(partId, 'part ID')!);

    res.json({
      success: true,
      data: snapshots
    });
  } catch (error) {
    console.error('Error fetching snapshot history:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch snapshot history', 'INTERNAL_ERROR');
  }
};

/**
 * Compare part with latest snapshot (Phase 1.5.c.3)
 * GET /api/orders/parts/:partId/compare
 * Permission: orders.view
 */
export const comparePartWithSnapshot = async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;

    const comparison = await orderService.compareWithLatestSnapshot(parseIntParam(partId, 'part ID')!);

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error comparing with snapshot:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to compare with snapshot', 'INTERNAL_ERROR');
  }
};

/**
 * Update specs_display_name and regenerate specifications
 * PUT /api/orders/:orderNumber/parts/:partId/specs-display-name
 * Permission: orders.update (Manager+ only)
 *
 * This endpoint:
 * 1. Updates the specs_display_name field
 * 2. Calls the mapper to get spec types
 * 3. Regenerates the SPECIFICATIONS column (clears existing templates)
 */
export const updateSpecsDisplayName = async (req: Request, res: Response) => {
  try {
    const { orderNumber, partId } = req.params;
    const { specs_display_name } = req.body;

    // Validate inputs
    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const partIdNum = parseIntParam(partId, 'part ID');
    if (partIdNum === null) {
      return sendErrorResponse(res, 'Invalid part ID', 'VALIDATION_ERROR');
    }

    console.log('[updateSpecsDisplayName] Updating part', partIdNum, 'with specs_display_name:', specs_display_name);

    // Get the part to check if it's parent or regular row
    const part = await orderRepository.getOrderPartById(partIdNum);
    if (!part) {
      return sendErrorResponse(res, 'Part not found', 'NOT_FOUND');
    }

    // Determine if this is a parent or regular row
    const displayNumber = part.display_number || '';
    const isSubItem = /[a-zA-Z]/.test(displayNumber);
    const isParentOrRegular = part.is_parent || !isSubItem;
    console.log('[updateSpecsDisplayName] Display number:', displayNumber, 'isParent:', part.is_parent, 'isParentOrRegular:', isParentOrRegular);

    // Call mapper to get spec types
    const specTypes = mapSpecsDisplayNameToTypes(specs_display_name, isParentOrRegular);
    console.log('[updateSpecsDisplayName] Mapped to spec types:', specTypes);

    // Build new specifications object
    // Clear all existing template fields and create new ones based on mapper
    const newSpecifications: any = {};

    // Populate template fields based on mapped spec types
    specTypes.forEach((specType, index) => {
      const rowNum = index + 1;
      newSpecifications[`_template_${rowNum}`] = specType.name;
      // spec1, spec2, spec3 values are empty for now (manual entry)
    });

    console.log('[updateSpecsDisplayName] New specifications:', newSpecifications);

    // Prepare update data
    const updateData: any = {
      specs_display_name,
      specifications: newSpecifications
    };

    // Auto-demote to sub-item if specs_display_name is being cleared
    if (!specs_display_name && part.is_parent) {
      console.log('[updateSpecsDisplayName] Auto-demoting part from is_parent=true to is_parent=false (specs_display_name cleared)');
      updateData.is_parent = false;
    }

    // Update the order part
    await orderRepository.updateOrderPart(partIdNum, updateData);

    // Fetch updated part to return
    const updatedPart = await orderRepository.getOrderPartById(partIdNum);

    res.json({
      success: true,
      data: updatedPart
    });
  } catch (error) {
    console.error('Error updating specs display name:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to update specs display name', 'INTERNAL_ERROR');
  }
};

/**
 * Toggle is_parent status for an order part
 * PATCH /api/orders/:orderNumber/parts/:partId/toggle-parent
 */
export const toggleIsParent = async (req: Request, res: Response) => {
  try {
    const { orderNumber, partId } = req.params;

    // Validate inputs
    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const partIdNum = parseIntParam(partId, 'part ID');
    if (partIdNum === null) {
      return sendErrorResponse(res, 'Invalid part ID', 'VALIDATION_ERROR');
    }

    // Get the current part
    const part = await orderRepository.getOrderPartById(partIdNum);
    if (!part) {
      return sendErrorResponse(res, 'Part not found', 'NOT_FOUND');
    }

    // Toggle is_parent
    const newIsParent = !part.is_parent;
    console.log(`[toggleIsParent] Toggling part ${partIdNum} from is_parent=${part.is_parent} to ${newIsParent}`);

    // Validation: Cannot set as parent if no specs_display_name
    if (newIsParent && !part.specs_display_name) {
      return sendErrorResponse(res, 'Cannot promote to Base Item: Please select an Item Name first.', 'VALIDATION_ERROR');
    }

    // Update the order part
    await orderRepository.updateOrderPart(partIdNum, {
      is_parent: newIsParent
    });

    // Fetch updated part to return
    const updatedPart = await orderRepository.getOrderPartById(partIdNum);

    res.json({
      success: true,
      data: updatedPart
    });
  } catch (error) {
    console.error('Error toggling is_parent:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to toggle is_parent', 'INTERNAL_ERROR');
  }
};

/**
 * Update specs_qty for an order part
 * PATCH /api/orders/:orderNumber/parts/:partId/specs-qty
 * Permission: orders.update (Manager+ only)
 */
export const updatePartSpecsQty = async (req: Request, res: Response) => {
  try {
    const { partId } = req.params;
    const { specs_qty } = req.body;

    const partIdNum = parseIntParam(partId, 'part ID');

    if (partIdNum === null) {
      return sendErrorResponse(res, 'Invalid part ID', 'VALIDATION_ERROR');
    }

    if (specs_qty === undefined || specs_qty === null) {
      return sendErrorResponse(res, 'specs_qty is required', 'VALIDATION_ERROR');
    }

    const qtyNum = Number(specs_qty);
    if (isNaN(qtyNum) || qtyNum < 0) {
      return sendErrorResponse(res, 'specs_qty must be a non-negative number', 'VALIDATION_ERROR');
    }

    // Fetch existing part
    const part = await orderRepository.getOrderPartById(partIdNum);

    if (!part) {
      return sendErrorResponse(res, 'Part not found', 'NOT_FOUND');
    }

    // Update specs_qty column directly (no longer stored in JSON)
    await orderRepository.updateOrderPart(partIdNum, {
      specs_qty: qtyNum
    });

    console.log(`[updatePartSpecsQty] Updated part ${partIdNum} specs_qty to ${qtyNum}`);

    // Fetch updated part to return
    const updatedPart = await orderRepository.getOrderPartById(partIdNum);

    res.json({
      success: true,
      data: updatedPart
    });
  } catch (error) {
    console.error('Error updating specs_qty:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to update specs_qty', 'INTERNAL_ERROR');
  }
};

/**
 * Helper function to recalculate display_number for all parts in an order
 * Also recalculates is_parent based on position (first part is always parent)
 */
async function recalculatePartDisplayNumbers(orderId: number): Promise<void> {
  // Get all parts for this order, ordered by part_number
  const parts = await orderRepository.getOrderParts(orderId);

  if (parts.length === 0) return;

  // Sort by part_number to ensure correct ordering
  parts.sort((a, b) => a.part_number - b.part_number);

  // First part is always a parent
  let currentParentNumber = 1;
  let currentChildLetter = 'a';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    let newIsParent = part.is_parent;
    let newDisplayNumber = '';

    // First part is always a parent
    if (i === 0) {
      newIsParent = true;
      newDisplayNumber = String(currentParentNumber);
      currentParentNumber++;
      currentChildLetter = 'a';
    } else if (part.is_parent) {
      // This part is marked as a parent
      newDisplayNumber = String(currentParentNumber);
      currentParentNumber++;
      currentChildLetter = 'a';
    } else {
      // This part is a child - assign parent number + letter
      newDisplayNumber = `${currentParentNumber - 1}${currentChildLetter}`;
      // Increment letter for next child
      currentChildLetter = String.fromCharCode(currentChildLetter.charCodeAt(0) + 1);
    }

    // Update part if display_number or is_parent changed
    if (part.display_number !== newDisplayNumber || part.is_parent !== newIsParent) {
      await orderRepository.updateOrderPart(part.part_id, {
        display_number: newDisplayNumber,
        is_parent: newIsParent
      });
    }
  }
}

/**
 * Reorder parts in bulk (for drag-and-drop)
 * PATCH /api/orders/:orderNumber/parts/reorder
 * Body: { partIds: number[] } - ordered array of part IDs
 * Permission: orders.update (Manager+ only)
 */
export const reorderParts = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { partIds } = req.body;

    // Validate inputs
    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    if (!Array.isArray(partIds) || partIds.length === 0) {
      return sendErrorResponse(res, 'Invalid partIds array', 'VALIDATION_ERROR');
    }

    // Get all parts for this order
    const allParts = await orderRepository.getOrderParts(orderId);

    // Validate that all partIds belong to this order
    const validPartIds = new Set(allParts.map(p => p.part_id));
    const invalidParts = partIds.filter(id => !validPartIds.has(id));

    if (invalidParts.length > 0) {
      return sendErrorResponse(res, `Invalid part IDs: ${invalidParts.join(', ')}`, 'VALIDATION_ERROR');
    }

    // Validate that all parts are included (no missing parts)
    if (partIds.length !== allParts.length) {
      return sendErrorResponse(res, 'All parts must be included in the reorder', 'VALIDATION_ERROR');
    }

    // Update part_number for each part based on new order
    // part_number is 1-indexed
    for (let i = 0; i < partIds.length; i++) {
      const partId = partIds[i];
      const newPartNumber = i + 1;

      await orderRepository.updateOrderPart(partId, {
        part_number: newPartNumber
      });
    }

    // Recalculate display numbers and is_parent for all parts
    await recalculatePartDisplayNumbers(orderId);

    res.json({
      success: true,
      message: 'Parts reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering parts:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to reorder parts', 'INTERNAL_ERROR');
  }
};

/**
 * Add a new part row to the order
 * POST /api/orders/:orderNumber/parts
 * Permission: orders.update (Manager+ only)
 */
export const addPartRow = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    // Validate inputs
    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    // Get all existing parts to determine next part_number
    const allParts = await orderRepository.getOrderParts(orderId);
    const maxPartNumber = allParts.length > 0
      ? Math.max(...allParts.map(p => p.part_number))
      : 0;
    const newPartNumber = maxPartNumber + 1;

    // Create new part with default values
    const partId = await orderRepository.createOrderPart({
      order_id: orderId,
      part_number: newPartNumber,
      product_type: 'New Part',
      product_type_id: 'custom',
      is_parent: false,
      quantity: null,
      specifications: {}
    });

    // Recalculate display numbers for all parts
    await recalculatePartDisplayNumbers(orderId);

    res.json({
      success: true,
      part_id: partId,
      message: 'Part row added successfully'
    });
  } catch (error) {
    console.error('Error adding part row:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to add part row', 'INTERNAL_ERROR');
  }
};

/**
 * Remove a part row from the order
 * DELETE /api/orders/:orderNumber/parts/:partId
 * Permission: orders.update (Manager+ only)
 */
export const removePartRow = async (req: Request, res: Response) => {
  try {
    const { orderNumber, partId } = req.params;

    // Validate inputs
    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const partIdNum = parseIntParam(partId, 'part ID');
    if (partIdNum === null) {
      return sendErrorResponse(res, 'Invalid part ID', 'VALIDATION_ERROR');
    }

    // Get the part to verify it exists and belongs to this order
    const part = await orderRepository.getOrderPartById(partIdNum);
    if (!part) {
      return sendErrorResponse(res, 'Part not found', 'NOT_FOUND');
    }
    if (part.order_id !== orderId) {
      return sendErrorResponse(res, 'Part does not belong to this order', 'VALIDATION_ERROR');
    }

    // Delete the part (cascade will handle related tasks)
    await orderRepository.deleteOrderPart(partIdNum);

    // Get remaining parts and renumber them sequentially
    const remainingParts = await orderRepository.getOrderParts(orderId);
    remainingParts.sort((a, b) => a.part_number - b.part_number);

    // Renumber parts sequentially
    for (let i = 0; i < remainingParts.length; i++) {
      const expectedPartNumber = i + 1;
      if (remainingParts[i].part_number !== expectedPartNumber) {
        await orderRepository.updateOrderPart(remainingParts[i].part_id, {
          part_number: expectedPartNumber
        });
      }
    }

    // Recalculate display numbers for all remaining parts
    await recalculatePartDisplayNumbers(orderId);

    res.json({
      success: true,
      message: 'Part row removed successfully'
    });
  } catch (error) {
    console.error('Error removing part row:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to remove part row', 'INTERNAL_ERROR');
  }
};
