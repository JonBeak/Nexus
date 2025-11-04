/**
 * Order Conversion Service
 * Business Logic for Converting Estimates to Orders
 *
 * Orchestrates the complete conversion process:
 * 1. Validate estimate (approved status)
 * 2. Generate order number
 * 3. Create order record
 * 4. Copy estimate items to order parts
 * 5. Generate tasks from templates
 * 6. Update estimate status
 * 7. Create status history
 */

import { pool } from '../config/database';
import { orderRepository } from '../repositories/orderRepository';
import { orderTaskService } from './orderTaskService';
import {
  ConvertEstimateRequest,
  ConvertEstimateResponse,
  OrderPart,
  CreateOrderPartData
} from '../types/orders';

export class OrderConversionService {

  /**
   * Convert an approved estimate to an order
   */
  async convertEstimateToOrder(
    request: ConvertEstimateRequest,
    userId: number
  ): Promise<ConvertEstimateResponse> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Fetch and validate estimate
      const estimate = await orderRepository.getEstimateForConversion(request.estimateId, connection);

      if (!estimate) {
        throw new Error(`Estimate ${request.estimateId} not found`);
      }

      // 2. Validate estimate status (should be approved)
      if (estimate.status !== 'approved') {
        throw new Error('Only approved estimates can be converted to orders');
      }

      // 3. Get next order number
      const orderNumber = await orderRepository.getNextOrderNumber(connection);

      // 4. Create order record
      const orderId = await orderRepository.createOrder(
        {
          order_number: orderNumber,
          version_number: 1,
          order_name: request.orderName,
          estimate_id: request.estimateId,
          customer_id: estimate.customer_id,
          customer_po: request.customerPo,
          point_person_email: request.pointPersonEmail,
          order_date: new Date(),
          due_date: request.dueDate ? new Date(request.dueDate) : undefined,
          production_notes: request.productionNotes,
          form_version: 1,
          shipping_required: false,
          status: 'initiated',
          created_by: userId
        },
        connection
      );

      // 5. Copy estimate items to order_parts
      const parts = await this.copyEstimateItemsToOrderParts(
        request.estimateId,
        orderId,
        connection
      );

      // 6. Generate tasks from templates
      await orderTaskService.generateTasksForOrder(orderId, parts, connection);

      // 7. Update estimate status to 'ordered'
      await orderRepository.updateEstimateStatus(request.estimateId, 'ordered', connection);

      // 8. Create initial status history entry
      await orderRepository.createStatusHistory(
        {
          order_id: orderId,
          status: 'initiated',
          changed_by: userId,
          notes: 'Order created from estimate'
        },
        connection
      );

      await connection.commit();

      return {
        success: true,
        order_id: orderId,
        order_number: orderNumber
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Copy estimate items to order_parts
   */
  private async copyEstimateItemsToOrderParts(
    estimateId: number,
    orderId: number,
    connection: any
  ): Promise<OrderPart[]> {
    // Fetch estimate items
    const estimateItems = await orderRepository.getEstimateItems(estimateId, connection);

    const parts: OrderPart[] = [];

    // Insert each item as an order part
    for (let i = 0; i < estimateItems.length; i++) {
      const item = estimateItems[i];

      // Get product type info
      const productTypeInfo = await orderRepository.getProductTypeInfo(item.product_type_id, connection);

      if (!productTypeInfo) {
        throw new Error(`Product type ${item.product_type_id} not found`);
      }

      // Generate machine-readable product_type_id from name
      const productTypeId = this.generateProductTypeId(productTypeInfo.name);

      // Determine if this is a channel letter or other product
      const isChannelLetter = productTypeInfo.is_channel_letter;

      // Create order part data
      // Note: channel_letter_type_id left NULL for Phase 1 (can be enhanced later to extract from grid_data)
      // Only base_product_type_id is set for non-channel-letter products
      const partData: CreateOrderPartData = {
        order_id: orderId,
        part_number: i + 1,
        product_type: productTypeInfo.name,  // Human-readable
        product_type_id: productTypeId,      // Machine-readable
        channel_letter_type_id: undefined,   // Phase 1: NULL (enhance in Phase 2+ to extract from grid_data)
        base_product_type_id: !isChannelLetter ? productTypeInfo.id : undefined,
        quantity: 1,  // Default quantity
        specifications: item.grid_data || {}
      };

      // Create the order part
      const partId = await orderRepository.createOrderPart(partData, connection);

      // Add to parts array for task generation
      parts.push({
        part_id: partId,
        order_id: orderId,
        part_number: i + 1,
        product_type: productTypeInfo.name,
        product_type_id: productTypeId,
        channel_letter_type_id: undefined,   // Phase 1: NULL
        base_product_type_id: !isChannelLetter ? productTypeInfo.id : undefined,
        quantity: 1,
        specifications: item.grid_data || {}
      });
    }

    return parts;
  }

  /**
   * Generate machine-readable product_type_id from name
   */
  private generateProductTypeId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }

  /**
   * Validate that an estimate can be converted
   * (for preview/validation before conversion)
   */
  async validateEstimateForConversion(estimateId: number): Promise<{
    valid: boolean;
    reason?: string;
    estimate?: any;
  }> {
    try {
      const estimate = await orderRepository.getEstimateForConversion(estimateId);

      if (!estimate) {
        return {
          valid: false,
          reason: 'Estimate not found'
        };
      }

      if (estimate.status !== 'approved') {
        return {
          valid: false,
          reason: `Estimate status is '${estimate.status}', must be 'approved'`
        };
      }

      const items = await orderRepository.getEstimateItems(estimateId);

      if (items.length === 0) {
        return {
          valid: false,
          reason: 'Estimate has no items'
        };
      }

      return {
        valid: true,
        estimate
      };
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }
}

export const orderConversionService = new OrderConversionService();
