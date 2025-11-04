/**
 * Order Controller
 * HTTP Request Handlers for Order CRUD Operations
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { orderService } from '../services/orderService';
import { orderRepository } from '../repositories/orderRepository';
import { OrderFilters, UpdateOrderData } from '../types/orders';

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
