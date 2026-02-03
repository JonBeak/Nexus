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
          product_description: req.archetype_name || req.custom_product_type || 'Unknown Product',
          quantity_ordered: req.quantity_ordered,
          unit_of_measure: req.unit_of_measure || 'each',
          material_requirement_id: req.requirement_id,
          notes: req.size_description ? `Size: ${req.size_description}` : undefined,
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

      // Only allow edits to draft orders
      if (existing.status !== 'draft' && Object.keys(data).some(k => k !== 'internal_notes')) {
        return {
          success: false,
          error: 'Can only edit draft orders (except internal notes)',
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
    notes?: string
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

      if (order.status !== 'draft') {
        return {
          success: false,
          error: 'Can only submit draft orders',
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
   * Delete supplier order (draft only)
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

      if (order.status !== 'draft') {
        return {
          success: false,
          error: 'Can only delete draft orders',
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

      if (order.status !== 'draft') {
        return {
          success: false,
          error: 'Can only add items to draft orders',
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
      if (!order || order.status !== 'draft') {
        return {
          success: false,
          error: 'Can only edit items on draft orders',
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
      if (!order || order.status !== 'draft') {
        return {
          success: false,
          error: 'Can only remove items from draft orders',
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
      draft: ['submitted', 'cancelled'],
      submitted: ['acknowledged', 'partial_received', 'delivered', 'cancelled'],
      acknowledged: ['partial_received', 'delivered', 'cancelled'],
      partial_received: ['delivered', 'cancelled'],
      delivered: [], // Terminal state
      cancelled: ['draft'], // Can reopen as draft
    };

    return transitions[currentStatus] || [];
  }
}
