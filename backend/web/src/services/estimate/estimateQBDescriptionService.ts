/**
 * Estimate QB Description Service
 * Handles QuickBooks item description generation for estimate line items
 *
 * Extracted from estimateWorkflowService.ts during Phase 4.d refactoring
 * Responsibilities:
 * - Generate QB descriptions using custom rules with fallback
 * - Apply product-specific description rules
 * - Determine if items are description-only (no quantity/price)
 * - QB item mapping lookups
 */

import { quickbooksRepository } from '../../repositories/quickbooksRepository';
import { estimateLineDescriptionRepository } from '../../repositories/estimateLineDescriptionRepository';
import { EstimateLineItem, EstimatePreviewData } from '../../types/orders';

/**
 * Product type IDs for structural/special rows
 */
export const PRODUCT_TYPES = {
  EMPTY_ROW: 27,      // Spacer/note row
  SUBTOTAL: 21,       // Subtotal calculation
  DIVIDER: 25,        // Visual divider
  MULTIPLIER: 23,     // Multiplier (already applied to other items)
  CUSTOM: 9           // Custom line item
} as const;

export class EstimateQBDescriptionService {
  /**
   * Auto-fill QB descriptions when preparing estimate
   * Uses custom rules with fallback to qb_item_mappings lookup
   */
  async autoFillQBDescriptions(
    estimateId: number,
    estimatePreviewData: EstimatePreviewData,
    connection: any,
    indexOffset: number = 0  // Offset for line indices (e.g., 1 if header row was inserted)
  ): Promise<void> {
    try {
      console.log(`[Auto-fill QB Descriptions] Starting for estimate ${estimateId} (offset: ${indexOffset})...`);

      // 0. Clear any existing QB descriptions (start fresh each time)
      await connection.execute(
        `DELETE FROM estimate_line_descriptions WHERE estimate_id = ?`,
        [estimateId]
      );
      console.log(`[Auto-fill QB Descriptions] Cleared existing descriptions`);

      // 1. Fetch QB item mappings in batch (for fallback)
      const productTypes = estimatePreviewData.items
        .filter(item => !item.isDescriptionOnly)
        .map(item => item.itemName);

      const qbMap = await quickbooksRepository.getBatchQBItemMappings(
        productTypes,
        connection
      );

      console.log(`[Auto-fill QB Descriptions] Fetched ${qbMap.size} QB mappings for fallback`);

      // 2. Build descriptions using custom rules with fallback
      // Apply indexOffset to account for header row insertion
      console.log(`[Auto-fill QB Descriptions] Processing ${estimatePreviewData.items.length} items from frontend`);
      const descriptions = estimatePreviewData.items.map((item, index) => {
        console.log(`[Auto-fill QB Descriptions] Item ${index}: productTypeId=${item.productTypeId}, name="${item.itemName}", calcDisplay="${item.calculationDisplay?.substring(0, 30)}"`);
        const qbDescription = this.generateQBDescription(item, qbMap);

        return {
          lineIndex: index + indexOffset,  // Apply offset
          qbDescription,
          isAutoFilled: true
        };
      });

      // 3. Batch save non-empty descriptions
      const nonEmptyDescriptions = descriptions.filter(d => d.qbDescription.length > 0);

      if (nonEmptyDescriptions.length > 0) {
        await estimateLineDescriptionRepository.batchUpsertDescriptions(
          estimateId,
          nonEmptyDescriptions,
          connection
        );
        console.log(`[Auto-fill QB Descriptions] ✓ Saved ${nonEmptyDescriptions.length} descriptions`);
      } else {
        console.log(`[Auto-fill QB Descriptions] ⚠ No descriptions to save (all empty)`);
      }

    } catch (error) {
      console.error('[Auto-fill QB Descriptions] Error:', error);
      // Don't fail the entire prepare operation if QB description auto-fill fails
      // Log and continue - user can manually fill descriptions
    }
  }

