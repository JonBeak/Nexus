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
import * as cashPaymentRepo from '../repositories/cashPaymentRepository';
import { aiFileValidationRepository } from '../repositories/aiFileValidationRepository';

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

    // Job-level tasks (part_id = null) - e.g., QC & Packing
    // These are separate from order-wide part tasks and can be shown/hidden independently
    const jobLevelTasks = tasks.filter(t => t.part_id === null);

    // Calculate progress - count tasks in visible parts (is_parent=1 or is_order_wide=1) + job-level tasks
    const visiblePartIds = new Set(
      parts
        .filter(part => part.is_parent || part.is_order_wide)
        .map(part => part.part_id)
    );
    const visiblePartTasks = tasks.filter(t => t.part_id && visiblePartIds.has(t.part_id));
    // Include job-level tasks in progress calculation
    const allVisibleTasks = [...visiblePartTasks, ...jobLevelTasks];
    const completedTasksCount = allVisibleTasks.filter(t => t.completed).length;
    const totalTasksCount = allVisibleTasks.length;
    const progressPercent = totalTasksCount > 0
      ? Math.round((completedTasksCount / totalTasksCount) * 100)
      : 0;

    return {
      ...order,
      parts: partsWithTasks,
      tasks,
      jobLevelTasks,
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
   * Returns result with optional warnings (e.g., folder movement issues)
   */
  async updateOrderStatus(
    orderId: number,
    status: string,
    userId: number,
    notes?: string
  ): Promise<{ warnings?: string[] }> {
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
      return {};
    }

    // Warnings to return to frontend (e.g. status redirects)
    const warnings: string[] = [];

    // Check if moving to "completed" with unpaid balance → redirect to "awaiting_payment"
    if (status === 'completed') {
      if (order.qb_invoice_id) {
        try {
          const realmId = await quickbooksRepository.getDefaultRealmId();
          if (realmId) {
            const qbInvoice = await getQBInvoice(order.qb_invoice_id, realmId);
            // Update cached balance regardless
            await invoiceListingRepo.updateCachedBalance(orderId, qbInvoice.Balance, qbInvoice.TotalAmt);

            if (qbInvoice.Balance > 0) {
              console.log(`⚠️  Order #${order.order_number}: Invoice has unpaid balance $${qbInvoice.Balance}, redirecting to awaiting_payment`);
              status = 'awaiting_payment';
            }
          }
        } catch (invoiceError) {
          // Non-blocking: if balance check fails, proceed with completed
          console.error('⚠️  Invoice balance check failed:', invoiceError);
        }
      } else if (order.cash) {
        try {
          const total = await cashPaymentRepo.calculateOrderTotal(orderId);
          const totalPaid = await cashPaymentRepo.getTotalPaymentsForOrder(orderId);
          const balance = Math.max(0, total - totalPaid);

          // Update cached balance
          await cashPaymentRepo.updateOrderCachedBalance(orderId, balance, total);

          if (balance > 0) {
            console.log(`⚠️  Cash job #${order.order_number}: Has unpaid balance $${balance}, redirecting to awaiting_payment`);
            status = 'awaiting_payment';
          }
        } catch (cashError) {
          // Non-blocking: if balance check fails, proceed with completed
          console.error('⚠️  Cash balance check failed:', cashError);
        }
      } else {
        // Non-cash order with no invoice — cannot complete without payment verification
        console.log(`⚠️  Order #${order.order_number}: No invoice created — redirecting to awaiting_payment instead of completed`);
        status = 'awaiting_payment';
      }
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

    // Check if moving to awaiting_payment with a fully-paid cash job
    // If cash job is already paid, skip to completed instead
    if (status === 'awaiting_payment' && order.cash) {
      try {
        const total = await cashPaymentRepo.calculateOrderTotal(orderId);
        const totalPaid = await cashPaymentRepo.getTotalPaymentsForOrder(orderId);
        const balance = Math.max(0, total - totalPaid);

        // Update cached balance
        await cashPaymentRepo.updateOrderCachedBalance(orderId, balance, total);

        if (balance === 0) {
          console.log(`✅ Cash job #${order.order_number}: Fully paid, moving to completed instead of awaiting_payment`);
          status = 'completed';
        }
      } catch (cashError) {
        // Non-blocking: if balance check fails, proceed with awaiting_payment
        console.error('⚠️  Cash balance check failed:', cashError);
      }
    }

    // Update order status
    await orderRepository.updateOrderStatus(orderId, status);

    // Sync QC & Packing task completion based on status change
    // - shipping/pick_up/awaiting_payment/completed → mark complete
    // - production statuses → mark incomplete
    // - on_hold/cancelled → no change
    const COMPLETE_STATUSES = ['shipping', 'pick_up', 'awaiting_payment', 'completed'];
    const INCOMPLETE_STATUSES = ['pending_production_files_creation', 'pending_production_files_approval', 'production_queue', 'in_production', 'overdue', 'qc_packing'];

    if (COMPLETE_STATUSES.includes(status) || INCOMPLETE_STATUSES.includes(status)) {
      try {
        const existingTasks = await orderPartRepository.getOrderTasks(orderId);
        const qcTask = existingTasks.find(
          t => t.part_id === null && t.task_name === QC_TASK_NAME
        );

        if (qcTask) {
          const shouldBeComplete = COMPLETE_STATUSES.includes(status);
          if (qcTask.completed !== shouldBeComplete) {
            await orderPartRepository.updateTaskCompletion(qcTask.task_id, shouldBeComplete);
            console.log(`✅ QC task ${shouldBeComplete ? 'completed' : 'uncompleted'} for order ${order.order_number} (status: ${status})`);
          }
        }
      } catch (qcTaskError) {
        // Non-blocking: if QC task sync fails, continue
        console.error('⚠️  QC task sync failed (continuing with status update):', qcTaskError);
      }
    }

    // === UNIFIED FOLDER MOVEMENT LOGIC ===
    // Move folder to correct location based on new status (new orders only)
    if (order.folder_exists && order.folder_name && !order.is_migrated) {
      const getExpectedLocation = (orderStatus: string): 'active' | 'finished' | 'cancelled' | 'hold' => {
        if (orderStatus === 'completed' || orderStatus === 'awaiting_payment') return 'finished';
        if (orderStatus === 'cancelled') return 'cancelled';
        if (orderStatus === 'on_hold') return 'hold';
        return 'active';
      };

      const expectedLocation = getExpectedLocation(status);
      const currentLocation = order.folder_location as 'active' | 'finished' | 'cancelled' | 'hold' | 'none';

      if (currentLocation && currentLocation !== 'none' && currentLocation !== expectedLocation) {
        try {
          const moveResult = await orderFolderService.moveFolder(
            order.folder_name,
            currentLocation,
            expectedLocation
          );

          if (moveResult.success) {
            await orderFolderService.updateFolderTracking(orderId, order.folder_name, true, expectedLocation);
            console.log(`✅ Order folder moved: ${currentLocation} → ${expectedLocation}: ${order.folder_name}`);
          } else if (moveResult.conflict) {
            const warning = `Folder not moved: already exists in ${expectedLocation}`;
            warnings.push(warning);
            console.warn(`⚠️  ${warning}: ${order.folder_name}`);
          } else {
            const warning = `Folder not moved: ${moveResult.error || 'unknown error'}`;
            warnings.push(warning);
            console.error(`❌ ${warning}`);
          }
        } catch (folderError) {
          const warning = `Folder movement failed: ${folderError instanceof Error ? folderError.message : 'unknown error'}`;
          warnings.push(warning);
          console.error('⚠️  Folder movement failed (continuing with status update):', folderError);
        }
      }
    }
    // === END UNIFIED FOLDER MOVEMENT LOGIC ===

    // Clean up AI file validation data for terminal/hold statuses
    const CLEANUP_STATUSES = ['awaiting_payment', 'completed', 'cancelled', 'on_hold'];
    if (CLEANUP_STATUSES.includes(status)) {
      try {
        const deleted = await aiFileValidationRepository.deleteAllForOrder(order.order_number);
        if (deleted > 0) {
          console.log(`🗑️  Cleaned up ${deleted} AI validation records for order #${order.order_number} (status: ${status})`);
        }
      } catch (cleanupError) {
        console.error('⚠️  AI validation cleanup failed (continuing with status update):', cleanupError);
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

    return { warnings: warnings.length > 0 ? warnings : undefined };
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

  // =====================================================
  // KANBAN BOARD OPTIMIZED DATA
  // =====================================================

  /**
   * Get orders grouped and sorted for Kanban board display
   * Backend handles all grouping, sorting, and calculated fields
   */
  async getKanbanData(options: {
    showAllCompleted?: boolean;
    showAllCancelled?: boolean;
  } = {}): Promise<{
    columns: Record<string, any[]>;
    painting: any[];
    totalCounts: { completed: number; cancelled: number };
  }> {
    // Get orders and holidays from repository
    const { orders, holidays } = await orderRepository.getOrdersForKanban(options);
    const holidaySet = new Set(holidays);

    // Calculate work days left for each order
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ordersWithCalcs = orders.map(order => {
      // Calculate work_days_left
      let work_days_left: number | null = null;
      if (order.due_date) {
        const dueDate = new Date(order.due_date + 'T00:00:00');
        work_days_left = this.calculateWorkDaysBetween(today, dueDate, holidaySet);
      }

      // Calculate progress_percent
      const totalTasks = order.total_tasks || 0;
      const completedTasks = order.completed_tasks || 0;
      const progress_percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        ...order,
        work_days_left,
        progress_percent
      };
    });

    // Group orders by status
    const columns: Record<string, any[]> = {};
    const KANBAN_STATUSES = [
      'job_details_setup',
      'pending_confirmation',
      'pending_production_files_creation',
      'pending_production_files_approval',
      'production_queue',
      'in_production',
      'overdue',
      'qc_packing',
      'shipping',
      'pick_up',
      'awaiting_payment',
      'completed',
      'cancelled',
      'on_hold'
    ];

    for (const status of KANBAN_STATUSES) {
      columns[status] = ordersWithCalcs.filter(o => o.status === status);
    }

    // Sort post-production columns: uninvoiced/unsent first, then invoice sent
    // Within each group, maintain due_date sorting (already applied from SQL)
    const sortByInvoiceStatus = (a: any, b: any) => {
      const aInvoiceSent = a.invoice_sent_at ? 1 : 0;
      const bInvoiceSent = b.invoice_sent_at ? 1 : 0;
      return aInvoiceSent - bInvoiceSent;
    };

    if (columns['shipping']) {
      columns['shipping'].sort(sortByInvoiceStatus);
    }
    if (columns['pick_up']) {
      columns['pick_up'].sort(sortByInvoiceStatus);
    }
    if (columns['awaiting_payment']) {
      columns['awaiting_payment'].sort(sortByInvoiceStatus);
    }
    if (columns['completed']) {
      columns['completed'].sort(sortByInvoiceStatus);
    }

    // Filter painting orders - cross-status aggregation
    const PAINTING_ELIGIBLE_STATUSES = ['production_queue', 'in_production', 'overdue', 'qc_packing'];
    const painting = ordersWithCalcs.filter(o =>
      PAINTING_ELIGIBLE_STATUSES.includes(o.status) &&
      (o.incomplete_painting_tasks_count || 0) > 0
    );

    // Get total counts for show-all buttons
    const totalCounts = await orderRepository.getKanbanStatusCounts();

    return {
      columns,
      painting,
      totalCounts
    };
  }

  // =====================================================
  // FOLDER MISMATCH DETECTION & RETRY
  // =====================================================

  /**
   * Get orders where folder_location doesn't match expected location based on status
   */
  async getFolderMismatches(): Promise<Array<{
    order_id: number;
    order_number: number;
    order_name: string;
    status: string;
    folder_name: string;
    folder_location: string;
    expected_location: string;
    customer_name: string;
  }>> {
    return await orderRepository.getFolderMismatches();
  }

  /**
   * Get expected folder location based on order status
   */
  private getExpectedFolderLocation(status: string): 'active' | 'finished' | 'cancelled' | 'hold' {
    if (status === 'completed' || status === 'awaiting_payment') {
      return 'finished';
    }
    if (status === 'cancelled') {
      return 'cancelled';
    }
    if (status === 'on_hold') {
      return 'hold';
    }
    return 'active';
  }

  /**
   * Retry moving folder to correct location based on order status
   * Returns success/failure with error message
   */
  async retryFolderMove(orderId: number): Promise<{
    success: boolean;
    message: string;
    newLocation?: string;
  }> {
    const order = await orderRepository.getOrderById(orderId);
    if (!order) {
      return { success: false, message: 'Order not found' };
    }

    if (!order.folder_exists || !order.folder_name) {
      return { success: false, message: 'Order does not have a folder' };
    }

    if (order.is_migrated) {
      return { success: false, message: 'Cannot move folders for migrated orders' };
    }

    const currentLocation = order.folder_location as 'active' | 'finished' | 'cancelled' | 'hold';
    const expectedLocation = this.getExpectedFolderLocation(order.status);

    if (currentLocation === expectedLocation) {
      return { success: true, message: 'Folder is already in the correct location' };
    }

    const moveResult = await orderFolderService.moveFolder(
      order.folder_name,
      currentLocation,
      expectedLocation
    );

    if (moveResult.success) {
      await orderFolderService.updateFolderTracking(orderId, order.folder_name, true, expectedLocation);
      console.log(`✅ Folder moved for order #${order.order_number}: ${currentLocation} → ${expectedLocation}`);
      return {
        success: true,
        message: `Folder moved from ${currentLocation} to ${expectedLocation}`,
        newLocation: expectedLocation
      };
    }

    if (moveResult.conflict) {
      return { success: false, message: `Conflict: folder already exists in ${expectedLocation}` };
    }

    return { success: false, message: moveResult.error || 'Failed to move folder' };
  }

  /**
   * Retry folder moves for all mismatched orders
   * Returns summary of results
   */
  async retryAllFolderMoves(): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    results: Array<{ order_number: number; success: boolean; message: string }>;
  }> {
    const mismatches = await this.getFolderMismatches();
    const results: Array<{ order_number: number; success: boolean; message: string }> = [];

    for (const mismatch of mismatches) {
      const result = await this.retryFolderMove(mismatch.order_id);
      results.push({
        order_number: mismatch.order_number,
        success: result.success,
        message: result.message
      });
    }

    return {
      total: mismatches.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Calculate work days between two dates (excludes weekends and holidays)
   * Returns positive for future dates, negative for past dates
   */
  private calculateWorkDaysBetween(fromDate: Date, toDate: Date, holidays: Set<string>): number {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(0, 0, 0, 0);

    // Same day = 0
    if (from.getTime() === to.getTime()) return 0;

    const isPast = to < from;
    const start = isPast ? to : from;
    const end = isPast ? from : to;

    let count = 0;
    const current = new Date(start);
    current.setDate(current.getDate() + 1); // Start counting from next day

    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split('T')[0];
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateStr)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return isPast ? -count : count;
  }
}

export const orderService = new OrderService();
