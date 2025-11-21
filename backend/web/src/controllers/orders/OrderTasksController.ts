/**
 * Order Tasks Controller
 * HTTP Request Handlers for Order Task Operations
 *
 * Extracted from orderController.ts - 2025-11-21
 * Functions: getOrderTasks, getTasksByPart, updateTaskCompletion,
 *            getTasksByRole, batchUpdateTasks, addTaskToOrderPart,
 *            removeTask, getTaskTemplates
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../../types';
import { orderTaskService } from '../../services/orderTaskService';
import { parseIntParam, sendErrorResponse } from '../../utils/controllerHelpers';
import { getOrderIdFromNumber } from './OrderCrudController';

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

    const tasks = await orderTaskService.getOrderTasks(orderId);

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

    const tasksByPart = await orderTaskService.getTasksByPart(orderId);

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

    await orderTaskService.updateTaskCompletion(taskIdNum, completed, user.user_id);

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

    const tasksByRole = await orderTaskService.getTasksByRole(includeCompleted, hoursBack);

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

    await orderTaskService.batchUpdateTasks(updates, user.user_id);

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

    const taskId = await orderTaskService.addTaskToOrderPart(
      orderId,
      partIdNum,
      task_name,
      assigned_role
    );

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
    const taskIdNum = parseIntParam(taskId, 'task ID');

    if (taskIdNum === null) {
      return sendErrorResponse(res, 'Invalid task ID', 'VALIDATION_ERROR');
    }

    await orderTaskService.removeTask(taskIdNum);

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
    const tasks = await orderTaskService.getTaskTemplates();

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Error fetching task templates:', error);
    return sendErrorResponse(res, 'Failed to fetch task templates', 'INTERNAL_ERROR');
  }
};
