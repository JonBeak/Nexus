/**
 * QB Estimate Comparison Service
 * Phase 1.6: Compares QB Estimate structure with app estimate during order conversion
 *
 * Purpose:
 * - Fetch QB Estimate line items from QuickBooks API
 * - Compare structure with app's estimate preview data
 * - Return QB values if structure matches (for capturing description edits made in QB)
 * - Gracefully fallback to app values on any error
 *
 * @module services/qbEstimateComparisonService
 * @created 2025-12-09
 */

import { makeQBApiCall, APIError } from '../utils/quickbooks/apiClient';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import { QBEstimateLineItem, QBComparisonResult, EstimatePreviewData, EstimateLineItem } from '../types/orders';

// Product type IDs to exclude from comparison (non-product rows)
const NON_PRODUCT_TYPE_IDS = [
  21, // Subtotal
  25, // Divider
  27, // Empty Row
];

/**
 * QB API Response Line Item structure
 */
interface QBAPILineItem {
  Id: string;
  LineNum: number;
  Description?: string;
  Amount: number;
  DetailType: 'SalesItemLineDetail' | 'DescriptionOnly' | 'SubTotalLineDetail';
  SalesItemLineDetail?: {
    ItemRef: {
      value: string;
      name: string;
    };
    UnitPrice: number;
    Qty: number;
    TaxCodeRef?: {
      value: string;
    };
  };
}

export class QBEstimateComparisonService {

