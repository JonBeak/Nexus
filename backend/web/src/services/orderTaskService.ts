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

/**
 * Interface for batch task update operations
 */
export interface TaskUpdate {
  task_id: number;
  started?: boolean;
  completed?: boolean;
}

export class OrderTaskService {

  // =====================================================
  // TASK CRUD OPERATIONS
  // =====================================================

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
    hoursBack: number = 24
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
      const tasks = await orderPartRepository.getTasksByRole(role, includeCompleted, hoursBack);
      result[role] = tasks;
    }

    return result;
  }

  /**
   * Batch update tasks (start/complete)
   * Priority Logic:
   * 1. If all tasks completed AND order in (production_queue, in_production, overdue) → move to qc_packing
   * 2. Else if order in production_queue → move to in_production
   *
   * Returns: Map of order_id -> new status for orders that changed
   */
  async batchUpdateTasks(updates: TaskUpdate[], userId: number): Promise<Map<number, string>> {
    const statusChanges = new Map<number, string>();
    // Track which orders had tasks completed
    const ordersWithCompletedTasks = new Set<number>();

    for (const update of updates) {
      const { task_id, started, completed } = update;

      if (started !== undefined) {
        await orderPartRepository.updateTaskStarted(task_id, started, userId);
      }

      if (completed !== undefined) {
        // Get the order_id from the task
        const taskRows = await query(
          'SELECT order_id FROM order_tasks WHERE task_id = ?',
          [task_id]
        ) as RowDataPacket[];

        if (taskRows.length > 0 && completed) {
          ordersWithCompletedTasks.add(taskRows[0].order_id);
        }

        await orderPartRepository.updateTaskCompletion(task_id, completed, userId);
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

    return statusChanges;
  }

  /**
   * Add a task to an order part
   */
  async addTaskToOrderPart(
    orderId: number,
    partId: number,
    taskName: string,
    assignedRole?: ProductionRole | null
  ): Promise<number> {
    return await orderPartRepository.createOrderTask({
      order_id: orderId,
      part_id: partId,
      task_name: taskName,
      assigned_role: assignedRole || null
    });
  }

  /**
   * Update task notes
   */
  async updateTaskNotes(taskId: number, notes: string | null): Promise<void> {
    await orderPartRepository.updateTaskNotes(taskId, notes);
  }

  /**
   * Remove a task by ID
   */
  async removeTask(taskId: number): Promise<void> {
    await orderPartRepository.deleteTask(taskId);
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
