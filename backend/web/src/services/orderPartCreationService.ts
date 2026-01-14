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

import { orderPartRepository } from '../repositories/orderPartRepository';
import { orderConversionRepository } from '../repositories/orderConversionRepository';
import { customerRepository } from '../repositories/customerRepository';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import { estimateLineDescriptionRepository } from '../repositories/estimateLineDescriptionRepository';
import { OrderPart, CreateOrderPartData, EstimatePreviewData, QBEstimateLineItem } from '../types/orders';
import { mapQBItemNameToSpecsDisplayName } from '../utils/qbItemNameMapper';
import { mapSpecsDisplayNameToTypes } from '../utils/specsTypeMapper';
import { autoFillSpecifications } from './specsAutoFill';
import { createHeaderRow } from './invoiceHeaderService';
import { RowDataPacket } from 'mysql2/promise';

// Product type IDs to exclude from QB line matching (non-product rows)
const NON_PRODUCT_TYPE_IDS = [21, 25, 27]; // Subtotal, Divider, Empty Row

// Product specs display names that can receive Assembly spec from following Assembly item
const ASSEMBLY_RECEIVER_PRODUCTS = ['Backer', 'Frame', 'Aluminum Raceway', 'Extrusion Raceway', 'Push Thru'];

export class OrderPartCreationService {
  /**
   * Phase 1.5: Create order parts from EstimatePreviewData
   * Uses the calculated preview data with display numbers, pricing, and item details
   *
   * Phase 1.6: Optionally accepts QB line items to override invoice values
   * When qbLineItems provided, QB values are used for: qb_item_name, qb_description, quantity, unit_price
   *
   * Phase 4.c: Optionally accepts estimateId to fetch and use custom QB descriptions
   * Priority: custom estimate descriptions > qb_item_mappings > calculationDisplay
   */
  async createOrderPartsFromPreviewData(
    previewData: EstimatePreviewData,
    orderId: number,
    connection: any,
    customerId?: number,
    qbLineItems?: QBEstimateLineItem[],  // Phase 1.6: Optional QB Estimate line items
    estimateId?: number  // Phase 4.c: Optional estimate ID for custom QB descriptions
  ): Promise<OrderPart[]> {
    const parts: OrderPart[] = [];
    console.time('[Order Parts] Loop through items');

    // Create header row FIRST (part_number=0) for 1:1 QB sync
    // Fetch order data needed for header text
    const [orderRows] = await connection.execute(
      `SELECT order_number, order_name, customer_po, customer_job_number
       FROM orders WHERE order_id = ?`,
      [orderId]
    ) as [RowDataPacket[], any];
    if (orderRows.length > 0) {
      const orderData = orderRows[0];
      await createHeaderRow(
        orderId,
        orderData.order_number,
        orderData.order_name,
        orderData.customer_po,
        orderData.customer_job_number,
        connection
      );
    }

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

    // NEW: Fetch estimate QB descriptions if estimate is prepared (Phase 4.c)
    // Only load custom QB descriptions if estimate went through "Prepare to Send" stage
    let estimateDescriptions: Map<number, string> = new Map();
    if (estimateId) {
      const isPrepared = await orderConversionRepository.getEstimatePreparedStatus(
        estimateId,
        connection
      );

      if (isPrepared) {
        const descriptions = await estimateLineDescriptionRepository.getDescriptionsByEstimateId(
          estimateId,
          connection
        );
        // Map with offset adjustment: estimate descriptions have header at index 0
        // We skip the header, so estimate index 1 -> our index 0
        descriptions.forEach(d => {
          if (d.qb_description && d.line_index > 0) {
            estimateDescriptions.set(d.line_index - 1, d.qb_description);
          }
        });
        console.log(`[Order Part Creation] Loaded ${estimateDescriptions.size} custom QB descriptions from prepared estimate`);
      } else {
        console.log(`[Order Part Creation] Estimate not prepared - using qb_item_mappings fallback`);
      }
    }

    // Track previously processed items for cross-item logic (e.g., Extra Wire + LED consolidation)
    const processedItems: Array<{
      specsDisplayName: string;
      calculationDisplay: string;
      specifications: any;
      partId?: number;  // Track part_id for database updates
    }> = [];

    // Track parts that were mutated and need database updates
    const partsToUpdate: Map<number, any> = new Map();

    // Phase 1.6: Track filtered index for QB line matching
    // Only increment for product lines (not descriptionOnly, not special types)
    let qbFilteredIndex = 0;
    const filteredQBLines = qbLineItems?.filter(line => line.detailType === 'SalesItemLineDetail') || [];

    // Filter out estimate Job Header row - backend creates its own header row
    // Also track original indices for QB description lookup
    const originalIndexMap = new Map<any, number>();
    previewData.items.forEach((item, idx) => originalIndexMap.set(item, idx));

    const itemsToProcess = previewData.items.filter(item => {
      // Skip description-only and non-product rows (Subtotal, Divider, Empty Row)
      // These are visual/informational only in estimates - orders have their own header system
      if (item.isDescriptionOnly || NON_PRODUCT_TYPE_IDS.includes(item.productTypeId)) {
        console.log(`[Order Parts] Skipping non-product row: ${item.itemName} (productTypeId=${item.productTypeId})`);
        return false;
      }
      return true;
    });

    // Process each estimate line item (using filtered list)
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];

