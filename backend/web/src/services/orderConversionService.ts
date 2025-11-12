/**
 * Order Conversion Service
 * Business Logic for Converting Estimates to Orders
 *
 * Orchestrates the complete conversion process:
 * 1. Validate estimate (approved status)
 * 2. Check folder name conflicts
 * 3. Generate order number
 * 4. Create order record
 * 5. Copy estimate items to order parts
 * 6. Update estimate status
 * 7. Create status history
 * 8. Create order folder on SMB share
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
import { orderFolderService } from './orderFolderService';

export class OrderConversionService {

  /**
   * Convert an approved estimate to an order
   */
  async convertEstimateToOrder(
    request: ConvertEstimateRequest,
    userId: number
  ): Promise<ConvertEstimateResponse> {
    console.time('[Order Conversion] Total time');

    // Check SMB share health FIRST (7-second timeout) - fail fast if network is down
    console.log('[Order Conversion] Checking SMB share accessibility...');
    const smbHealthy = await orderFolderService.checkSMBHealth(7000);
    if (!smbHealthy) {
      throw new Error('Order folder network share is not accessible. Please check that the network connection is available and try again.');
    }
    console.log('[Order Conversion] ✓ SMB share is accessible, proceeding with order creation...');

    const connection = await pool.getConnection();

    try {
      console.time('[Order Conversion] Begin transaction');
      await connection.beginTransaction();
      console.timeEnd('[Order Conversion] Begin transaction');

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

      // 3. Fetch customer data to auto-fill notes and invoice fields
      const [customerRows] = await connection.execute<any[]>(
        `SELECT
          company_name,
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

      // 4. Check for folder name conflicts (case-insensitive, all orders)
      const folderName = orderFolderService.buildFolderName(request.orderName, customer.company_name);
      const hasConflict = await orderFolderService.checkDatabaseConflict(folderName);
      if (hasConflict) {
        throw new Error(
          `An order with this name already exists for ${customer.company_name}. ` +
          `Please choose a different order name to avoid folder conflicts.`
        );
      }

      // 5. Fetch billing address to auto-fill tax_name (fallback to primary if no billing)
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

      // 6. Get next order number
      const orderNumber = await orderRepository.getNextOrderNumber(connection);

      // 7. Create order record
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
        hard_due_date_time: request.hardDueDateTime || undefined,  // Phase 1.5.a.5: TIME format "HH:mm:ss"
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

      // 8. Create order point persons (if provided)
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

      // 9. Create order parts from EstimatePreviewData
      if (!request.estimatePreviewData) {
        throw new Error('EstimatePreviewData is required for order creation');
      }

      console.time('[Order Conversion] Create order parts');
      const parts = await this.createOrderPartsFromPreviewData(
        request.estimatePreviewData,
        orderId,
        connection,
        estimate.customer_id  // Pass customerId for customer preferences
      );
      console.timeEnd('[Order Conversion] Create order parts');

      // 10. Update estimate status to 'ordered' (and mark as approved if not already)
      await orderRepository.updateEstimateStatusAndApproval(request.estimateId, 'ordered', true, connection);

      // 11. Create initial status history entry
      await orderRepository.createStatusHistory(
        {
          order_id: orderId,
          status: 'job_details_setup',  // Phase 1.5
          changed_by: userId,
          notes: 'Order created from estimate'
        },
        connection
      );

      // 12. Create order folder on SMB share
      console.time('[Order Conversion] Create order folder');
      try {
        const folderCreated = orderFolderService.createOrderFolder(folderName);

        await orderFolderService.updateFolderTracking(
          orderId,
          folderName,
          folderCreated,
          folderCreated ? 'active' : 'none',
          connection
        );

        console.log(`✅ Order folder ${folderCreated ? 'created' : 'tracking added'}: ${folderName}`);
      } catch (folderError) {
        // Non-blocking: if folder creation fails, continue with order creation
        console.error('⚠️  Folder creation failed (continuing with order):', folderError);

        await orderFolderService.updateFolderTracking(
          orderId,
          folderName,
          false,
          'none',
          connection
        );
      }
      console.timeEnd('[Order Conversion] Create order folder');

      console.time('[Order Conversion] Commit transaction');
      await connection.commit();
      console.timeEnd('[Order Conversion] Commit transaction');
      console.timeEnd('[Order Conversion] Total time');

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
    console.time('[Order Parts] Loop through items');

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

    // Track previously processed items for cross-item logic (e.g., Extra Wire + LED consolidation)
    const processedItems: Array<{
      specsDisplayName: string;
      calculationDisplay: string;
      specifications: any;
      partId?: number;  // Track part_id for database updates
    }> = [];

    // Track parts that were mutated and need database updates
    const partsToUpdate: Map<number, any> = new Map();

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
          connection: connection,
          previousItems: processedItems
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

      // Check if auto-fill mutated any previous items (e.g., Extra Wire removing LED's Wire Length)
      // This happens when Extra Wire with "pcs" consolidates wire length with LED
      // Instead of updating immediately, collect mutations and apply at the end to avoid transaction locks
      if (specsDisplayName === 'Extra Wire' && /\bpcs\b/i.test(item.calculationDisplay || '')) {
        // Look for LED in processedItems that may have been mutated
        for (const prevItem of processedItems) {
          if (prevItem.specsDisplayName === 'LEDs' && prevItem.partId) {
            // Queue this LED for database update
            console.log(`[Order Conversion] Extra Wire mutated LED (partId: ${prevItem.partId}), queuing for update`);
            partsToUpdate.set(prevItem.partId, prevItem.specifications);
          }
        }
      }

      // Add specs_qty to specifications (manufacturing quantity, separate from invoice quantity)
      // Default to 0 for non-product rows (null quantity means it's a note/header row)
      finalSpecifications.specs_qty = item.quantity || 0;

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

      // Add this item to processedItems for subsequent items to reference
      // IMPORTANT: Must be AFTER creating the part so we have the partId
      processedItems.push({
        specsDisplayName: specsDisplayName || '',
        calculationDisplay: item.calculationDisplay || '',
        specifications: finalSpecifications,  // Use the auto-filled specifications
        partId: partId  // Track for potential database updates
      });
      console.log(`[Order Conversion] Added item to processedItems: ${specsDisplayName} (partId: ${partId}, total: ${processedItems.length})`);

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

    // Apply all collected mutations (e.g., LED parts updated by Extra Wire) after loop completes
    // This avoids transaction lock conflicts by doing updates after main data creation
    if (partsToUpdate.size > 0) {
      console.log(`[Order Conversion] Applying ${partsToUpdate.size} queued part updates...`);
      for (const [partId, specifications] of partsToUpdate) {
        try {
          await connection.execute(
            'UPDATE order_parts SET specifications = ? WHERE part_id = ?',
            [JSON.stringify(specifications), partId]
          );
          console.log(`[Order Conversion] ✓ Updated part ${partId} with mutated specifications`);
        } catch (updateError) {
          console.error(`[Order Conversion] ✗ Failed to update part ${partId}:`, updateError);
        }
      }
    }

    console.timeEnd('[Order Parts] Loop through items');
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
