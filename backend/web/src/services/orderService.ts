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
import { broadcastOrderStatus, broadcastOrderUpdated, broadcastOrderDeleted, broadcastTaskCreated } from '../websocket';
import { validateJobOrOrderName } from '../utils/folderNameValidation';
import {
  Order,
  OrderWithDetails,
  OrderFilters,
  UpdateOrderData,
  OrderStatusHistory
} from '../types/orders';
import { getQBInvoice } from '../utils/quickbooks/invoiceClient';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import * as invoiceListingRepo from '../repositories/invoiceListingRepository';

// QC task constants
const QC_TASK_NAME = 'QC & Packing';
const QC_TASK_ROLE = 'qc_packer';

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

    // Nest tasks within their respective parts
    const partsWithTasks = parts.map(part => ({
      ...part,
      tasks: tasks.filter(task => task.part_id === part.part_id),
      total_tasks: tasks.filter(task => task.part_id === part.part_id).length,
      completed_tasks: tasks.filter(task => task.part_id === part.part_id && task.completed).length
    }));

    // Calculate progress - only count tasks in visible parts (is_parent=1 or is_order_wide=1)
    const visiblePartIds = new Set(
      parts
        .filter(part => part.is_parent || part.is_order_wide)
        .map(part => part.part_id)
    );
    const visibleTasks = tasks.filter(t => t.part_id && visiblePartIds.has(t.part_id));
    const completedTasksCount = visibleTasks.filter(t => t.completed).length;
    const totalTasksCount = visibleTasks.length;
    const progressPercent = totalTasksCount > 0
      ? Math.round((completedTasksCount / totalTasksCount) * 100)
      : 0;

    return {
      ...order,
      parts: partsWithTasks,
      tasks,
      point_persons: pointPersons,
      completed_tasks_count: completedTasksCount,
      total_tasks_count: totalTasksCount,
      progress_percent: progressPercent
    };
  }

  /**
   * Update order details
   * Handles order_name changes with validation and folder renaming
   */
  async updateOrder(orderId: number, data: UpdateOrderData, userId?: number): Promise<void> {
    // Validate order exists
    const order = await orderRepository.getOrderById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    // Handle order_name change with validation and folder rename
    if (data.order_name !== undefined && data.order_name !== order.order_name) {
      const newOrderName = data.order_name.trim();

      // 1. Validate the new name (character restrictions, length, etc.)
      const validation = validateJobOrOrderName(newOrderName);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid order name');
      }

      // Use sanitized name
      data.order_name = validation.sanitized;

      // 2. Check uniqueness for this customer (excluding current order)
      const isUnique = await orderRepository.isOrderNameUniqueForCustomer(
        data.order_name,
        order.customer_id,
        orderId
      );
      if (!isUnique) {
        throw new Error('An order with this name already exists for this customer');
      }

      // 3. Rename folder if it exists
      if (order.folder_exists && order.folder_name && order.folder_location && order.folder_location !== 'none') {
        // Build new folder name using customer name from order
        const customerName = order.customer_name || '';
        if (!customerName) {
          throw new Error('Cannot rename folder: customer name not available');
        }

        const newFolderName = orderFolderService.buildFolderName(data.order_name, customerName);

        // Check for database conflict (another order with same folder name)
        const hasDbConflict = await orderFolderService.checkDatabaseConflict(newFolderName);
        if (hasDbConflict) {
          throw new Error('An order with this folder name already exists');
        }

        // Perform the folder rename
        const renameResult = orderFolderService.renameOrderFolder(
          order.folder_name,
          newFolderName,
          order.folder_location,
          order.is_migrated ?? false
        );

        if (!renameResult.success) {
          throw new Error(`Failed to rename folder: ${renameResult.error}`);
        }

        // Rename PDFs inside the folder to match new order name
        // Get the new folder path (folder was just renamed)
        const newFolderPath = order.is_migrated
          ? (order.folder_location === 'active'
            ? `/mnt/channelletter/${newFolderName}`
            : `/mnt/channelletter/1Finished/${newFolderName}`)
          : (order.folder_location === 'active'
            ? `/mnt/channelletter/Orders/${newFolderName}`
            : `/mnt/channelletter/Orders/1Finished/${newFolderName}`);

        const pdfRenameResult = orderFolderService.renamePdfsInFolder(
          newFolderPath,
          order.order_number,
          order.order_name,
          data.order_name
        );

        if (pdfRenameResult.errors.length > 0) {
          // PDF rename failed - rollback folder rename
          console.error(`❌ PDF rename failed, rolling back folder rename...`);
          const rollbackResult = orderFolderService.renameOrderFolder(
            newFolderName,
            order.folder_name,
            order.folder_location,
            order.is_migrated ?? false
          );
          if (!rollbackResult.success) {
            console.error(`❌ Rollback also failed: ${rollbackResult.error}`);
          }
          throw new Error(`Failed to rename PDF files: ${pdfRenameResult.errors[0]}`);
        }

        // Update folder tracking in database
        await orderFolderService.updateFolderTracking(
          orderId,
          newFolderName,
          true,
          order.folder_location
        );

        console.log(`✅ Order folder renamed: "${order.folder_name}" → "${newFolderName}"`);
      }
    }

    await orderRepository.updateOrder(orderId, data);

    // Check if header-affecting fields changed - update header row for 1:1 QB sync
    const headerFields: (keyof UpdateOrderData)[] = ['order_name', 'customer_po', 'customer_job_number'];
    const headerChanged = headerFields.some(field => data[field] !== undefined);

    if (headerChanged) {
      // Dynamically import to avoid circular dependency
      const { updateHeaderRow } = await import('./invoiceHeaderService');
      await updateHeaderRow(
        orderId,
        order.order_number,
        data.order_name ?? order.order_name,
        data.customer_po ?? order.customer_po,
        data.customer_job_number ?? order.customer_job_number
      );
    }

    // Broadcast order updated event for real-time updates
    if (userId) {
      broadcastOrderUpdated(orderId, order.order_number, Object.keys(data), userId);
    }
  }

  /**
   * Delete order (pre-confirmation only)
   */
  async deleteOrder(orderId: number, userId?: number): Promise<void> {
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

    const orderNumber = order.order_number;
    await orderRepository.deleteOrder(orderId);

    // Broadcast order deleted event for real-time updates
    if (userId) {
      broadcastOrderDeleted(orderId, orderNumber, userId);
    }
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

    // Check if moving to awaiting_payment with a fully-paid invoice
    // If invoice is already paid, skip to completed instead
    if (status === 'awaiting_payment' && order.qb_invoice_id) {
      try {
        const realmId = await quickbooksRepository.getDefaultRealmId();
        if (realmId) {
          const qbInvoice = await getQBInvoice(order.qb_invoice_id, realmId);
          // Update cached balance regardless
          await invoiceListingRepo.updateCachedBalance(orderId, qbInvoice.Balance, qbInvoice.TotalAmt);

          if (qbInvoice.Balance === 0) {
            console.log(`✅ Order #${order.order_number}: Invoice fully paid, moving to completed instead of awaiting_payment`);
            status = 'completed'; // Override target status
          }
        }
      } catch (invoiceError) {
        // Non-blocking: if balance check fails, proceed with awaiting_payment
        console.error('⚠️  Invoice balance check failed:', invoiceError);
      }
    }

    // Update order status
    await orderRepository.updateOrderStatus(orderId, status);

    // Auto-create QC task when moving to qc_packing status
    if (status === 'qc_packing') {
      try {
        // Check if QC task already exists for this order
        const existingTasks = await orderPartRepository.getOrderTasks(orderId);
        const qcTaskExists = existingTasks.some(
          t => t.part_id === null && t.assigned_role === QC_TASK_ROLE && t.task_name === QC_TASK_NAME
        );

        if (!qcTaskExists) {
          // Create job-level QC task (part_id = null)
          const taskId = await orderPartRepository.createOrderTask({
            order_id: orderId,
            part_id: null,
            task_name: QC_TASK_NAME,
            assigned_role: QC_TASK_ROLE
          });
          console.log(`✅ Created QC task for order ${order.order_number} (task_id: ${taskId})`);

          // Broadcast task creation
          broadcastTaskCreated(taskId, orderId, null, QC_TASK_NAME, QC_TASK_ROLE, userId);
        }
      } catch (qcTaskError) {
        // Non-blocking: if QC task creation fails, continue with status update
        console.error('⚠️  QC task creation failed (continuing with status update):', qcTaskError);
      }
    }

    // Phase 1.5.g: Automatically move folder to 1Finished when order is completed
    if (status === 'completed' && order.folder_exists && order.folder_location === 'active' && order.folder_name && !order.is_migrated) {
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

    // Move folder to 1Cancelled when order is cancelled (new orders only)
    if (status === 'cancelled' && order.folder_exists && order.folder_location === 'active' && order.folder_name && !order.is_migrated) {
      try {
        const moveResult = await orderFolderService.moveToCancelled(order.folder_name);

        if (moveResult.success) {
          await orderFolderService.updateFolderTracking(
            orderId,
            order.folder_name,
            true,
            'cancelled'
          );
          console.log(`✅ Order folder moved to 1Cancelled: ${order.folder_name}`);
        } else if (moveResult.conflict) {
          console.warn(`⚠️  Cannot move folder - conflict exists in 1Cancelled: ${order.folder_name}`);
        } else {
          console.error(`❌ Failed to move folder to cancelled: ${moveResult.error}`);
        }
      } catch (folderError) {
        console.error('⚠️  Folder movement to cancelled failed (continuing with status update):', folderError);
      }
    }

    // Move folder to 1Hold when order is on hold (new orders only)
    if (status === 'on_hold' && order.folder_exists && order.folder_location === 'active' && order.folder_name && !order.is_migrated) {
      try {
        const moveResult = await orderFolderService.moveToHold(order.folder_name);

        if (moveResult.success) {
          await orderFolderService.updateFolderTracking(
            orderId,
            order.folder_name,
            true,
            'hold'
          );
          console.log(`✅ Order folder moved to 1Hold: ${order.folder_name}`);
        } else if (moveResult.conflict) {
          console.warn(`⚠️  Cannot move folder - conflict exists in 1Hold: ${order.folder_name}`);
        } else {
          console.error(`❌ Failed to move folder to hold: ${moveResult.error}`);
        }
      } catch (folderError) {
        console.error('⚠️  Folder movement to hold failed (continuing with status update):', folderError);
      }
    }

    // Move folder FROM cancelled or on_hold when status changes to something else
    const previousStatus = order.status;
    if ((previousStatus === 'cancelled' || previousStatus === 'on_hold') &&
        status !== 'cancelled' && status !== 'on_hold' &&
        order.folder_exists && order.folder_name && !order.is_migrated) {
      try {
        const fromLocation = previousStatus === 'cancelled' ? 'cancelled' : 'hold';
        const toLocation = status === 'completed' ? 'finished' : 'active';

        // Check if folder is actually in the cancelled/hold location before trying to move
        if (order.folder_location === fromLocation) {
          const moveResult = await orderFolderService.moveFromCancelledOrHold(
            order.folder_name,
            fromLocation,
            toLocation
          );

          if (moveResult.success) {
            await orderFolderService.updateFolderTracking(
              orderId,
              order.folder_name,
              true,
              toLocation
            );
            console.log(`✅ Order folder moved from ${fromLocation} to ${toLocation}: ${order.folder_name}`);
          } else if (moveResult.conflict) {
            console.warn(`⚠️  Cannot move folder - conflict exists in ${toLocation}: ${order.folder_name}`);
          } else {
            console.error(`❌ Failed to move folder from ${fromLocation}: ${moveResult.error}`);
          }
        }
      } catch (folderError) {
        console.error('⚠️  Folder movement from cancelled/hold failed (continuing with status update):', folderError);
      }
    }

    // Create status history entry
    await orderRepository.createStatusHistory({
      order_id: orderId,
      status,
      changed_by: userId,
      notes
    });

    // Broadcast status change to WebSocket clients
    broadcastOrderStatus(orderId, order.order_number, status, order.status, userId);
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

    // Get visible part IDs (same logic as getTasksByPart - parents and order-wide parts)
    const visiblePartIds = new Set(
      parts
        .filter(part => part.is_parent || part.is_order_wide)
        .map(part => part.part_id)
    );

    // Only count tasks in visible parts (exclude NULL part_id tasks)
    const visibleTasks = tasks.filter(t => t.part_id && visiblePartIds.has(t.part_id));

    const completedTasks = visibleTasks.filter(t => t.completed).length;
    const totalTasks = visibleTasks.length;
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

  /**
   * Update order accounting emails
   * Updates the accounting_emails JSON column on the order
   * Optionally saves new emails to customer_accounting_emails table
   */
  async updateOrderAccountingEmails(
    orderId: number,
    customerId: number,
    accountingEmails: Array<{
      email: string;
      email_type: 'to' | 'cc' | 'bcc';
      label?: string;
      saveToDatabase?: boolean;
    }>,
    userId?: number
  ): Promise<void> {
    // Import CustomerAccountingEmailService dynamically to avoid circular dependency
    const { CustomerAccountingEmailService } = await import('./customerAccountingEmailService');
    const accountingEmailService = new CustomerAccountingEmailService();

    // For each email with saveToDatabase flag, create in customer_accounting_emails
    for (const email of accountingEmails) {
      if (email.saveToDatabase && email.email) {
        try {
          const result = await accountingEmailService.createEmail({
            customer_id: customerId,
            email: email.email,
            email_type: email.email_type,
            label: email.label
          }, userId || 0);
          if (result.success) {
            console.log(`✅ Accounting email saved to customer: ${email.email}`);
          } else {
            console.warn(`⚠️ Failed to save accounting email: ${result.error}`);
          }
        } catch (err) {
          // May fail if email already exists - that's OK
          console.warn(`⚠️ Failed to save accounting email (may already exist): ${email.email}`);
        }
      }
    }

    // Build the order accounting emails array (without saveToDatabase flag)
    const orderAccountingEmails = accountingEmails.map(ae => ({
      email: ae.email,
      email_type: ae.email_type,
      label: ae.label
    }));

    // Update the order's accounting_emails JSON column
    await orderRepository.updateOrderAccountingEmails(orderId, orderAccountingEmails);
  }

}

export const orderService = new OrderService();
