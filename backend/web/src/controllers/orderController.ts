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

/**
 * Helper: Convert orderNumber to orderId
 * Returns orderId or null if not found
 */
async function getOrderIdFromNumber(orderNumber: string): Promise<number | null> {
  const orderNum = parseInt(orderNumber);
  if (isNaN(orderNum)) {
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
      customer_id: customer_id ? parseInt(customer_id as string) : undefined,
      search: search as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    const orders = await orderService.getAllOrders(filters);

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch orders'
    });
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
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = await orderService.getOrderById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch order'
    });
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
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
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
      return res.status(404).json({
        success: false,
        message: errorMessage
      });
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
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
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
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
      return res.status(404).json({
        success: false,
        message: errorMessage
      });
    }

    if (errorMessage.includes('Cannot delete')) {
      return res.status(400).json({
        success: false,
        message: errorMessage
      });
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
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
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
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
      return res.status(404).json({
        success: false,
        message: errorMessage
      });
    }

    if (errorMessage.includes('Invalid status')) {
      return res.status(400).json({
        success: false,
        message: errorMessage
      });
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
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
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
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
      return res.status(404).json({
        success: false,
        message: errorMessage
      });
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
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
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
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
      return res.status(404).json({
        success: false,
        message: errorMessage
      });
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
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
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
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
      return res.status(404).json({
        success: false,
        message: errorMessage
      });
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
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
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
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
      return res.status(404).json({
        success: false,
        message: errorMessage
      });
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
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
    const taskIdNum = parseInt(taskId);

    if (isNaN(taskIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    if (typeof completed !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'completed must be a boolean value'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    await orderService.updateTaskCompletion(taskIdNum, completed, user.user_id);

    res.json({
      success: true,
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('Error updating task completion:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update task'
    });
  }
};

/**
 * Get all tasks grouped by production role
 * GET /api/orders/tasks/by-role
 */
export const getTasksByRole = async (req: Request, res: Response) => {
  try {
    const includeCompleted = req.query.includeCompleted === 'true';
    const hoursBack = req.query.hoursBack ? parseInt(req.query.hoursBack as string) : 24;

    const tasksByRole = await orderService.getTasksByRole(includeCompleted, hoursBack);

    res.json({
      success: true,
      data: tasksByRole
    });
  } catch (error) {
    console.error('Error fetching tasks by role:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch tasks by role'
    });
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
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required'
      });
    }

    await orderService.batchUpdateTasks(updates, user.user_id);

    res.json({
      success: true,
      message: `Successfully updated ${updates.length} tasks`
    });
  } catch (error) {
    console.error('Error batch updating tasks:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to batch update tasks'
    });
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
      return res.status(400).json({
        success: false,
        message: 'orderName and customerId are required'
      });
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
    res.status(500).json({
      success: false,
      message: 'Failed to validate order name'
    });
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
    res.status(500).json({
      success: false,
      message: 'Failed to get order'
    });
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
      return res.status(400).json({
        success: false,
        message: 'startDate and turnaroundDays are required'
      });
    }

    const start = new Date(startDate);
    const days = parseInt(turnaroundDays);

    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid startDate format. Use YYYY-MM-DD'
      });
    }

    if (isNaN(days) || days <= 0) {
      return res.status(400).json({
        success: false,
        message: 'turnaroundDays must be a positive number'
      });
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
    res.status(500).json({
      success: false,
      message: 'Failed to calculate due date'
    });
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
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
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
    res.status(500).json({
      success: false,
      message: 'Failed to calculate business days'
    });
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
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const { parts } = req.body;

    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Parts array is required'
      });
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
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update order parts'
    });
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
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const { task_name, assigned_role } = req.body;

    if (!task_name) {
      return res.status(400).json({
        success: false,
        message: 'task_name is required'
      });
    }

    const taskId = await orderRepository.createOrderTask({
      order_id: orderId,
      part_id: parseInt(partId),
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
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add task'
    });
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

    await orderRepository.deleteTask(parseInt(taskId));

    res.json({
      success: true,
      message: 'Task removed successfully'
    });
  } catch (error) {
    console.error('Error removing task:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to remove task'
    });
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
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task templates'
    });
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
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const orderId = await getOrderIdFromNumber(orderNumber);
    if (!orderId) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Create snapshots and finalize
    await orderService.finalizeOrder(orderId, userId);

    res.json({
      success: true,
      message: 'Order finalized successfully'
    });
  } catch (error) {
    console.error('Error finalizing order:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to finalize order'
    });
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

    const snapshot = await orderService.getLatestSnapshot(parseInt(partId));

    res.json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    console.error('Error fetching latest snapshot:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch snapshot'
    });
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

    const snapshots = await orderService.getSnapshotHistory(parseInt(partId));

    res.json({
      success: true,
      data: snapshots
    });
  } catch (error) {
    console.error('Error fetching snapshot history:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch snapshot history'
    });
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

    const comparison = await orderService.compareWithLatestSnapshot(parseInt(partId));

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error comparing with snapshot:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to compare with snapshot'
    });
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
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const partIdNum = parseInt(partId);
    if (isNaN(partIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid part ID'
      });
    }

    console.log('[updateSpecsDisplayName] Updating part', partIdNum, 'with specs_display_name:', specs_display_name);

    // Get the part to check if it's parent or regular row
    const part = await orderRepository.getOrderPartById(partIdNum);
    if (!part) {
      return res.status(404).json({
        success: false,
        message: 'Part not found'
      });
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
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update specs display name'
    });
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
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const partIdNum = parseInt(partId);
    if (isNaN(partIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid part ID'
      });
    }

    // Get the current part
    const part = await orderRepository.getOrderPartById(partIdNum);
    if (!part) {
      return res.status(404).json({
        success: false,
        message: 'Part not found'
      });
    }

    // Toggle is_parent
    const newIsParent = !part.is_parent;
    console.log(`[toggleIsParent] Toggling part ${partIdNum} from is_parent=${part.is_parent} to ${newIsParent}`);

    // Validation: Cannot set as parent if no specs_display_name
    if (newIsParent && !part.specs_display_name) {
      return res.status(400).json({
        success: false,
        message: 'Cannot promote to Base Item: Please select an Item Name first.'
      });
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
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to toggle is_parent'
    });
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

    const partIdNum = parseInt(partId);

    if (isNaN(partIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid part ID'
      });
    }

    if (specs_qty === undefined || specs_qty === null) {
      return res.status(400).json({
        success: false,
        message: 'specs_qty is required'
      });
    }

    const qtyNum = Number(specs_qty);
    if (isNaN(qtyNum) || qtyNum < 0) {
      return res.status(400).json({
        success: false,
        message: 'specs_qty must be a non-negative number'
      });
    }

    // Fetch existing part
    const part = await orderRepository.getOrderPartById(partIdNum);

    if (!part) {
      return res.status(404).json({
        success: false,
        message: 'Part not found'
      });
    }

    // Parse existing specifications
    let specifications: any = {};
    try {
      specifications = typeof part.specifications === 'string'
        ? JSON.parse(part.specifications)
        : part.specifications || {};
    } catch (error) {
      console.error('Error parsing specifications:', error);
      specifications = {};
    }

    // Update specs_qty in specifications
    specifications.specs_qty = qtyNum;

    // Update the order part with new specifications
    await orderRepository.updateOrderPart(partIdNum, {
      specifications
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
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update specs_qty'
    });
  }
};
