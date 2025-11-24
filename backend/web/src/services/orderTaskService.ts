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
   * Update task completion status
   */
  async updateTaskCompletion(
    taskId: number,
    completed: boolean,
    userId: number
  ): Promise<void> {
    await orderPartRepository.updateTaskCompletion(taskId, completed, userId);
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
   */
  async batchUpdateTasks(updates: TaskUpdate[], userId: number): Promise<void> {
    for (const update of updates) {
      const { task_id, started, completed } = update;

      if (started !== undefined) {
        await orderPartRepository.updateTaskStarted(task_id, started, userId);
      }

      if (completed !== undefined) {
        await orderPartRepository.updateTaskCompletion(task_id, completed, userId);
      }
    }
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
   * Get available task templates from database
   */
  async getTaskTemplates(): Promise<{ task_name: string; assigned_role: string | null }[]> {
    return await orderPartRepository.getAvailableTasks();
  }
}

export const orderTaskService = new OrderTaskService();
