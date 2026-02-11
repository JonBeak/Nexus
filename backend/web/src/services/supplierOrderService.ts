/**
 * Supplier Order Service
 * Business logic for supplier order management
 * Created: 2026-02-02
 */

import {
  SupplierOrderRepository,
  SupplierOrderRow,
  SupplierOrderItemRow,
} from '../repositories/supplierOrderRepository';
import { MaterialRequirementRepository } from '../repositories/materialRequirementRepository';
import { ServiceResult } from '../types/serviceResults';
import {
  SupplierOrder,
  SupplierOrderItem,
  SupplierOrderWithItems,
  SupplierOrderStatus,
  SupplierOrderSearchParams,
  CreateSupplierOrderRequest,
  CreateSupplierOrderItemRequest,
  UpdateSupplierOrderRequest,
  UpdateSupplierOrderItemRequest,
  GenerateOrderRequest,
  ReceiveItemsRequest,
  SupplierOrderStatusHistory,
} from '../types/supplierOrders';

export class SupplierOrderService {
  private repository: SupplierOrderRepository;
  private materialRequirementRepository: MaterialRequirementRepository;

  constructor() {
    this.repository = new SupplierOrderRepository();
    this.materialRequirementRepository = new MaterialRequirementRepository();
  }

  // ============================================================================
  // ORDER OPERATIONS
  // ============================================================================

