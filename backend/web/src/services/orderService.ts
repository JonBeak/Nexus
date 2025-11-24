// File Clean up Finished: 2025-11-21
// Changes (2025-11-21):
//   - Migrated 8 task methods to orderTaskService.ts
//   - Migrated 5 snapshot methods to orderSnapshotService.ts
//   - Migrated 9 part management methods to orderPartsService.ts
//   - File reduced from 961 → 324 lines (well under 500 limit!)
//
// Previous changes (Nov 14-15, 2025):
//   - Extracted all snapshot database access to orderSnapshotRepository
//   - Added getOrderIdFromOrderNumber helper for orderFormController refactoring
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
import { orderPartRepository } from '../repositories/orderPartRepository';
import { orderConversionRepository } from '../repositories/orderConversionRepository';
import { orderFolderService } from './orderFolderService';
import {
  Order,
  OrderWithDetails,
  OrderFilters,
  UpdateOrderData,
  OrderStatusHistory
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
   * Throws if not found
   */
  async getOrderIdFromOrderNumber(orderNumber: number): Promise<number> {
    const orderId = await orderRepository.getOrderIdFromOrderNumber(orderNumber);

    if (!orderId) {
      throw new Error('Order not found');
    }

    return orderId;
  }

  /**
   * Try to get order_id from order_number
   * Returns null if not found (doesn't throw)
   * Used for controller helpers that need to return null on not found
   */
  async tryGetOrderIdFromOrderNumber(orderNumber: number): Promise<number | null> {
    return await orderRepository.getOrderIdFromOrderNumber(orderNumber);
  }

  /**
   * Get tax name for order's customer based on billing address
   * Used when unchecking cash job to restore proper tax
   */
  async getCustomerTaxFromBillingAddress(orderNumber: number): Promise<string> {
    const orderId = await this.getOrderIdFromOrderNumber(orderNumber);
    const taxName = await orderRepository.getCustomerTaxFromBillingAddress(orderId);

    if (!taxName) {
      throw new Error('No tax configuration found for customer billing address');
    }

    return taxName;
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
    const parts = await orderPartRepository.getOrderParts(orderId);
    const tasks = await orderPartRepository.getOrderTasks(orderId);
    const pointPersons = await orderConversionRepository.getOrderPointPersons(orderId);

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

    const parts = await orderPartRepository.getOrderParts(orderId);
    const tasks = await orderPartRepository.getOrderTasks(orderId);

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

  // =====================================================
  // ORDER NAME & ESTIMATE HELPERS (Phase 1.1-1.2)
  // =====================================================

  /**
   * Check if order name is unique for a customer
   * Used during order creation/validation
   */
  async isOrderNameUniqueForCustomer(orderName: string, customerId: number): Promise<boolean> {
    return await orderRepository.isOrderNameUniqueForCustomer(orderName, customerId);
  }

  /**
   * Get order by estimate ID
   * Returns order_id and order_number if exists
   */
  async getOrderByEstimateId(estimateId: number): Promise<{ order_id: number; order_number: number } | null> {
    return await orderRepository.getOrderByEstimateId(estimateId);
  }

  // =====================================================
  // POINT PERSONS MANAGEMENT
  // =====================================================

  /**
   * Update order point persons
   * Deletes existing and creates new point persons
   * Optionally saves new contacts to customer_contacts table
   */
  async updateOrderPointPersons(
    orderId: number,
    customerId: number,
    pointPersons: Array<{
      contact_id?: number;
      contact_email: string;
      contact_name?: string;
      contact_phone?: string;
      contact_role?: string;
      saveToDatabase?: boolean;
    }>,
    userId?: number
  ): Promise<void> {
    // Import CustomerContactService class dynamically to avoid circular dependency
    const { CustomerContactService } = await import('./customerContactService');
    const customerContactService = new CustomerContactService();

    // Delete existing point persons
    await orderConversionRepository.deleteOrderPointPersons(orderId);

    // Create new point persons
    for (let i = 0; i < pointPersons.length; i++) {
      const person = pointPersons[i];
      let contactId = person.contact_id;

      // If this is a custom contact with saveToDatabase flag, create it first
      if (person.saveToDatabase && !person.contact_id && person.contact_email) {
        try {
          const result = await customerContactService.createContact({
            customer_id: customerId,
            contact_email: person.contact_email,
            contact_name: person.contact_name || person.contact_email, // Use email as fallback name
            contact_phone: person.contact_phone || undefined,
            contact_role: person.contact_role || undefined
          }, userId || 0);

          if (result.success && result.data) {
            contactId = result.data;
            console.log(`✅ Contact saved to database: ${person.contact_email} (ID: ${contactId})`);
          } else if (!result.success) {
            console.warn(`⚠️ Failed to save contact: ${result.error}`);
          }
        } catch (err) {
          console.error('Failed to save contact to database:', err);
          // Continue without saving to database - still create point person entry
        }
      }

      // Create order point person entry
      await orderConversionRepository.createOrderPointPerson({
        order_id: orderId,
        contact_id: contactId,
        contact_email: person.contact_email,
        contact_name: person.contact_name,
        contact_phone: person.contact_phone,
        contact_role: person.contact_role,
        display_order: i
      });
    }
  }

}

export const orderService = new OrderService();