  /**
   * Main entry point: Fetch QB Estimate and compare with app estimate
   * Returns comparison result indicating whether to use QB values
   */
  async fetchAndCompareQBEstimate(
    qbEstimateId: string,
    estimatePreviewData: EstimatePreviewData
  ): Promise<QBComparisonResult> {
    const warnings: string[] = [];

    try {
      // 1. Get realm ID for API call
      const realmId = await quickbooksRepository.getDefaultRealmId();
      if (!realmId) {
        return {
          useQBValues: false,
          reason: 'Not connected to QuickBooks (no realm ID)',
          warnings: ['QB connection not available']
        };
      }

      // 2. Fetch QB Estimate from API
      console.log(`[QB Comparison] Fetching QB Estimate ${qbEstimateId}...`);
      const qbEstimate = await this.fetchQBEstimate(qbEstimateId, realmId);

      if (!qbEstimate || !qbEstimate.Line) {
        return {
          useQBValues: false,
          reason: 'QB Estimate not found or has no line items',
          warnings: ['QB Estimate fetch returned empty data']
        };
      }

      // 3. Parse QB line items
      const qbLineItems = this.parseQBLineItems(qbEstimate.Line);
      console.log(`[QB Comparison] Parsed ${qbLineItems.length} QB line items`);

      // 4. Compare structure
      const comparison = this.compareStructure(
        estimatePreviewData.items,
        qbLineItems
      );

      if (!comparison.matches) {
        console.log(`[QB Comparison] Structure mismatch: ${comparison.reason}`);
        return {
          useQBValues: false,
          reason: comparison.reason,
          warnings
        };
      }

      // 5. Structure matches - return QB values
      console.log('[QB Comparison] Structure verified - using QB values');
      return {
        useQBValues: true,
        reason: 'Structure verified',
        qbLineItems,
        warnings
      };

    } catch (error) {
      // Any error = fallback to app values
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[QB Comparison] Error: ${errorMessage} - falling back to app values`);

      return {
        useQBValues: false,
        reason: `QB API error: ${errorMessage}`,
        warnings: [errorMessage]
      };
    }
  }

  /**
   * Fetch QB Estimate from QuickBooks API
   */
  private async fetchQBEstimate(qbEstimateId: string, realmId: string): Promise<any> {
    try {
      const response = await makeQBApiCall('GET', `estimate/${qbEstimateId}`, realmId, {});
      return response.Estimate;
    } catch (error) {
      if (error instanceof APIError) {
        throw new Error(`QB API ${error.statusCode || 'error'}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Parse QB API line items into our format
   */
  private parseQBLineItems(lines: QBAPILineItem[]): QBEstimateLineItem[] {
    return lines.map(line => ({
      lineId: line.Id,
      itemName: line.SalesItemLineDetail?.ItemRef?.name || '',
      description: line.Description || '',
      quantity: line.SalesItemLineDetail?.Qty || 0,
      unitPrice: line.SalesItemLineDetail?.UnitPrice || 0,
      detailType: line.DetailType === 'SalesItemLineDetail' ? 'SalesItemLineDetail' : 'DescriptionOnly'
    }));
  }

  /**
   * Filter app estimate items - remove non-product rows for comparison
   */
  filterProductLines(items: EstimateLineItem[]): EstimateLineItem[] {
    return items.filter(item => {
      // Exclude description-only items
      if (item.isDescriptionOnly) return false;

      // Exclude special product types (Subtotal, Divider, Empty Row)
      if (NON_PRODUCT_TYPE_IDS.includes(item.productTypeId)) return false;

      return true;
    });
  }

  /**
   * Filter QB line items - keep only SalesItemLineDetail for comparison
   */
  private filterQBProductLines(items: QBEstimateLineItem[]): QBEstimateLineItem[] {
    return items.filter(item => item.detailType === 'SalesItemLineDetail');
  }

  /**
   * Compare app estimate structure with QB estimate structure
   * Checks: Same count, same names, same order, same qty, same prices
   */
  private compareStructure(
    appItems: EstimateLineItem[],
    qbItems: QBEstimateLineItem[]
  ): { matches: boolean; reason: string } {

    // 1. Filter to product lines only
    const filteredApp = this.filterProductLines(appItems);
    const filteredQB = this.filterQBProductLines(qbItems);

    console.log(`[QB Comparison] Comparing ${filteredApp.length} app items with ${filteredQB.length} QB items`);

    // 2. Check count match
    if (filteredApp.length !== filteredQB.length) {
      return {
        matches: false,
        reason: `Line count mismatch: app=${filteredApp.length}, QB=${filteredQB.length}`
      };
    }

    // 3. Compare each line by position (name + qty + price)
    for (let i = 0; i < filteredApp.length; i++) {
      const appItem = filteredApp[i];
      const qbItem = filteredQB[i];

      // Compare name (case-insensitive)
      const appName = (appItem.itemName || '').toLowerCase().trim();
      const qbName = (qbItem.itemName || '').toLowerCase().trim();

      if (appName !== qbName) {
        return {
          matches: false,
          reason: `Name mismatch at position ${i + 1}: app="${appItem.itemName}", QB="${qbItem.itemName}"`
        };
      }

      // Compare quantity
      if (appItem.quantity !== qbItem.quantity) {
        return {
          matches: false,
          reason: `Quantity mismatch at position ${i + 1}: app=${appItem.quantity}, QB=${qbItem.quantity}`
        };
      }

      // Compare unit price (with tolerance for floating point)
      const priceDiff = Math.abs((appItem.unitPrice || 0) - (qbItem.unitPrice || 0));
      if (priceDiff > 0.01) {
        return {
          matches: false,
          reason: `Price mismatch at position ${i + 1}: app=${appItem.unitPrice}, QB=${qbItem.unitPrice}`
        };
      }
    }

    return { matches: true, reason: 'Structure verified' };
  }

  /**
   * Get QB line item by position (matching filtered app item index)
   * Used by orderPartCreationService to get QB values for each product item
   */
  getQBLineByFilteredIndex(
    qbLineItems: QBEstimateLineItem[],
    filteredIndex: number
  ): QBEstimateLineItem | undefined {
    const filteredQB = this.filterQBProductLines(qbLineItems);
    return filteredQB[filteredIndex];
  }
}

export const qbEstimateComparisonService = new QBEstimateComparisonService();
