/**
 * Order Service
 * Business Logic for Order CRUD Operations
 *
 * Handles:
 * - Order retrieval with details
 * - Order updates
 * - Order deletion
 * - Status management
 * - Progress calculation
 */

import { orderRepository } from '../repositories/orderRepository';
import {
  Order,
  OrderWithDetails,
  OrderFilters,
  UpdateOrderData,
  OrderStatusHistory,
  OrderTask
} from '../types/orders';

export class OrderService {

  /**
   * Get all orders with optional filters
   */
  async getAllOrders(filters: OrderFilters): Promise<Order[]> {
    return await orderRepository.getOrders(filters);
  }

  /**
   * Get single order with full details (parts, tasks, progress)
   */
  async getOrderById(orderId: number): Promise<OrderWithDetails | null> {
    const order = await orderRepository.getOrderById(orderId);

    if (!order) {
      return null;
    }

    // Get related data
    const parts = await orderRepository.getOrderParts(orderId);
    const tasks = await orderRepository.getOrderTasks(orderId);

    // Calculate progress
    const completedTasksCount = tasks.filter(t => t.completed).length;
    const totalTasksCount = tasks.length;
    const progressPercent = totalTasksCount > 0
      ? Math.round((completedTasksCount / totalTasksCount) * 100)
      : 0;

    return {
      ...order,
      parts,
      tasks,
      completed_tasks_count: completedTasksCount,
      total_tasks_count: totalTasksCount,
      progress_percent: progressPercent
    };
  }

  /**
   * Update order details
   */
  async updateOrder(orderId: number, data: UpdateOrderData): Promise<void> {
    // Validate order exists
    const order = await orderRepository.getOrderById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    await orderRepository.updateOrder(orderId, data);
  }

  /**
   * Delete order (pre-confirmation only)
   */
  async deleteOrder(orderId: number): Promise<void> {
    // Validate order exists
    const order = await orderRepository.getOrderById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    // Business rule: Only allow deletion of certain statuses
    const deletableStatuses = ['initiated', 'pending_confirmation'];

    if (!deletableStatuses.includes(order.status)) {
      throw new Error(`Cannot delete order with status '${order.status}'. Only orders with status 'initiated' or 'pending_confirmation' can be deleted.`);
    }

    await orderRepository.deleteOrder(orderId);
  }

  /**
   * Update order status with history tracking
   */
  async updateOrderStatus(
    orderId: number,
    status: string,
    userId: number,
    notes?: string
  ): Promise<void> {
    // Validate order exists
    const order = await orderRepository.getOrderById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    // Validate status is valid
    const validStatuses = [
      'initiated',
      'pending_confirmation',
      'pending_production_files_creation',
      'pending_production_files_approval',
      'production_queue',
      'in_production',
      'on_hold',
      'overdue',
      'qc_packing',
      'shipping',
      'pick_up',
      'awaiting_payment',
      'completed',
      'cancelled'
    ];

    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    // Don't update if status is the same
    if (order.status === status) {
      return;
    }

    // Update order status
    await orderRepository.updateOrderStatus(orderId, status);

    // Create status history entry
    await orderRepository.createStatusHistory({
      order_id: orderId,
      status,
      changed_by: userId,
      notes
    });
  }

  /**
   * Get status history for an order
   */
  async getStatusHistory(orderId: number): Promise<OrderStatusHistory[]> {
    // Validate order exists
    const order = await orderRepository.getOrderById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    return await orderRepository.getStatusHistory(orderId);
  }

  /**
   * Get order progress summary
   */
  async getOrderProgress(orderId: number): Promise<{
    order_id: number;
    order_number: number;
    status: string;
    total_tasks: number;
    completed_tasks: number;
    progress_percent: number;
    tasks_by_part: any[];
  }> {
    const order = await orderRepository.getOrderById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    const parts = await orderRepository.getOrderParts(orderId);
    const tasks = await orderRepository.getOrderTasks(orderId);

    const completedTasks = tasks.filter(t => t.completed).length;
    const totalTasks = tasks.length;
    const progressPercent = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    // Group tasks by part
    const tasksByPart = parts.map(part => {
      const partTasks = tasks.filter(t => t.part_id === part.part_id);
      const completedPartTasks = partTasks.filter(t => t.completed).length;

      return {
        part_id: part.part_id,
        part_number: part.part_number,
        product_type: part.product_type,
        total_tasks: partTasks.length,
        completed_tasks: completedPartTasks,
        progress_percent: partTasks.length > 0
          ? Math.round((completedPartTasks / partTasks.length) * 100)
          : 0
      };
    });

    return {
      order_id: order.order_id,
      order_number: order.order_number,
      status: order.status,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      progress_percent: progressPercent,
      tasks_by_part: tasksByPart
    };
  }

  /**
   * Update task completion status
   */
  async updateTaskCompletion(
    taskId: number,
    completed: boolean,
    userId: number
  ): Promise<void> {
    await orderRepository.updateTaskCompletion(taskId, completed, userId);
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

    return await orderRepository.getOrderTasks(orderId);
  }

  /**
   * Get tasks grouped by part with part details
   */
  async getTasksByPart(orderId: number): Promise<any[]> {
    // Validate order exists
    const order = await orderRepository.getOrderById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    const parts = await orderRepository.getOrderParts(orderId);
    const tasks = await orderRepository.getOrderTasks(orderId);

    // Group tasks by part
    return parts.map(part => {
      const partTasks = tasks.filter(t => t.part_id === part.part_id);
      const completedCount = partTasks.filter(t => t.completed).length;

      return {
        part_id: part.part_id,
        part_number: part.part_number,
        product_type: part.product_type,
        product_type_id: part.product_type_id,
        quantity: part.quantity,
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
  async getTasksByRole(includeCompleted: boolean = false, hoursBack: number = 24) {
    const roles = ['designer', 'vinyl_cnc', 'painting', 'cut_bend', 'leds', 'packing'];
    const result: any = {};

    for (const role of roles) {
      const tasks = await orderRepository.getTasksByRole(role, includeCompleted, hoursBack);
      result[role] = tasks;
    }

    return result;
  }

  /**
   * Batch update tasks (start/complete)
   */
  async batchUpdateTasks(updates: any[], userId: number) {
    for (const update of updates) {
      const { task_id, started, completed } = update;

      if (started !== undefined) {
        await orderRepository.updateTaskStarted(task_id, started, userId);
      }

      if (completed !== undefined) {
        await orderRepository.updateTaskCompleted(task_id, completed, userId);
      }
    }
  }
}

export const orderService = new OrderService();