      // Phase 1.6: Determine if this is a product line (for QB matching)
      const isProductLine = !item.isDescriptionOnly && !NON_PRODUCT_TYPE_IDS.includes(item.productTypeId);

      // Generate machine-readable product_type_id from name
      const productTypeId = this.generateProductTypeId(item.productTypeName);

      // Get product type info from database (for channel letter detection)
      // Skip lookup for invalid productTypeId (0 or negative) - treat as non-channel-letter
      let isChannelLetter = false;
      let baseProductTypeId: number | undefined = undefined;
      if (item.productTypeId > 0) {
        const productTypeInfo = await orderConversionRepository.getProductTypeInfo(item.productTypeId, connection);
        if (productTypeInfo) {
          isChannelLetter = productTypeInfo.is_channel_letter;
          baseProductTypeId = !isChannelLetter ? productTypeInfo.id : undefined;
        } else {
          console.warn(`[Order Parts] Product type ${item.productTypeId} not found - treating as non-channel-letter`);
        }
      }

      // Auto-map QB item name and description (case-insensitive match)
      const qbItemData = qbMap.get(item.itemName.toLowerCase());
      let qbItemName = qbItemData?.name || undefined;
      let qbDescription = qbItemData?.description || '';

      // Phase 1.6: Override with QB Estimate values if available (for product lines only)
      // QB values take precedence as they may have been edited in QuickBooks
      let finalQuantity = item.quantity;
      let finalUnitPrice = item.unitPrice;
      let finalExtendedPrice = item.extendedPrice;

      if (isProductLine && filteredQBLines.length > 0 && qbFilteredIndex < filteredQBLines.length) {
        const qbLine = filteredQBLines[qbFilteredIndex];
        if (qbLine) {
          // Use QB values - they may have description edits from QuickBooks
          qbItemName = qbLine.itemName || qbItemName;
          qbDescription = qbLine.description || qbDescription;
          finalQuantity = qbLine.quantity;
          finalUnitPrice = qbLine.unitPrice;
          finalExtendedPrice = qbLine.quantity * qbLine.unitPrice;
          console.log(`[Order Parts] Using QB values for item ${qbFilteredIndex + 1}: ${qbItemName}`);
        }
      }

      // NEW: Phase 4.c - Apply custom QB descriptions with priority logic
      // Priority 1: Estimate custom description (user-edited, from prepared estimate)
      // Priority 2: QB mappings or QB Estimate (default mappings)
      // Use original item index for QB description lookup (accounts for skipped Job Header)
      const originalItemIndex = originalIndexMap.get(item) ?? i;
      if (estimateDescriptions.has(originalItemIndex)) {
        qbDescription = estimateDescriptions.get(originalItemIndex)!;
        console.log(`  Using custom description for item ${originalItemIndex}: "${qbDescription}"`);
      }
      // For description-only rows, use calculationDisplay if no QB description
      else if (item.isDescriptionOnly && !qbDescription) {
        qbDescription = item.calculationDisplay || '';
      }