  /**
   * Get all supplier orders with optional filtering
   */
  async getOrders(
    params: SupplierOrderSearchParams
  ): Promise<ServiceResult<SupplierOrderRow[]>> {
    try {
      const orders = await this.repository.findAll(params);
      return { success: true, data: orders };
    } catch (error) {
      console.error('Error in SupplierOrderService.getOrders:', error);
      return {
        success: false,
        error: 'Failed to fetch supplier orders',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Get single order by ID
   */
  async getOrderById(id: number): Promise<ServiceResult<SupplierOrderRow>> {
    try {
      const order = await this.repository.findById(id);

      if (!order) {
        return {
          success: false,
          error: 'Supplier order not found',
          code: 'NOT_FOUND',
        };
      }

      return { success: true, data: order };
    } catch (error) {
      console.error('Error in SupplierOrderService.getOrderById:', error);
      return {
        success: false,
        error: 'Failed to fetch supplier order',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Get order with all items
   */
  async getOrderWithItems(id: number): Promise<ServiceResult<SupplierOrderWithItems>> {
    try {
      const order = await this.repository.findByIdWithItems(id);

      if (!order) {
        return {
          success: false,
          error: 'Supplier order not found',
          code: 'NOT_FOUND',
        };
      }

      return { success: true, data: order };
    } catch (error) {
      console.error('Error in SupplierOrderService.getOrderWithItems:', error);
      return {
        success: false,
        error: 'Failed to fetch supplier order',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Create new supplier order
   */
  async createOrder(
    data: CreateSupplierOrderRequest,
    userId?: number
  ): Promise<ServiceResult<{ order_id: number; order_number: string }>> {
    try {
      // Validate supplier_id
      if (!data.supplier_id) {
        return {
          success: false,
          error: 'Supplier ID is required',
          code: 'VALIDATION_ERROR',
        };
      }

      // Create the order
      const orderId = await this.repository.create(data, userId);

      // Add items if provided
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          await this.repository.addItem(orderId, item);
        }
      }

      // Get the created order to return the order number
      const order = await this.repository.findById(orderId);

      return {
        success: true,
        data: {
          order_id: orderId,
          order_number: order?.order_number || '',
        },
      };
    } catch (error) {
      console.error('Error in SupplierOrderService.createOrder:', error);
      return {
        success: false,
        error: 'Failed to create supplier order',
        code: 'CREATE_ERROR',
      };
    }
  }

  /**
   * Generate order from material requirements
   */
  async generateOrderFromRequirements(
    data: GenerateOrderRequest,
    userId?: number
  ): Promise<ServiceResult<{ order_id: number; order_number: string; items_created: number; requirements_linked: number }>> {
    try {
      // Validate inputs
      if (!data.supplier_id) {
        return {
          success: false,
          error: 'Supplier ID is required',
          code: 'VALIDATION_ERROR',
        };
      }
      if (!data.requirement_ids || data.requirement_ids.length === 0) {
        return {
          success: false,
          error: 'At least one requirement must be selected',
          code: 'VALIDATION_ERROR',
        };
      }

      // Fetch the requirements
      const requirements = await this.materialRequirementRepository.findAll({
        status: ['pending', 'backordered'],
      });

      // Filter to only selected IDs
      const selectedRequirements = requirements.filter(
        req => data.requirement_ids.includes(req.requirement_id)
      );

      if (selectedRequirements.length === 0) {
        return {
          success: false,
          error: 'No valid pending requirements found',
          code: 'VALIDATION_ERROR',
        };
      }

      // Create the order
      const orderId = await this.repository.create({
        supplier_id: data.supplier_id,
        expected_delivery_date: data.expected_delivery_date,
        delivery_method: data.delivery_method,
        notes: data.notes,
      }, userId);

      // Create items from requirements
      let itemsCreated = 0;
      for (const req of selectedRequirements) {
        const itemData: CreateSupplierOrderItemRequest = {
          product_description: [req.supplier_product_brand?.trim(), req.supplier_product_name?.trim()].filter(Boolean).join(' ')
            || req.archetype_name || req.custom_product_type || 'Unknown Product',
          quantity_ordered: req.quantity_ordered,
          unit_of_measure: req.unit || req.unit_of_measure || 'each',
          material_requirement_id: req.requirement_id,
        };

        await this.repository.addItem(orderId, itemData);
        itemsCreated++;
      }

      // Link requirements to this order
      const requirementIds = selectedRequirements.map(r => r.requirement_id);
      await this.repository.linkRequirements(orderId, requirementIds, userId);

      // Get the created order
      const order = await this.repository.findById(orderId);

      return {
        success: true,
        data: {
          order_id: orderId,
          order_number: order?.order_number || '',
          items_created: itemsCreated,
          requirements_linked: requirementIds.length,
        },
      };
    } catch (error) {
      console.error('Error in SupplierOrderService.generateOrderFromRequirements:', error);
      return {
        success: false,
        error: 'Failed to generate order from requirements',
        code: 'GENERATE_ERROR',
      };
    }
  }

  /**
   * Update supplier order
   */
  async updateOrder(
    id: number,
    data: UpdateSupplierOrderRequest,
    userId?: number
  ): Promise<ServiceResult<void>> {
    try {
      // Verify order exists
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Supplier order not found',
          code: 'NOT_FOUND',
        };
      }

      // Only allow editing internal_notes on submitted+ orders
      if (existing.status !== 'submitted' && Object.keys(data).some(k => k !== 'internal_notes')) {
        return {
          success: false,
          error: 'Can only edit submitted orders (except internal notes)',
          code: 'VALIDATION_ERROR',
        };
      }

      await this.repository.update(id, data, userId);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in SupplierOrderService.updateOrder:', error);
      return {
        success: false,
        error: 'Failed to update supplier order',
        code: 'UPDATE_ERROR',
      };
    }
  }

  /**
   * Submit order to supplier
   */
  async submitOrder(
    id: number,
    orderDate?: Date | string,
    userId?: number,
    notes?: string,
    emailOverrides?: { to?: string; cc?: string; bcc?: string; subject?: string; opening?: string; closing?: string }
  ): Promise<ServiceResult<void>> {
    try {
      const order = await this.repository.findByIdWithItems(id);

      if (!order) {
        return {
          success: false,
          error: 'Supplier order not found',
          code: 'NOT_FOUND',
        };
      }

      if (order.status === 'delivered' || order.status === 'cancelled') {
        return {
          success: false,
          error: 'Cannot submit a delivered or cancelled order',
          code: 'VALIDATION_ERROR',
        };
      }

      if (!order.items || order.items.length === 0) {
        return {
          success: false,
          error: 'Cannot submit order with no items',
          code: 'VALIDATION_ERROR',
        };
      }

      const date = orderDate || new Date();
      await this.repository.submit(id, date, userId, notes);

      // Update linked material requirements to 'ordered' status
      if (order.items && order.items.length > 0) {
        const requirementIds = order.items
          .filter(item => item.material_requirement_id)
          .map(item => item.material_requirement_id as number);
        if (requirementIds.length > 0) {
          await this.repository.linkRequirements(order.order_id, requirementIds, userId);
        }
      }

      // Send PO email to supplier (non-blocking — don't fail the submission)
      try {
        const { sendPurchaseOrderEmail } = await import('./supplierOrderEmailService');
        const emailResult = await sendPurchaseOrderEmail(id, emailOverrides);
        if (emailResult.success) {
          await this.repository.updateEmailSentAt(id);
        } else {
          console.warn(`⚠️ PO email not sent for order ${id}: ${emailResult.reason || emailResult.error}`);
        }
      } catch (emailError) {
        console.error(`❌ PO email error for order ${id}:`, emailError);
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in SupplierOrderService.submitOrder:', error);
      return {
        success: false,
        error: 'Failed to submit order',
        code: 'SUBMIT_ERROR',
      };
    }
  }

  /**
   * Submit a draft PO (new flow — no existing supplier_orders row).
   * Creates snapshot from MR data, stamps ordered_date on MRs, sends email.
   */
  async submitDraftPO(
    supplierId: number,
    requirementIds: number[],
    deliveryMethod: 'shipping' | 'pickup',
    userId?: number,
    notes?: string,
    emailOverrides?: { to?: string; cc?: string; bcc?: string; subject?: string; opening?: string; closing?: string }
  ): Promise<ServiceResult<{ order_id: number; order_number: string; email_sent: boolean; email_message: string }>> {
    try {
      if (!supplierId || supplierId <= 0) {
        return { success: false, error: 'Valid supplier ID is required', code: 'VALIDATION_ERROR' };
      }
      if (!requirementIds || requirementIds.length === 0) {
        return { success: false, error: 'At least one requirement must be selected', code: 'VALIDATION_ERROR' };
      }

      // Fetch eligible MRs using the same criteria as the Draft PO display query
      const eligibleReqs = await this.materialRequirementRepository.findForDraftPO(supplierId);
      const selectedReqs = eligibleReqs.filter(
        r => requirementIds.includes(r.requirement_id)
      );

      if (selectedReqs.length === 0) {
        return { success: false, error: 'No valid pending requirements found for this supplier', code: 'VALIDATION_ERROR' };
      }

      // Generate PO number
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const orderNumber = await this.repository.generatePONumber(supplierId, today);

      // Build snapshot items from MR data WITH PRICING
      const items = selectedReqs.map(req => ({
        product_description: [req.supplier_product_brand?.trim(), req.supplier_product_name?.trim()].filter(Boolean).join(' ')
          || req.archetype_name || req.custom_product_type || 'Unknown Product',
        sku: req.supplier_product_sku || null,
        quantity_ordered: Number(req.quantity_ordered),
        unit_of_measure: req.unit || req.unit_of_measure || 'each',
        unit_price: req.supplier_product_current_price != null ? Number(req.supplier_product_current_price) : 0,
        material_requirement_id: req.requirement_id,
        supplier_product_id: req.supplier_product_id || null,
        notes: null,
      }));

      // Create snapshot in supplier_orders + supplier_order_items
      // (needed in DB so the email template can read order data)
      const orderId = await this.repository.createSnapshot(
        orderNumber, supplierId, today, deliveryMethod, notes ?? null, items, userId
      );

      // Load company email for internal copy
      const { query: dbQuery } = await import('../config/database');
      const settingsRows = await dbQuery(
        `SELECT setting_value FROM rbac_settings WHERE setting_name = 'company_email' LIMIT 1`
      ) as any[];
      const companyEmail = settingsRows[0]?.setting_value || process.env.GMAIL_BCC_EMAIL || '';

      // Send TWO emails: one to supplier (no pricing), one to company (with pricing)
      let supplierEmailSent = false;
      let internalEmailSent = false;
      let emailMessage = 'Emails not attempted';

      try {
        const { sendPurchaseOrderEmail } = await import('./supplierOrderEmailService');

        // EMAIL #1: To supplier + optional BCC (WITHOUT PRICING)
        const supplierResult = await sendPurchaseOrderEmail(
          orderId,
          emailOverrides,
          false  // showPricing = false
        );

        if (supplierResult.success) {
          supplierEmailSent = true;
          console.log(`✅ Supplier email sent for PO ${orderId}`);
        } else {
          console.warn(`⚠️ Supplier email failed for PO ${orderId}: ${supplierResult.reason || supplierResult.error}`);
        }

        // EMAIL #2: To company (WITH PRICING)
        // Only send if we have a company email
        if (companyEmail) {
          const internalOverrides = {
            to: companyEmail,
            subject: `[INTERNAL] ${emailOverrides?.subject || 'Purchase Order'} - With Pricing`,
            opening: `[Internal Record - Includes Pricing]\n\n${emailOverrides?.opening || ''}`,
            closing: emailOverrides?.closing,
          };

          const internalResult = await sendPurchaseOrderEmail(
            orderId,
            internalOverrides,
            true  // showPricing = true
          );

          if (internalResult.success) {
            internalEmailSent = true;
            console.log(`✅ Internal email (with pricing) sent for PO ${orderId}`);
          } else {
            console.warn(`⚠️ Internal email failed for PO ${orderId}: ${internalResult.reason || internalResult.error}`);
          }
        }

        // Update email sent timestamp if at least supplier email succeeded
        if (supplierEmailSent) {
          await this.repository.updateEmailSentAt(orderId);
        }

        // Build status message
        if (supplierEmailSent && internalEmailSent) {
          emailMessage = 'Both emails sent successfully (supplier without pricing, internal with pricing)';
        } else if (supplierEmailSent) {
          emailMessage = 'Supplier email sent (internal email failed or no company email configured)';
        } else {
          emailMessage = 'Supplier email failed';
        }

      } catch (emailError) {
        emailMessage = emailError instanceof Error ? emailError.message : 'Email send failed';
        console.error(`❌ Email error for order ${orderId}:`, emailError);
      }

      // If SUPPLIER email failed, roll back — internal email is optional
      if (!supplierEmailSent) {
        try {
          await this.repository.unlinkRequirements(orderId);
          await this.repository.delete(orderId);
        } catch (cleanupError) {
          console.error(`❌ Failed to clean up order ${orderId} after email failure:`, cleanupError);
        }
        return {
          success: false,
          error: `Supplier email failed — order not created. ${emailMessage}`,
          code: 'EMAIL_ERROR',
        };
      }

      // Email succeeded — stamp ordered_date, delivery_method, supplier_order_id on each MR
      await this.materialRequirementRepository.stampOrdered(
        requirementIds, today, deliveryMethod, orderId, userId
      );

      return {
        success: true,
        data: { order_id: orderId, order_number: orderNumber, email_sent: supplierEmailSent, email_message: emailMessage },
      };
    } catch (error) {
      console.error('Error in SupplierOrderService.submitDraftPO:', error);
      return {
        success: false,
        error: 'Failed to submit draft PO',
        code: 'SUBMIT_ERROR',
      };
    }
  }

  /**
   * Update order status
   */
  async updateStatus(
    id: number,
    newStatus: SupplierOrderStatus,
    userId?: number,
    notes?: string
  ): Promise<ServiceResult<void>> {
    try {
      const order = await this.repository.findById(id);

      if (!order) {
        return {
          success: false,
          error: 'Supplier order not found',
          code: 'NOT_FOUND',
        };
      }

      // Validate status transition
      const validTransitions = this.getValidStatusTransitions(order.status);
      if (!validTransitions.includes(newStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${order.status} to ${newStatus}`,
          code: 'VALIDATION_ERROR',
        };
      }

      await this.repository.updateStatus(id, newStatus, userId, notes);

      // If cancelled, unlink requirements
      if (newStatus === 'cancelled') {
        await this.repository.unlinkRequirements(id);
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in SupplierOrderService.updateStatus:', error);
      return {
        success: false,
        error: 'Failed to update order status',
        code: 'UPDATE_ERROR',
      };
    }
  }

  /**
   * Delete supplier order
   */
  async deleteOrder(id: number): Promise<ServiceResult<void>> {
    try {
      const order = await this.repository.findById(id);

      if (!order) {
        return {
          success: false,
          error: 'Supplier order not found',
          code: 'NOT_FOUND',
        };
      }

      if (order.status === 'delivered') {
        return {
          success: false,
          error: 'Cannot delete delivered orders',
          code: 'VALIDATION_ERROR',
        };
      }

      // Unlink any requirements before deletion
      await this.repository.unlinkRequirements(id);

      await this.repository.delete(id);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in SupplierOrderService.deleteOrder:', error);
      return {
        success: false,
        error: 'Failed to delete supplier order',
        code: 'DELETE_ERROR',
      };
    }
  }

  // ============================================================================
  // ITEM OPERATIONS
  // ============================================================================

  /**
   * Add item to order
   */
  async addItem(
    orderId: number,
    data: CreateSupplierOrderItemRequest
  ): Promise<ServiceResult<number>> {
    try {
      const order = await this.repository.findById(orderId);

      if (!order) {
        return {
          success: false,
          error: 'Supplier order not found',
          code: 'NOT_FOUND',
        };
      }

      if (order.status === 'delivered' || order.status === 'cancelled') {
        return {
          success: false,
          error: 'Cannot add items to delivered or cancelled orders',
          code: 'VALIDATION_ERROR',
        };
      }

      if (!data.product_description) {
        return {
          success: false,
          error: 'Product description is required',
          code: 'VALIDATION_ERROR',
        };
      }

      if (!data.quantity_ordered || data.quantity_ordered <= 0) {
        return {
          success: false,
          error: 'Quantity must be greater than 0',
          code: 'VALIDATION_ERROR',
        };
      }

      const itemId = await this.repository.addItem(orderId, data);

      return { success: true, data: itemId };
    } catch (error) {
      console.error('Error in SupplierOrderService.addItem:', error);
      return {
        success: false,
        error: 'Failed to add item',
        code: 'CREATE_ERROR',
      };
    }
  }

  /**
   * Update order item
   */
  async updateItem(
    itemId: number,
    data: UpdateSupplierOrderItemRequest
  ): Promise<ServiceResult<void>> {
    try {
      const item = await this.repository.getItem(itemId);

      if (!item) {
        return {
          success: false,
          error: 'Order item not found',
          code: 'NOT_FOUND',
        };
      }

      const order = await this.repository.findById(item.order_id);
      if (!order || order.status === 'delivered' || order.status === 'cancelled') {
        return {
          success: false,
          error: 'Cannot edit items on delivered or cancelled orders',
          code: 'VALIDATION_ERROR',
        };
      }

      await this.repository.updateItem(itemId, data);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in SupplierOrderService.updateItem:', error);
      return {
        success: false,
        error: 'Failed to update item',
        code: 'UPDATE_ERROR',
      };
    }
  }

  /**
   * Remove item from order
   */
  async removeItem(itemId: number): Promise<ServiceResult<void>> {
    try {
      const item = await this.repository.getItem(itemId);

      if (!item) {
        return {
          success: false,
          error: 'Order item not found',
          code: 'NOT_FOUND',
        };
      }

      const order = await this.repository.findById(item.order_id);
      if (!order || order.status === 'delivered' || order.status === 'cancelled') {
        return {
          success: false,
          error: 'Cannot remove items from delivered or cancelled orders',
          code: 'VALIDATION_ERROR',
        };
      }

      await this.repository.removeItem(itemId);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in SupplierOrderService.removeItem:', error);
      return {
        success: false,
        error: 'Failed to remove item',
        code: 'DELETE_ERROR',
      };
    }
  }

  // ============================================================================
  // RECEIVING
  // ============================================================================

  /**
   * Receive items on an order
   */
  async receiveItems(
    orderId: number,
    data: ReceiveItemsRequest,
    userId?: number
  ): Promise<ServiceResult<{ items_received: number; order_status: SupplierOrderStatus; fully_delivered: boolean }>> {
    try {
      const order = await this.repository.findByIdWithItems(orderId);

      if (!order) {
        return {
          success: false,
          error: 'Supplier order not found',
          code: 'NOT_FOUND',
        };
      }

      if (!['submitted', 'acknowledged', 'partial_received'].includes(order.status)) {
        return {
          success: false,
          error: `Cannot receive items on order with status: ${order.status}`,
          code: 'VALIDATION_ERROR',
        };
      }

      if (!data.items || data.items.length === 0) {
        return {
          success: false,
          error: 'At least one item must be received',
          code: 'VALIDATION_ERROR',
        };
      }

      const receivedDate = data.received_date || new Date();
      let itemsReceived = 0;

      for (const receiveItem of data.items) {
        if (receiveItem.quantity_received <= 0) continue;

        // Receive on supplier order item
        const result = await this.repository.receiveItem(
          receiveItem.item_id,
          receiveItem.quantity_received,
          receivedDate,
          userId
        );

        // Also update linked material requirement if exists
        const item = await this.repository.getItem(receiveItem.item_id);
        if (item?.material_requirement_id) {
          await this.materialRequirementRepository.receiveQuantity(
            item.material_requirement_id,
            receiveItem.quantity_received,
            receivedDate,
            userId
          );
        }

        itemsReceived++;
      }

      // Check if all items are fully received
      const updatedOrder = await this.repository.findByIdWithItems(orderId);
      const allReceived = updatedOrder?.items.every(
        item => Number(item.quantity_received) >= Number(item.quantity_ordered)
      );

      // Update order status
      let newStatus: SupplierOrderStatus = order.status;
      if (allReceived) {
        newStatus = 'delivered';
        await this.repository.updateStatus(orderId, 'delivered', userId, data.notes ?? undefined);
        await this.repository.update(orderId, { actual_delivery_date: receivedDate }, userId);
      } else if (itemsReceived > 0) {
        newStatus = 'partial_received';
        if (order.status !== 'partial_received') {
          await this.repository.updateStatus(orderId, 'partial_received', userId, data.notes ?? undefined);
        }
      }

      return {
        success: true,
        data: {
          items_received: itemsReceived,
          order_status: newStatus,
          fully_delivered: allReceived || false,
        },
      };
    } catch (error) {
      console.error('Error in SupplierOrderService.receiveItems:', error);
      return {
        success: false,
        error: 'Failed to receive items',
        code: 'RECEIVE_ERROR',
      };
    }
  }

  // ============================================================================
  // STATUS HISTORY
  // ============================================================================

  /**
   * Get status history for an order
   */
  async getStatusHistory(orderId: number): Promise<ServiceResult<SupplierOrderStatusHistory[]>> {
    try {
      const order = await this.repository.findById(orderId);
      if (!order) {
        return {
          success: false,
          error: 'Supplier order not found',
          code: 'NOT_FOUND',
        };
      }

      const history = await this.repository.getStatusHistory(orderId);
      return { success: true, data: history };
    } catch (error) {
      console.error('Error in SupplierOrderService.getStatusHistory:', error);
      return {
        success: false,
        error: 'Failed to fetch status history',
        code: 'FETCH_ERROR',
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get orders by supplier
   */
  async getOrdersBySupplier(supplierId: number): Promise<ServiceResult<SupplierOrderRow[]>> {
    try {
      const orders = await this.repository.findBySupplier(supplierId);
      return { success: true, data: orders };
    } catch (error) {
      console.error('Error in SupplierOrderService.getOrdersBySupplier:', error);
      return {
        success: false,
        error: 'Failed to fetch supplier orders',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Get status counts
   */
  async getStatusCounts(): Promise<ServiceResult<Record<SupplierOrderStatus, number>>> {
    try {
      const counts = await this.repository.getCountByStatus();
      return { success: true, data: counts };
    } catch (error) {
      console.error('Error in SupplierOrderService.getStatusCounts:', error);
      return {
        success: false,
        error: 'Failed to fetch status counts',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Get valid status transitions
   */
  private getValidStatusTransitions(currentStatus: SupplierOrderStatus): SupplierOrderStatus[] {
    const transitions: Record<SupplierOrderStatus, SupplierOrderStatus[]> = {
      submitted: ['acknowledged', 'partial_received', 'delivered', 'cancelled'],
      acknowledged: ['partial_received', 'delivered', 'cancelled'],
      partial_received: ['delivered', 'cancelled'],
      delivered: [], // Terminal state
      cancelled: ['submitted'], // Can reopen as submitted
    };

    return transitions[currentStatus] || [];
  }
}
