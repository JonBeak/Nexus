// File Clean up Finished: 2025-11-24
// Changes:
//   - Removed old product-type based task templates (TASK_TEMPLATES)
//   - Removed deprecated generateTasksForOrder, getTaskTemplate, getAvailableTemplates, getTemplateForProductType
//   - Task generation now handled by /services/taskGeneration/ (spec-driven)
//   - This service now only handles Task CRUD operations

/**
 * Order Task Service
 * Business Logic for Task CRUD Operations
 *
 * Handles:
 * - Task CRUD operations (create, read, update, delete)
 * - Tasks by role/part grouping
 * - Batch task updates
 *
 * Note: Task GENERATION is now handled by /services/taskGeneration/
 */

import { orderPartRepository } from '../repositories/orderPartRepository';
import { orderRepository } from '../repositories/orderRepository';
import { OrderTask, ProductionRole } from '../types/orders';
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { orderService } from './orderService';
import {
  broadcastTaskUpdate,
  broadcastTaskNotes,
  broadcastTaskDeleted,
  broadcastTaskCreated
} from '../websocket';

// QC task constants (must match orderService.ts)
const QC_TASK_NAME = 'QC & Packing';
const QC_TASK_ROLE = 'qc_packer';

/**
 * Interface for batch task update operations
 */
export interface TaskUpdate {
  task_id: number;
  started?: boolean;
  completed?: boolean;
  expected_version?: number;  // For optimistic locking
}

/**
 * Result of a batch task update operation
 */
export interface BatchUpdateResult {
  statusChanges: Map<number, string>;
  conflicts: Array<{
    task_id: number;
    expected_version: number;
    current_version: number;
  }>;
  updatedTasks: Array<{
    task_id: number;
    new_version: number;
  }>;
}

export class OrderTaskService {

  // =====================================================
  // TASK CRUD OPERATIONS
  // =====================================================