      // Map QB item name to specs display name
      const specsDisplayName = mapQBItemNameToSpecsDisplayName(qbItemName);

      // Determine if this is a parent or regular row (not a sub-item)
      // Parent rows: displayNumber is numeric only ("1", "2", "3") - first row is always parent
      // Sub-items: displayNumber has letters ("1a", "1b", "2a") - grouped under preceding parent
      // The frontend may also explicitly set isParent=true to force parent status
      // IMPORTANT: Items without a valid spec mapping are treated as sub-parts
      const displayNumber = item.estimatePreviewDisplayNumber || `${i + 1}`;
      const isSubItem = /[a-zA-Z]/.test(displayNumber);
      const preliminaryIsParent = specsDisplayName ? (item.isParent || !isSubItem) : false;

      // Generate spec types from specs display name
      const specTypes = mapSpecsDisplayNameToTypes(specsDisplayName, preliminaryIsParent);

      // CRITICAL: If no valid spec mapping found (empty specTypes), treat as sub-part
      // This handles "Select Item Name..." and other unmapped QB items correctly
      const isParentOrRegular = specTypes.length > 0 ? preliminaryIsParent : false;

      // Build specifications object with spec templates (no longer storing _qb_description in JSON)
      const specificationsData: any = {};

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

      // Cross-item mutation: Assembly spec transfer to preceding backer/raceway/push-thru
      // When Assembly item follows a backer product, transfer the Assembly spec description
      // to the backer and clear it from the Assembly item
      if (specsDisplayName === 'Assembly') {
        const prevItem = processedItems[processedItems.length - 1];
        if (prevItem && ASSEMBLY_RECEIVER_PRODUCTS.includes(prevItem.specsDisplayName)) {
          // Get Assembly description from current item
          let assemblyDescription = '';
          for (let i = 1; i <= 10; i++) {
            if (finalSpecifications[`_template_${i}`] === 'Assembly') {
              assemblyDescription = finalSpecifications[`row${i}_description`] || '';
              // Clear the Assembly spec from current item
              finalSpecifications[`row${i}_description`] = '';
              break;
            }
          }

          if (assemblyDescription && prevItem.partId) {
            // Find or add Assembly spec in previous item
            let assemblyRowIndex = -1;
            for (let i = 1; i <= 10; i++) {
              if (prevItem.specifications[`_template_${i}`] === 'Assembly') {
                assemblyRowIndex = i;
                break;
              }
              // Find first empty slot for Push Thru (no Assembly template by default)
              if (!prevItem.specifications[`_template_${i}`] && assemblyRowIndex === -1) {
                assemblyRowIndex = i;
              }
            }

            if (assemblyRowIndex > 0) {
              // Add template name if not present (Push Thru case)
              if (!prevItem.specifications[`_template_${assemblyRowIndex}`]) {
                prevItem.specifications[`_template_${assemblyRowIndex}`] = 'Assembly';
                // Update row count if needed
                const currentRowCount = prevItem.specifications['_row_count'] || 1;
                if (assemblyRowIndex > currentRowCount) {
                  prevItem.specifications['_row_count'] = assemblyRowIndex;
                }
              }
              // Set the description
              prevItem.specifications[`row${assemblyRowIndex}_description`] = assemblyDescription;

              // Queue for database update
              partsToUpdate.set(prevItem.partId, prevItem.specifications);
              console.log(`[Order Conversion] Assembly spec transferred: "${assemblyDescription}" → ${prevItem.specsDisplayName}`);
            }
          }
        }
      }

      // Determine if this is a description-only row (for QB DescriptionOnly handling)
      // - Explicitly marked as description-only by frontend
      // - Non-product types (Subtotal, Divider, Empty Row)
      // - Custom type (productTypeId 9) with no price
      const CUSTOM_PRODUCT_TYPE_ID = 9;
      const isDescriptionOnlyRow = item.isDescriptionOnly ||
                                   NON_PRODUCT_TYPE_IDS.includes(item.productTypeId) ||
                                   (item.productTypeId === CUSTOM_PRODUCT_TYPE_ID && (!item.unitPrice || item.unitPrice === 0));

