/**
 * Order Conversion Service
 * Business Logic for Converting Estimates to Orders
 *
 * Orchestrates the complete conversion process:
 * 1. Validate estimate (approved status)
 * 2. Generate order number
 * 3. Create order record
 * 4. Copy estimate items to order parts
 * 5. Update estimate status
 * 6. Create status history
 */

import { pool } from '../config/database';
import { orderRepository } from '../repositories/orderRepository';
import {
  ConvertEstimateRequest,
  ConvertEstimateResponse,
  OrderPart,
  CreateOrderPartData,
  EstimatePreviewData,
  EstimateLineItem
} from '../types/orders';
import { mapQBItemNameToSpecsDisplayName } from '../utils/qbItemNameMapper';
import { mapSpecsDisplayNameToTypes } from '../utils/specsTypeMapper';
import { autoFillSpecifications } from './specsAutoFillService';

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

      // 2. Validate estimate status (allow draft, sent, or approved)
      // Allow draft estimates to be approved without QB estimate (user confirms in modal)
      // Allow sent estimates (from QB) to be approved
      // Allow already approved estimates (shouldn't happen in UI, but safe to allow)
      if (estimate.status !== 'draft' && estimate.status !== 'sent' && estimate.status !== 'approved') {
        throw new Error(`Cannot convert estimate with status '${estimate.status}'.`);
      }

      // 3. Validate order name uniqueness for customer
      const isUnique = await orderRepository.isOrderNameUniqueForCustomer(request.orderName, estimate.customer_id);
      if (!isUnique) {
        throw new Error(`Order name "${request.orderName}" already exists for this customer`);
      }

      // 4. Fetch customer data to auto-fill notes and invoice fields
      const [customerRows] = await connection.execute<any[]>(
        `SELECT
          special_instructions,
          comments,
          payment_terms,
          invoice_email,
          deposit_required,
          invoice_email_preference,
          cash_yes_or_no,
          discount
        FROM customers
        WHERE customer_id = ?`,
        [estimate.customer_id]
      );
      const customer = customerRows[0];

      // 4.5. Fetch billing address to auto-fill tax_name (fallback to primary if no billing)
      const [addressRows] = await connection.execute<any[]>(
        `SELECT
          ca.province_state_short,
          pt.tax_name
        FROM customer_addresses ca
        LEFT JOIN provinces_tax pt ON ca.province_state_short = pt.province_short
        WHERE ca.customer_id = ? AND ca.is_active = 1
        ORDER BY ca.is_billing DESC, ca.is_primary DESC
        LIMIT 1`,
        [estimate.customer_id]
      );

      if (!addressRows || addressRows.length === 0 || !addressRows[0]?.tax_name) {
        throw new Error('Customer must have a billing or primary address with valid province/tax information before creating an order');
      }

      const taxName = addressRows[0].tax_name;

      // 5. Get next order number
      const orderNumber = await orderRepository.getNextOrderNumber(connection);

      // 6. Create order record
      const orderData = {
        order_number: orderNumber,
        version_number: 1,
        order_name: request.orderName,
        estimate_id: request.estimateId,
        customer_id: estimate.customer_id,
        customer_po: request.customerPo,
        customer_job_number: request.customerJobNumber,        // Phase 1.5.a.5
        // point_person_email removed - now using order_point_persons table instead
        order_date: new Date(),
        due_date: request.dueDate ? new Date(request.dueDate) : undefined,
        hard_due_date_time: request.hardDueDateTime ? request.hardDueDateTime.replace('T', ' ') : undefined,  // Phase 1.5.a.5: Format for MySQL without timezone conversion
        production_notes: request.productionNotes,
        manufacturing_note: customer?.special_instructions || null,  // Auto-fill from customer
        internal_note: customer?.comments || null,                   // Auto-fill from customer
        invoice_email: customer?.invoice_email || null,              // Auto-fill from customer
        terms: customer?.payment_terms || null,                      // Auto-fill from customer
        deposit_required: customer?.deposit_required || false,       // Auto-fill from customer
        invoice_notes: customer?.invoice_email_preference || null,   // Auto-fill from customer
        cash: customer?.cash_yes_or_no || false,                     // Auto-fill from customer
        discount: customer?.discount || 0,                           // Auto-fill from customer
        tax_name: taxName,                                           // Auto-fill from billing/primary address
        form_version: 1,
        shipping_required: false,
        status: 'job_details_setup' as const,  // Phase 1.5: Start in job details setup
        created_by: userId
      };

      // Debug logging
      console.log('📝 Creating order with data:', {
        order_number: orderData.order_number,
        customer_id: orderData.customer_id,
        manufacturing_note: orderData.manufacturing_note,
        internal_note: orderData.internal_note,
        invoice_email: orderData.invoice_email,
        terms: orderData.terms,
        deposit_required: orderData.deposit_required,
        invoice_notes: orderData.invoice_notes,
        cash: orderData.cash,
        discount: orderData.discount,
        customer_job_number: orderData.customer_job_number,
        hard_due_date_time: orderData.hard_due_date_time
      });

      const orderId = await orderRepository.createOrder(orderData, connection);

      // 6.5. Create order point persons (if provided)
      if (request.pointPersons && request.pointPersons.length > 0) {
        for (let i = 0; i < request.pointPersons.length; i++) {
          const person = request.pointPersons[i];
          await orderRepository.createOrderPointPerson(
            {
              order_id: orderId,
              contact_id: person.contact_id,
              contact_email: person.contact_email,
              contact_name: person.contact_name,
              contact_phone: person.contact_phone,
              contact_role: person.contact_role,
              display_order: i
            },
            connection
          );
        }
        console.log(`✅ Created ${request.pointPersons.length} point person(s) for order`);
      }

      // 7. Create order parts from EstimatePreviewData
      if (!request.estimatePreviewData) {
        throw new Error('EstimatePreviewData is required for order creation');
      }

      const parts = await this.createOrderPartsFromPreviewData(
        request.estimatePreviewData,
        orderId,
        connection,
        estimate.customer_id  // Pass customerId for customer preferences
      );

      // 7. Generate tasks from templates - REMOVED: Tasks are now manually added by user
      // await orderTaskService.generateTasksForOrder(orderId, parts, connection);

      // 8. Update estimate status to 'ordered' (and mark as approved if not already)
      await orderRepository.updateEstimateStatusAndApproval(request.estimateId, 'ordered', true, connection);

      // 9. Create initial status history entry
      await orderRepository.createStatusHistory(
        {
          order_id: orderId,
          status: 'job_details_setup',  // Phase 1.5
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
   * Phase 1.5: Create order parts from EstimatePreviewData
   * Uses the calculated preview data with display numbers, pricing, and item details
   */
  private async createOrderPartsFromPreviewData(
    previewData: EstimatePreviewData,
    orderId: number,
    connection: any,
    customerId?: number
  ): Promise<OrderPart[]> {
    const parts: OrderPart[] = [];

    // Fetch customer preferences for auto-fill (if customerId provided)
    let customerPreferences: any = {};
    if (customerId) {
      const [prefRows] = await connection.execute(
        `SELECT drain_holes_yes_or_no FROM customers WHERE customer_id = ?`,
        [customerId]
      ) as any[];
      customerPreferences = prefRows[0] || {};
    }

    // Fetch QB item mappings for all product types in batch (case-insensitive)
    const productTypes = previewData.items.map(item => item.itemName);
    const [qbMappings] = await connection.execute(
      `SELECT item_name, description FROM qb_item_mappings
       WHERE LOWER(item_name) IN (${productTypes.map(() => 'LOWER(?)').join(', ')})`,
      productTypes
    ) as any[];

    // Create case-insensitive lookup map with name and description
    const qbMap = new Map<string, { name: string; description: string | null }>(
      qbMappings.map((row: any) => [
        row.item_name.toLowerCase(),
        { name: row.item_name, description: row.description }
      ])
    );

    // Process each estimate line item
    for (let i = 0; i < previewData.items.length; i++) {
      const item = previewData.items[i];

      // Generate machine-readable product_type_id from name
      const productTypeId = this.generateProductTypeId(item.productTypeName);

      // Get product type info from database (for channel letter detection)
      const productTypeInfo = await orderRepository.getProductTypeInfo(item.productTypeId, connection);

      if (!productTypeInfo) {
        throw new Error(`Product type ${item.productTypeId} not found`);
      }

      const isChannelLetter = productTypeInfo.is_channel_letter;

      // Auto-map QB item name and description (case-insensitive match)
      const qbItemData = qbMap.get(item.itemName.toLowerCase());
      const qbItemName = qbItemData?.name || undefined;
      const qbDescription = qbItemData?.description || '';
      console.log('[Order Conversion] Item:', item.itemName, '-> QB Item:', qbItemName, 'Description:', qbDescription?.substring(0, 50));

      // Map QB item name to specs display name
      const specsDisplayName = mapQBItemNameToSpecsDisplayName(qbItemName);
      console.log('[Order Conversion] Mapped display name:', specsDisplayName);

      // Determine if this is a parent or regular row (not a sub-item)
      // Sub-items have letters in display_number like "1a", "1b"
      const displayNumber = item.estimatePreviewDisplayNumber || `${i + 1}`;
      const isSubItem = /[a-zA-Z]/.test(displayNumber);
      const isParentOrRegular = item.isParent || !isSubItem;
      console.log('[Order Conversion] Display number:', displayNumber, 'isParent:', item.isParent, 'isSubItem:', isSubItem, 'isParentOrRegular:', isParentOrRegular);

      // Generate spec types from specs display name
      const specTypes = mapSpecsDisplayNameToTypes(specsDisplayName, isParentOrRegular);
      console.log('[Order Conversion] Generated spec types:', specTypes);

      // Build specifications object with QB description + spec templates
      const specificationsData: any = {
        _qb_description: qbDescription  // Auto-fill QB Description from qb_item_mappings
      };

      // Add spec template rows based on mapped spec types
      specTypes.forEach((specType, index) => {
        const rowNum = index + 1;
        specificationsData[`_template_${rowNum}`] = specType.name;
        // spec1, spec2, spec3 values will be auto-filled next
      });

      // Auto-fill spec values using smart parsing
      console.log('🚨 BEFORE AUTO-FILL CALL - Item:', item.itemName);
      let finalSpecifications = specificationsData;
      try {
        console.log('🚨 CALLING AUTO-FILL NOW...');
        const autoFillResult = await autoFillSpecifications({
          qbItemName: qbItemName || '',
          specsDisplayName: specsDisplayName || '',
          calculationDisplay: item.calculationDisplay || '',
          calculationComponents: item.calculationComponents,
          currentSpecifications: specificationsData,
          isParentOrRegular: isParentOrRegular,
          customerPreferences: customerPreferences,
          connection: connection
        });

        console.log('🚨 AUTO-FILL RETURNED:', autoFillResult);
        finalSpecifications = autoFillResult.specifications;

        // Log auto-fill results
        if (autoFillResult.autoFilledFields.length > 0) {
          console.log(`[Order Conversion] ✓ Auto-filled ${autoFillResult.autoFilledFields.length} spec fields:`, autoFillResult.autoFilledFields);
        }
        if (autoFillResult.warnings.length > 0) {
          console.warn('[Order Conversion] ⚠ Auto-fill warnings:', autoFillResult.warnings);
        }
      } catch (error) {
        console.error('🚨 AUTO-FILL ERROR CAUGHT:', error);
        console.error('[Order Conversion] Auto-fill error (continuing with empty specs):', error);
        // Non-blocking: continue with template-only specs if auto-fill fails
      }

      // Create order part data with Phase 1.5 fields
      const partData: CreateOrderPartData = {
        order_id: orderId,
        part_number: i + 1,
        display_number: item.estimatePreviewDisplayNumber || `${i + 1}`,  // "1", "1a", "1b", "1c"
        is_parent: item.isParent || false,
        product_type: item.itemName,  // Specific component name: "3\" Front Lit", "LEDs", "Power Supplies", "UL"
        qb_item_name: qbItemName,  // Auto-filled from qb_item_mappings
        specs_display_name: specsDisplayName,  // Mapped display name for Specs section
        product_type_id: productTypeId,
        channel_letter_type_id: undefined,  // Phase 1: NULL (can enhance later)
        base_product_type_id: !isChannelLetter ? productTypeInfo.id : undefined,
        quantity: item.quantity,
        specifications: finalSpecifications,  // Use auto-filled specifications
        // Invoice data from preview
        invoice_description: item.calculationDisplay,
        unit_price: item.unitPrice,
        extended_price: item.extendedPrice
      };

      // Create the order part
      const partId = await orderRepository.createOrderPart(partData, connection);

      // Add to parts array for task generation
      parts.push({
        part_id: partId,
        order_id: orderId,
        part_number: i + 1,
        display_number: item.estimatePreviewDisplayNumber || `${i + 1}`,
        is_parent: item.isParent || false,
        product_type: item.itemName,  // Specific component name: "3\" Front Lit", "LEDs", "Power Supplies", "UL"
        qb_item_name: qbItemName,  // Auto-filled from qb_item_mappings
        specs_display_name: specsDisplayName,  // Mapped display name for Specs section
        product_type_id: productTypeId,
        channel_letter_type_id: undefined,
        base_product_type_id: !isChannelLetter ? productTypeInfo.id : undefined,
        quantity: item.quantity,
        specifications: finalSpecifications,  // Use auto-filled specifications
        invoice_description: item.calculationDisplay,
        unit_price: item.unitPrice,
        extended_price: item.extendedPrice
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

      if (estimate.status !== 'sent' && estimate.status !== 'approved') {
        return {
          valid: false,
          reason: `Estimate status is '${estimate.status}', must be 'sent' or 'approved'`
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
