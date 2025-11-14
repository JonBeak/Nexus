// File Clean up Finished: Nov 14, 2025
// Changes:
//   - CRITICAL: Fixed architecture violations - service layer had 2 direct database queries
//   - Created CustomerRepository with getCustomerPreferences() method
//   - Enhanced QuickBooksRepository with getBatchQBItemMappings() for batch fetching
//   - Replaced connection.execute() at line 42 with customerRepository.getCustomerPreferences()
//   - Replaced connection.execute() at line 51 with quickbooksRepository.getBatchQBItemMappings()
//   - Removed type safety issues (replaced 'as any[]' with proper repository types)
//   - Added refactoring notes to orderConversionService.ts and customerService.ts
//   - Full 3-layer architecture compliance achieved
//
/**
 * Order Part Creation Service
 *
 * Handles the complex logic of creating order parts from estimate preview data.
 * Extracted from orderConversionService to maintain single responsibility and file size limits.
 *
 * Responsibilities:
 * - Fetch customer preferences and QB mappings (via repositories)
 * - Process estimate line items into order parts
 * - Auto-fill specifications using smart parsing
 * - Handle cross-item mutations (e.g., Extra Wire + LED consolidation)
 * - Apply specification updates after part creation
 *
 * @module services/orderPartCreationService
 * @created 2025-11-14
 */

import { orderRepository } from '../repositories/orderRepository';
import { customerRepository } from '../repositories/customerRepository';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import { OrderPart, CreateOrderPartData, EstimatePreviewData } from '../types/orders';
import { mapQBItemNameToSpecsDisplayName } from '../utils/qbItemNameMapper';
import { mapSpecsDisplayNameToTypes } from '../utils/specsTypeMapper';
import { autoFillSpecifications } from './specsAutoFill';

export class OrderPartCreationService {
  /**
   * Phase 1.5: Create order parts from EstimatePreviewData
   * Uses the calculated preview data with display numbers, pricing, and item details
   */
  async createOrderPartsFromPreviewData(
    previewData: EstimatePreviewData,
    orderId: number,
    connection: any,
    customerId?: number
  ): Promise<OrderPart[]> {
    const parts: OrderPart[] = [];
    console.time('[Order Parts] Loop through items');

    // Fetch customer preferences for auto-fill (if customerId provided)
    // Using CustomerRepository instead of direct query (architecture fix - Nov 14, 2025)
    let customerPreferences: any = {};
    if (customerId) {
      customerPreferences = await customerRepository.getCustomerPreferences(customerId, connection);
    }

    // Fetch QB item mappings for all product types in batch (case-insensitive)
    // Using QuickBooksRepository.getBatchQBItemMappings() instead of direct query (architecture fix - Nov 14, 2025)
    const productTypes = previewData.items.map(item => item.itemName);
    const qbMap = await quickbooksRepository.getBatchQBItemMappings(productTypes, connection);

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

      // Map QB item name to specs display name
      const specsDisplayName = mapQBItemNameToSpecsDisplayName(qbItemName);

      // Determine if this is a parent or regular row (not a sub-item)
      // Sub-items have letters in display_number like "1a", "1b"
      const displayNumber = item.estimatePreviewDisplayNumber || `${i + 1}`;
      const isSubItem = /[a-zA-Z]/.test(displayNumber);
      const isParentOrRegular = item.isParent || !isSubItem;

      // Generate spec types from specs display name
      const specTypes = mapSpecsDisplayNameToTypes(specsDisplayName, isParentOrRegular);

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
      let finalSpecifications = specificationsData;
      try {
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

        finalSpecifications = autoFillResult.specifications;

        // Log warnings if any
        if (autoFillResult.warnings.length > 0) {
          console.warn('[Order Conversion] Auto-fill warnings:', autoFillResult.warnings);
        }
      } catch (error) {
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
      for (const [partId, specifications] of partsToUpdate) {
        try {
          await orderRepository.updateOrderPart(
            partId,
            { specifications },
            connection
          );
        } catch (updateError) {
          console.error(`[Order Conversion] Failed to update part ${partId}:`, updateError);
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
}

export const orderPartCreationService = new OrderPartCreationService();