  /**
   * Generate QB description using custom rules with fallback
   * Priority: 1) Custom rules (in applyCustomRule), 2) qb_item_mappings lookup, 3) empty string
   *
   * Custom rules include:
   * - Rule 1: Empty Row (Product Type 27) - uses description or calculationDisplay
   * - Rule 2: Description-only items - uses calculationDisplay
   * - Future product-specific rules...
   */
  generateQBDescription(
    item: EstimateLineItem,
    qbMap: Map<string, { name: string; description: string | null; qb_item_id: string }>
  ): string {
    const { itemName } = item;

    // Step 1: Try custom rules (includes Empty Row and description-only checks)
    const customDescription = this.applyCustomRule(item);
    if (customDescription !== null) {
      return customDescription;
    }

    // Step 2: Fallback to qb_item_mappings lookup
    const qbItemData = qbMap.get(itemName.toLowerCase());
    if (qbItemData?.description) {
      return qbItemData.description;
    }

    // Step 3: Last resort - empty (user can manually fill)
    return '';
  }

  /**
   * Apply custom rule for QB description generation
   * Returns description string if rule matches, null otherwise (triggers fallback)
   *
   * Available data from item:
   * - productTypeId: number (1=Channel Letters, 5=Push Thru, etc.)
   * - productTypeName: string ("Channel Letters", "Vinyl", etc.)
   * - itemName: string ("3\" Channel Letters", "LEDs", etc.)
   * - calculationDisplay: string ("32\" @ $2.50/inch - [8 pcs]")
   * - calculationComponents: array of { name, price, type, calculationDisplay }
   * - quantity: number
   * - unitPrice: number
   * - extendedPrice: number
   * - isDescriptionOnly: boolean
   */
  applyCustomRule(item: EstimateLineItem): string | null {
    const { productTypeId, description, calculationDisplay, isDescriptionOnly } = item;

    // =====================================================
    // CUSTOM RULES - Priority order (first match wins)
    // Return string to use as description, null to fallback
    // =====================================================

    // Rule 1: Empty Row (Product Type 27)
    // Empty Rows are structural spacing/formatting items that use field1 text
    // Priority: description (field1) > calculationDisplay > empty string
    if (productTypeId === PRODUCT_TYPES.EMPTY_ROW) {
      console.log(`[QB Desc Rule 1] Empty Row - description: "${description}", calculationDisplay: "${calculationDisplay}"`);
      return description || calculationDisplay || '';
    }

    // Rule 2: Description-only items
    // Items marked as description-only (Subtotal, Divider, Custom w/o price, etc.)
    // Always use calculationDisplay for these structural items
    if (isDescriptionOnly) {
      console.log(`[QB Desc Rule 2] Description-only item - using calculationDisplay: "${calculationDisplay}"`);
      return calculationDisplay || '';
    }

    // Future custom rules go here...
    // Example rule (for reference):
    // if (productTypeId === 1) { // Channel Letters
    //   // Parse calculationDisplay for dimensions
    //   // return `Channel Letters: ${extracted_dimensions}`;
    // }

    // =====================================================
    // END CUSTOM RULES
    // =====================================================

    // No custom rule matched - return null to trigger fallback
    return null;
  }

  /**
   * Determine if an item should be description-only in QuickBooks
   * Description-only items have no quantity/price, just text
   */
  isDescriptionOnlyItem(item: EstimateLineItem): boolean {
    const { productTypeId, unitPrice, isDescriptionOnly } = item;

    // Empty Row (27) - always description only
    if (productTypeId === PRODUCT_TYPES.EMPTY_ROW) return true;

    // Subtotal (21) - always description only
    if (productTypeId === PRODUCT_TYPES.SUBTOTAL) return true;

    // Divider (25) - always description only
    if (productTypeId === PRODUCT_TYPES.DIVIDER) return true;

    // Multiplier (23) - always description only (already applied to other items)
    if (productTypeId === PRODUCT_TYPES.MULTIPLIER) return true;

    // Custom (9) without price - description only
    if (productTypeId === PRODUCT_TYPES.CUSTOM && (!unitPrice || unitPrice === 0)) return true;

    // Respect the flag if explicitly set
    if (isDescriptionOnly) return true;

    return false;
  }

  /**
   * Get QB item mappings for a list of product names
   * Used for batch lookups during preparation
   */
  async getQBItemMappings(
    itemNames: string[],
    connection?: any
  ): Promise<Map<string, { name: string; description: string | null; qb_item_id: string }>> {
    return quickbooksRepository.getBatchQBItemMappings(itemNames, connection);
  }
}

export const estimateQBDescriptionService = new EstimateQBDescriptionService();
