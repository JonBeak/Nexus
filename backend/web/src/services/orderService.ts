// File Clean up Finished: Nov 14, 2025
// File Refactored: Nov 14, 2025 (Phase 2: Architectural refactoring)
// Changes:
//   - Updated batchUpdateTasks to use updateTaskCompletion instead of updateTaskCompleted
//   - Extracted all snapshot database access to orderSnapshotRepository
//   - Removed direct pool.execute() calls from snapshot methods
//   - Maintained transaction support in finalizeOrder()
//
// Note on pool usage (Nov 14, 2025):
//   - Uses pool.getConnection() for transaction support in finalizeOrder()
//   - Transactions require BEGIN/COMMIT/ROLLBACK with dedicated connection
//   - This is the CORRECT and ONLY valid use case for pool in services
//   - Cannot use query() helper for transactional operations
//
// File Clean up Finished: 2025-11-15
// Additional cleanup: Added getOrderIdFromOrderNumber helper for orderFormController refactoring
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
 * - Snapshot & versioning (Phase 1.5.c.3)
 */

import { orderRepository } from '../repositories/orderRepository';
import { orderSnapshotRepository } from '../repositories/orderSnapshotRepository';
import { orderFolderService } from './orderFolderService';
import { pool } from '../config/database';
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
   * Get order_id from order_number
   * Used for controllers that receive order_number from URL params
   */
  async getOrderIdFromOrderNumber(orderNumber: number): Promise<number> {
    const orderId = await orderRepository.getOrderIdFromOrderNumber(orderNumber);

    if (!orderId) {
      throw new Error('Order not found');
    }

    return orderId;
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
    const pointPersons = await orderRepository.getOrderPointPersons(orderId);

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
      point_persons: pointPersons,
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
    const deletableStatuses = ['job_details_setup', 'pending_confirmation'];

    if (!deletableStatuses.includes(order.status)) {
      throw new Error(`Cannot delete order with status '${order.status}'. Only orders with status 'job_details_setup' or 'pending_confirmation' can be deleted.`);
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
      'job_details_setup',
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

    // Phase 1.5.g: Automatically move folder to 1Finished when order is completed
    if (status === 'completed' && order.folder_exists && order.folder_location === 'active' && order.folder_name) {
      try {
        const moveResult = await orderFolderService.moveToFinished(order.folder_name);

        if (moveResult.success) {
          // Update folder location in database
          await orderFolderService.updateFolderTracking(
            orderId,
            order.folder_name,
            true,
            'finished'
          );
          console.log(`✅ Order folder moved to 1Finished: ${order.folder_name}`);
        } else if (moveResult.conflict) {
          // Folder name conflict in finished location - keep in active
          console.warn(`⚠️  Cannot move folder - conflict exists in 1Finished: ${order.folder_name}`);
        } else {
          console.error(`❌ Failed to move folder: ${moveResult.error}`);
        }
      } catch (folderError) {
        // Non-blocking: if folder movement fails, continue with status update
        console.error('⚠️  Folder movement failed (continuing with status update):', folderError);
      }
    }

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
        await orderRepository.updateTaskCompletion(task_id, completed, userId);
      }
    }
  }

  // =====================================================
  // SNAPSHOT & VERSIONING (Phase 1.5.c.3)
  // =====================================================

  /**
   * Create snapshot for a single order part
   * Phase 1.5.c.3
   */
  async createPartSnapshot(
    partId: number,
    userId: number,
    snapshotType: 'finalization' | 'manual' = 'finalization',
    notes?: string
  ): Promise<number> {
    // Get current part data
    const part = await orderSnapshotRepository.getPartForSnapshot(partId);

    if (!part) {
      throw new Error('Part not found');
    }

    // Get next version number for this part
    const versionNumber = await orderSnapshotRepository.getNextSnapshotVersion(partId);

    // Create snapshot using repository
    const snapshotId = await orderSnapshotRepository.createPartSnapshot({
      part_id: partId,
      version_number: versionNumber,
      specifications: part.specifications,
      invoice_description: part.invoice_description,
      quantity: part.quantity,
      unit_price: part.unit_price,
      extended_price: part.extended_price,
      production_notes: part.production_notes,
      snapshot_type: snapshotType,
      notes: notes || null,
      created_by: userId
    });

    return snapshotId;
  }

  /**
   * Finalize order - create snapshots for all parts and update order
   * Phase 1.5.c.3
   */
  async finalizeOrder(orderId: number, userId: number): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get all parts for this order
      const parts = await orderSnapshotRepository.getAllPartsForOrder(orderId, connection);

      // Create snapshot for each part
      for (const part of parts) {
        await this.createPartSnapshot(part.part_id, userId, 'finalization', 'Order finalized');
      }

      // Update order with finalization info
      await orderSnapshotRepository.updateOrderFinalization(orderId, userId, connection);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get latest snapshot for a part
   * Phase 1.5.c.3
   */
  async getLatestSnapshot(partId: number): Promise<any | null> {
    return await orderSnapshotRepository.getLatestPartSnapshot(partId);
  }

  /**
   * Get all snapshots for a part (for version history viewer)
   * Phase 1.5.c.3
   */
  async getSnapshotHistory(partId: number): Promise<any[]> {
    return await orderSnapshotRepository.getPartSnapshotHistory(partId);
  }

  /**
   * Compare current part state with latest snapshot
   * Phase 1.5.c.3
   */
  async compareWithLatestSnapshot(partId: number): Promise<{
    hasSnapshot: boolean;
    isModified: boolean;
    latestSnapshot: any | null;
    currentState: any;
    modifications: any[];
  }> {
    // Get latest snapshot
    const latestSnapshot = await this.getLatestSnapshot(partId);

    // Get current part state
    const currentPart = await orderSnapshotRepository.getPartForSnapshot(partId);

    if (!currentPart) {
      throw new Error('Part not found');
    }

    const currentState = {
      specifications: currentPart.specifications,
      invoice_description: currentPart.invoice_description,
      quantity: currentPart.quantity,
      unit_price: currentPart.unit_price,
      extended_price: currentPart.extended_price,
      production_notes: currentPart.production_notes
    };

    if (!latestSnapshot) {
      return {
        hasSnapshot: false,
        isModified: false,
        latestSnapshot: null,
        currentState,
        modifications: []
      };
    }

    // Parse specifications
    const snapshotSpecs = typeof latestSnapshot.specifications === 'string'
      ? JSON.parse(latestSnapshot.specifications)
      : latestSnapshot.specifications;
    const currentSpecs = typeof currentState.specifications === 'string'
      ? JSON.parse(currentState.specifications)
      : currentState.specifications;

    // Detect modifications
    const modifications: any[] = [];

    // Check specifications
    if (JSON.stringify(snapshotSpecs) !== JSON.stringify(currentSpecs)) {
      modifications.push({
        type: 'specifications',
        snapshotValue: snapshotSpecs,
        currentValue: currentSpecs
      });
    }

    // Check invoice fields
    const invoiceFields: Array<keyof typeof currentState> = ['invoice_description', 'quantity', 'unit_price', 'extended_price'];
    for (const field of invoiceFields) {
      if ((latestSnapshot as any)[field] !== currentState[field]) {
        modifications.push({
          type: field,
          snapshotValue: (latestSnapshot as any)[field],
          currentValue: currentState[field]
        });
      }
    }

    // Check production notes
    if (latestSnapshot.production_notes !== currentState.production_notes) {
      modifications.push({
        type: 'production_notes',
        snapshotValue: latestSnapshot.production_notes,
        currentValue: currentState.production_notes
      });
    }

    return {
      hasSnapshot: true,
      isModified: modifications.length > 0,
      latestSnapshot,
      currentState,
      modifications
    };
  }
}

export const orderService = new OrderService();