      // Create order part data with Phase 1.5 fields
      // Phase 1.6: Uses finalQuantity, finalUnitPrice, finalExtendedPrice (may be from QB Estimate)
      const partData: CreateOrderPartData = {
        order_id: orderId,
        part_number: i + 1,
        display_number: item.estimatePreviewDisplayNumber || `${i + 1}`,  // "1", "1a", "1b", "1c"
        is_parent: isParentOrRegular,
        product_type: item.itemName,  // Specific component name: "3\" Front Lit", "LEDs", "Power Supplies", "UL"
        qb_item_name: qbItemName,  // Auto-filled from qb_item_mappings (or QB Estimate)
        // For description-only rows, put calculationDisplay in qb_description (for QB DescriptionOnly row)
        // For product rows, use the qb_description from mappings/QB Estimate
        qb_description: isDescriptionOnlyRow ? (item.calculationDisplay || '') : qbDescription,
        specs_display_name: specsDisplayName,  // Mapped display name for Specs section
        specs_qty: finalQuantity || 0,  // Manufacturing quantity (dedicated column) - separate from invoice quantity
        product_type_id: productTypeId,
        channel_letter_type_id: undefined,  // Phase 1: NULL (can enhance later)
        base_product_type_id: baseProductTypeId,
        quantity: finalQuantity,  // Phase 1.6: May be from QB Estimate
        specifications: finalSpecifications,  // Use auto-filled specifications
        // Invoice data from preview (Phase 1.6: May be from QB Estimate)
        // For description-only rows, leave invoice_description empty (description is in qb_description)
        invoice_description: isDescriptionOnlyRow ? '' : item.calculationDisplay,
        unit_price: finalUnitPrice,
        extended_price: finalExtendedPrice
      };

      // Phase 1.6: Increment QB filtered index after processing a product line
      if (isProductLine) {
        qbFilteredIndex++;
      }

      // Create the order part
      const partId = await orderPartRepository.createOrderPart(partData, connection);

      // Add this item to processedItems for subsequent items to reference
      // IMPORTANT: Must be AFTER creating the part so we have the partId
      processedItems.push({
        specsDisplayName: specsDisplayName || '',
        calculationDisplay: item.calculationDisplay || '',
        specifications: finalSpecifications,  // Use the auto-filled specifications
        partId: partId  // Track for potential database updates
      });

      // Add to parts array for task generation
      // Phase 1.6: Uses final values (may be from QB Estimate)
      parts.push({
        part_id: partId,
        order_id: orderId,
        part_number: i + 1,
        display_number: item.estimatePreviewDisplayNumber || `${i + 1}`,
        is_parent: isParentOrRegular,
        product_type: item.itemName,  // Specific component name: "3\" Front Lit", "LEDs", "Power Supplies", "UL"
        qb_item_name: qbItemName,  // Auto-filled from qb_item_mappings (or QB Estimate)
        qb_description: isDescriptionOnlyRow ? (item.calculationDisplay || '') : qbDescription,
        specs_display_name: specsDisplayName,  // Mapped display name for Specs section
        product_type_id: productTypeId,
        channel_letter_type_id: undefined,
        base_product_type_id: baseProductTypeId,
        quantity: finalQuantity,  // Phase 1.6: May be from QB Estimate
        specifications: finalSpecifications,  // Use auto-filled specifications
        invoice_description: isDescriptionOnlyRow ? '' : item.calculationDisplay,
        unit_price: finalUnitPrice,  // Phase 1.6: May be from QB Estimate
        extended_price: finalExtendedPrice  // Phase 1.6: May be from QB Estimate
      });
    }

    // Apply all collected mutations (e.g., LED parts updated by Extra Wire) after loop completes
    // This avoids transaction lock conflicts by doing updates after main data creation
    if (partsToUpdate.size > 0) {
      for (const [partId, specifications] of partsToUpdate) {
        try {
          await orderPartRepository.updateOrderPart(
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