  /**
   * Check if a task is the QC task (job-level task for QC & Packing)
   * Returns task info if it is a QC task, null otherwise
   */
  private async getQcTaskInfo(taskId: number): Promise<{
    order_id: number;
    isQcTask: boolean;
  } | null> {
    const rows = await query(
      `SELECT order_id, part_id, task_name, assigned_role
       FROM order_tasks WHERE task_id = ?`,
      [taskId]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    const task = rows[0];
    const isQcTask = task.part_id === null &&
                     task.task_name === QC_TASK_NAME &&
                     task.assigned_role === QC_TASK_ROLE;

    return {
      order_id: task.order_id,
      isQcTask
    };
  }

  /**
   * Handle QC task completion - auto-transition to shipping or pick_up
   */
  private async handleQcTaskCompletion(orderId: number, userId: number): Promise<string | null> {
    const order = await orderRepository.getOrderById(orderId);

    if (!order || order.status !== 'qc_packing') {
      return null;
    }

    // Determine next status based on shipping_required
    const nextStatus = order.shipping_required ? 'shipping' : 'pick_up';

    await orderService.updateOrderStatus(
      orderId,
      nextStatus,
      userId,
      `Automatically moved to ${nextStatus === 'shipping' ? 'Shipping' : 'Pick Up'} (QC task completed)`
    );

    return nextStatus;
  }

  /**
   * Check if all tasks for an order are completed
   */
  private async areAllTasksCompleted(orderId: number): Promise<boolean> {
    const rows = await query(
      `SELECT COUNT(*) as total_tasks,
              SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks
       FROM order_tasks
       WHERE order_id = ?`,
      [orderId]
    ) as RowDataPacket[];

    if (rows.length === 0 || rows[0].total_tasks === 0) {
      return false; // No tasks means not all completed
    }

    const total = Number(rows[0].total_tasks);
    const completed = Number(rows[0].completed_tasks || 0);

    return total === completed;
  }

  /**
   * Update task completion status
   * Priority Logic:
   * 0. If QC task completed AND order in qc_packing → move to shipping/pick_up
   * 1. If all tasks completed AND order in (production_queue, in_production, overdue) → move to qc_packing
   * 2. Else if order in production_queue → move to in_production
   */
  async updateTaskCompletion(
    taskId: number,
    completed: boolean,
    userId: number
  ): Promise<void> {
    // Get the order_id from the task
    const taskRows = await query(
      'SELECT order_id FROM order_tasks WHERE task_id = ?',
      [taskId]
    ) as RowDataPacket[];

    if (taskRows.length === 0) {
      throw new Error('Task not found');
    }

    const orderId = taskRows[0].order_id;

    // Update the task completion
    await orderPartRepository.updateTaskCompletion(taskId, completed, userId);

    // If task was just completed (not uncompleted), check order status transitions
    if (completed) {
      // PRIORITY 0: Check if this is a QC task completion
      const qcInfo = await this.getQcTaskInfo(taskId);
      if (qcInfo && qcInfo.isQcTask) {
        const newStatus = await this.handleQcTaskCompletion(orderId, userId);
        if (newStatus) {
          return; // Status transition handled, no further checks needed
        }
      }

      const order = await orderRepository.getOrderById(orderId);

      if (!order) {
        return;
      }

      // PRIORITY 1: Check if all tasks are completed
      const allTasksCompleted = await this.areAllTasksCompleted(orderId);

      if (allTasksCompleted &&
          (order.status === 'production_queue' ||
           order.status === 'in_production' ||
           order.status === 'overdue')) {
        // Move to QC & Packing with status history
        await orderService.updateOrderStatus(
          order.order_id,
          'qc_packing',
          userId,
          'Automatically moved to QC & Packing (all tasks completed)'
        );
      } else if (order.status === 'production_queue') {
        // PRIORITY 2: Move from Production Queue to In Production with status history
        await orderService.updateOrderStatus(
          order.order_id,
          'in_production',
          userId,
          'Automatically moved to In Production (first task started)'
        );
      }
    }
  }

  /**
   * Get all tasks for an order (flat list)
   */
  async getOrderTasks(orderId: number): Promise<OrderTask[]> {
    // Validate order exists
    const order = await orderRepository.getOrderById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    return await orderPartRepository.getOrderTasks(orderId);
  }

  /**
   * Get tasks grouped by part with part details
   * Only returns parent parts (is_parent = true) since tasks are assigned to parent parts
   */
  async getTasksByPart(orderId: number): Promise<any[]> {
    // Validate order exists
    const order = await orderRepository.getOrderById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    const parts = await orderPartRepository.getOrderParts(orderId);
    const parentParts = parts.filter(part => part.is_parent);
    const tasks = await orderPartRepository.getOrderTasks(orderId);

    // Group tasks by parent part only
    return parentParts.map(part => {
      const partTasks = tasks.filter(t => t.part_id === part.part_id);
      const completedCount = partTasks.filter(t => t.completed).length;

      return {
        part_id: part.part_id,
        part_number: part.part_number,
        display_number: part.display_number,
        product_type: part.product_type,
        product_type_id: part.product_type_id,
        quantity: part.quantity,
        specs_qty: part.specs_qty,
        specs_display_name: part.specs_display_name,
        specifications: part.specifications,
        production_notes: part.production_notes,
        total_tasks: partTasks.length,
        completed_tasks: completedCount,
        progress_percent: partTasks.length > 0
          ? Math.round((completedCount / partTasks.length) * 100)
          : 0,
        tasks: partTasks
      };
    });
  }

  /**
   * Get all tasks grouped by production role
   */
  async getTasksByRole(
    includeCompleted: boolean = false,
    hoursBack: number = 24,
    currentUserId?: number
  ): Promise<Record<ProductionRole, OrderTask[]>> {
    const roles: ProductionRole[] = [
      'designer',
      'manager',
      'vinyl_applicator',
      'cnc_router_operator',
      'cut_bender_operator',
      'return_fabricator',
      'trim_fabricator',
      'painter',
      'return_gluer',
      'mounting_assembler',
      'face_assembler',
      'led_installer',
      'backer_raceway_fabricator',
      'backer_raceway_assembler',
      'qc_packer'
    ];
    const result: Record<ProductionRole, OrderTask[]> = {} as Record<ProductionRole, OrderTask[]>;

    for (const role of roles) {
      const tasks = await orderPartRepository.getTasksByRole(role, includeCompleted, hoursBack, currentUserId);
      result[role] = tasks;
    }

    return result;
  }

  /**
   * Batch update tasks (start/complete) with optimistic locking support
   * Priority Logic:
   * 1. If all tasks completed AND order in (production_queue, in_production, overdue) → move to qc_packing
   * 2. Else if order in production_queue → move to in_production
   *
   * Returns: BatchUpdateResult with status changes, conflicts, and updated task versions
   */
  async batchUpdateTasks(updates: TaskUpdate[], userId: number): Promise<BatchUpdateResult> {
    const statusChanges = new Map<number, string>();
    const conflicts: BatchUpdateResult['conflicts'] = [];
    const updatedTasks: BatchUpdateResult['updatedTasks'] = [];
    // Track which orders had tasks completed
    const ordersWithCompletedTasks = new Set<number>();
    // Track QC task completions for status transition
    const qcTaskCompletions = new Set<number>(); // order_ids with QC tasks completed
    // Track successful updates for broadcasting
    const successfulUpdates: TaskUpdate[] = [];

    for (const update of updates) {
      const { task_id, started, completed, expected_version } = update;

      if (started !== undefined) {
        const result = await orderPartRepository.updateTaskStarted(
          task_id,
          started,
          userId,
          expected_version
        );

        if (!result.success) {
          // Version conflict
          conflicts.push({
            task_id,
            expected_version: expected_version!,
            current_version: result.currentVersion!
          });
          continue;  // Skip this update
        }

        updatedTasks.push({ task_id, new_version: result.newVersion! });
        successfulUpdates.push(update);
      }

      if (completed !== undefined) {
        // Get the order_id from the task
        const taskRows = await query(
          'SELECT order_id FROM order_tasks WHERE task_id = ?',
          [task_id]
        ) as RowDataPacket[];

        const result = await orderPartRepository.updateTaskCompletion(
          task_id,
          completed,
          userId,
          expected_version
        );

        if (!result.success) {
          // Version conflict
          conflicts.push({
            task_id,
            expected_version: expected_version!,
            current_version: result.currentVersion!
          });
          continue;  // Skip this update
        }

        updatedTasks.push({ task_id, new_version: result.newVersion! });
        successfulUpdates.push(update);

        if (taskRows.length > 0 && completed) {
          const orderId = taskRows[0].order_id;
          ordersWithCompletedTasks.add(orderId);

          // Check if this is a QC task completion
          const qcInfo = await this.getQcTaskInfo(task_id);
          if (qcInfo && qcInfo.isQcTask) {
            qcTaskCompletions.add(orderId);
          }
        }
      }
    }

    // PRIORITY 0: Handle QC task completions first (qc_packing -> shipping/pick_up)
    for (const orderId of qcTaskCompletions) {
      const newStatus = await this.handleQcTaskCompletion(orderId, userId);
      if (newStatus) {
        statusChanges.set(orderId, newStatus);
        // Remove from ordersWithCompletedTasks since we've handled this order
        ordersWithCompletedTasks.delete(orderId);
      }
    }

    // For each order that had tasks completed, check if it needs status transition
    for (const orderId of ordersWithCompletedTasks) {
      const order = await orderRepository.getOrderById(orderId);

      if (!order) {
        continue;
      }

      // PRIORITY 1: Check if all tasks are completed
      const allTasksCompleted = await this.areAllTasksCompleted(orderId);

      if (allTasksCompleted &&
          (order.status === 'production_queue' ||
           order.status === 'in_production' ||
           order.status === 'overdue')) {
        // Move to QC & Packing with status history
        await orderService.updateOrderStatus(
          order.order_id,
          'qc_packing',
          userId,
          'Automatically moved to QC & Packing (all tasks completed via batch update)'
        );
        statusChanges.set(order.order_id, 'qc_packing');
      } else if (order.status === 'production_queue') {
        // PRIORITY 2: Move from Production Queue to In Production with status history
        await orderService.updateOrderStatus(
          order.order_id,
          'in_production',
          userId,
          'Automatically moved to In Production (tasks started via batch update)'
        );
        statusChanges.set(order.order_id, 'in_production');
      }
    }

    // Broadcast successful updates to WebSocket clients
    if (successfulUpdates.length > 0) {
      broadcastTaskUpdate(successfulUpdates, statusChanges, userId);
    }

    return { statusChanges, conflicts, updatedTasks };
  }

  /**
   * Add a task to an order part
   */
  async addTaskToOrderPart(
    orderId: number,
    partId: number,
    taskName: string,
    assignedRole: ProductionRole | null = null,
    userId?: number
  ): Promise<number> {
    const taskId = await orderPartRepository.createOrderTask({
      order_id: orderId,
      part_id: partId,
      task_name: taskName,
      assigned_role: assignedRole
    });

    // Broadcast task creation if userId provided
    if (userId !== undefined) {
      broadcastTaskCreated(taskId, orderId, partId, taskName, assignedRole, userId);
    }

    return taskId;
  }

  /**
   * Update task notes
   */
  async updateTaskNotes(taskId: number, notes: string | null, userId?: number): Promise<void> {
    // Get orderId before update for broadcast
    let orderId: number | undefined;
    if (userId !== undefined) {
      const taskRows = await query(
        'SELECT order_id FROM order_tasks WHERE task_id = ?',
        [taskId]
      ) as RowDataPacket[];
      if (taskRows.length > 0) {
        orderId = taskRows[0].order_id;
      }
    }

    await orderPartRepository.updateTaskNotes(taskId, notes);

    // Broadcast notes update
    if (userId !== undefined && orderId !== undefined) {
      broadcastTaskNotes(taskId, orderId, notes, userId);
    }
  }

  /**
   * Remove a task by ID
   */
  async removeTask(taskId: number, userId?: number): Promise<void> {
    // Get orderId before deletion for broadcast
    let orderId: number | undefined;
    if (userId !== undefined) {
      const taskRows = await query(
        'SELECT order_id FROM order_tasks WHERE task_id = ?',
        [taskId]
      ) as RowDataPacket[];
      if (taskRows.length > 0) {
        orderId = taskRows[0].order_id;
      }
    }

    await orderPartRepository.deleteTask(taskId);

    // Broadcast task deletion
    if (userId !== undefined && orderId !== undefined) {
      broadcastTaskDeleted(taskId, orderId, userId);
    }
  }

  /**
   * Remove all tasks for a specific part
   * Used to exclude a part from Job Progress view
   */
  async removeTasksForPart(partId: number): Promise<number> {
    const result = await query(
      'DELETE FROM order_tasks WHERE part_id = ?',
      [partId]
    ) as any;
    return result.affectedRows || 0;
  }

  /**
   * Get available task templates from database
   */
  async getTaskTemplates(): Promise<{ task_name: string; assigned_role: string | null }[]> {
    return await orderPartRepository.getAvailableTasks();
  }
}

export const orderTaskService = new OrderTaskService();
