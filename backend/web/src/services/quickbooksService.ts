// Refactored: 2025-11-21
// Changes:
// - Extracted OAuth methods to /services/quickbooks/qbOAuthService.ts
// - Extracted entity resolution to /utils/quickbooks/entityResolver.ts (shared with qbEstimateService)
// - Extracted debug utilities to /utils/quickbooks/qbDebugUtils.ts
// - Added PRODUCT_TYPES constants for readable code
// - Reduced from 762 lines to ~420 lines (45% reduction)
/**
 * QuickBooks Service
 * Business Logic Layer for QuickBooks Integration (Job Estimation Module)
 *
 * Handles:
 * - Connection status and configuration
 * - Estimate creation with complex product type handling
 * - Line item construction with QB magic pattern avoidance
 */

import { quickbooksRepository } from '../repositories/quickbooksRepository';
import { quickbooksOAuthRepository } from '../repositories/quickbooksOAuthRepository';
import { validateConfig } from '../utils/quickbooks/oauthClient';
import {
  createEstimate,
  getCustomerIdByName,
  getItemIdByName,
  getEstimateWebUrl,
} from '../utils/quickbooks/apiClient';
import { qbOAuthService } from './quickbooks/qbOAuthService';
import { resolveCustomerId, resolveTaxCodeByCustomer } from '../utils/quickbooks/entityResolver';
import {
  fetchEstimateForDebug,
  fetchEstimateForAnalysis,
  testLogging,
  QBLineForDebug,
} from '../utils/quickbooks/qbDebugUtils';

// =============================================
// PRODUCT TYPE CONSTANTS
// =============================================

const PRODUCT_TYPES = {
  CUSTOM: 9,
  SUBTOTAL: 21,
  MULTIPLIER: 23,
  DIVIDER: 25,
  EMPTY_ROW: 27,
} as const;

// =============================================
// INTERFACES
// =============================================

/**
 * QuickBooks Line Item Interface
 */
interface QBLine {
  DetailType: string;
  Description?: string;
  SalesItemLineDetail?: {
    ItemRef: { value: string; name: string };
    Qty: number;
    UnitPrice: number;
    TaxCodeRef: { value: string; name: string };
  };
  DescriptionLineDetail?: {};
  Amount?: number;
  LineNum?: number;
}

/**
 * Estimate Preview Data Interface
 */
interface EstimatePreviewData {
  customerName: string;
  items: Array<{
    productTypeId: number;
    itemName: string;
    quantity?: number;
    unitPrice?: number;
    extendedPrice?: number;
    calculationDisplay?: string;
  }>;
  subtotal: number;
  taxAmount: number;
  total: number;
  taxRate: number;
}

// =============================================
// SERVICE CLASS
// =============================================

/**
 * QuickBooks Service Class
 * Orchestrates business logic, NO HTTP handling, NO direct database queries
 */
export class QuickBooksService {

  // =============================================
  // OAUTH FLOW (DELEGATED)
  // =============================================

  /**
   * Initiate OAuth flow
   * @see qbOAuthService.initiateOAuth
   */
  async initiateOAuth(): Promise<{ authUrl: string; state: string }> {
    return qbOAuthService.initiateOAuth();
  }

  /**
   * Process OAuth callback
   * @see qbOAuthService.processCallback
   */
  async processCallback(code: string, realmId: string, state: string): Promise<void> {
    return qbOAuthService.processCallback(code, realmId, state);
  }

  /**
   * Disconnect from QuickBooks
   * @see qbOAuthService.disconnect
   */
  async disconnect(realmId?: string): Promise<void> {
    return qbOAuthService.disconnect(realmId);
  }

  // =============================================
  // CONNECTION & DATA MANAGEMENT
  // =============================================

  /**
   * Check QuickBooks connection status
   * Returns connection info and token expiry
   */
  async checkConnectionStatus(realmId?: string | null): Promise<{
    connected: boolean;
    realmId?: string;
    environment?: string;
    tokenExpiresAt?: Date;
    message: string;
  }> {
    const targetRealmId = realmId ?? await quickbooksRepository.getDefaultRealmId();

    if (!targetRealmId) {
      return {
        connected: false,
        message: 'Not connected to QuickBooks',
      };
    }

    const tokenData = await quickbooksOAuthRepository.getActiveTokens(targetRealmId);

    if (!tokenData) {
      return {
        connected: false,
        realmId: targetRealmId,
        message: 'Token expired or invalid. Please reconnect.',
      };
    }

    return {
      connected: true,
      realmId: targetRealmId,
      environment: process.env.QB_ENVIRONMENT || 'sandbox',
      tokenExpiresAt: tokenData.access_token_expires_at,
      message: 'Connected to QuickBooks',
    };
  }

  /**
   * Get QuickBooks items for dropdown
   */
  async getQuickBooksItems(): Promise<Array<{
    id: number;
    name: string;
    description: string | null;
    qbItemId: string;
    qbItemType: string | null;
  }>> {
    const items = await quickbooksRepository.getAllQBItems();
    console.log(`Fetched ${items.length} QuickBooks items for dropdown`);
    return items;
  }

  /**
   * Check if credentials are configured
   */
  async checkConfigStatus(): Promise<{
    configured: boolean;
    errors: string[];
    environment: string;
  }> {
    const validation = await validateConfig();

    return {
      configured: validation.valid,
      errors: validation.errors,
      environment: process.env.QB_ENVIRONMENT || 'sandbox',
    };
  }

  // =============================================
  // ESTIMATE CREATION
  // =============================================

  /**
   * Create estimate in QuickBooks
   * Main orchestration method for estimate creation
   */
  async createEstimateInQuickBooks(
    estimateId: number,
    estimatePreviewData: EstimatePreviewData,
    userId: number,
    debugMode: boolean = false
  ): Promise<{
    qbEstimateId: string;
    qbDocNumber: string;
    qbEstimateUrl: string;
    linesCreated: number;
    debug?: any;
  }> {
    console.log('\nCREATE-ESTIMATE REQUEST:');
    console.log(`  estimateId: ${estimateId}`);
    console.log(`  debugMode: ${debugMode}`);
    console.log(`  items count: ${estimatePreviewData.items.length}`);

    // STEP 1: Validate estimate eligibility
    await this.validateEstimateEligibility(estimateId, estimatePreviewData);

    // Get realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      throw new Error('Not connected to QuickBooks. Please connect first.');
    }

    // Get estimate details
    const estimateDetails = await quickbooksRepository.getEstimateDetails(estimateId);
    if (!estimateDetails) {
      throw new Error('Estimate not found');
    }

    // STEP 2: Resolve customer ID (with caching)
    const qbCustomerId = await resolveCustomerId(
      estimateDetails.customer_id,
      estimatePreviewData.customerName,
      realmId
    );

    // STEP 3: Resolve tax code (province-based)
    const { taxCodeId: qbTaxCodeId, taxName } = await resolveTaxCodeByCustomer(
      estimateDetails.customer_id
    );

    // STEP 4: Build line items (complex product type handling)
    const lines = await this.buildLineItems(
      estimatePreviewData.items,
      qbTaxCodeId,
      taxName,
      realmId
    );

    if (lines.length === 0) {
      throw new Error('No valid line items found in estimate.');
    }

    // STEP 5: Create estimate in QuickBooks
    const qbPayload = {
      CustomerRef: { value: qbCustomerId },
      TxnDate: new Date().toISOString().split('T')[0],
      Line: lines,
    };

    console.log(`\nTAX CONFIGURATION:`);
    console.log(`  Tax Name: "${taxName}"`);
    console.log(`  QB Tax Code ID: ${qbTaxCodeId}`);
    console.log(`  Tax Rate: ${(estimatePreviewData.taxRate * 100).toFixed(2)}%\n`);

    console.log(`Creating estimate in QB with ${lines.length} line items...`);

    const result = await createEstimate(qbPayload, realmId);
    const qbEstimateUrl = getEstimateWebUrl(result.estimateId);

    console.log(`QB Estimate created: ID=${result.estimateId}, Doc#=${result.docNumber}`);

    // STEP 6: Finalize estimate (make immutable)
    await quickbooksRepository.finalizeEstimate(
      estimateId,
      result.estimateId,
      {
        subtotal: estimatePreviewData.subtotal,
        taxAmount: estimatePreviewData.taxAmount,
        total: estimatePreviewData.total,
      },
      userId
    );

    console.log(`Estimate ${estimateId} finalized and linked to QB estimate ${result.estimateId}`);

    // STEP 7: Debug mode (if enabled)
    if (debugMode) {
      const debugData = await fetchEstimateForDebug(result.estimateId, realmId, lines as QBLineForDebug[]);

      return {
        qbEstimateId: result.estimateId,
        qbDocNumber: result.docNumber,
        qbEstimateUrl,
        linesCreated: lines.length,
        debug: debugData,
      };
    }

    return {
      qbEstimateId: result.estimateId,
      qbDocNumber: result.docNumber,
      qbEstimateUrl,
      linesCreated: lines.length,
    };
  }

  /**
   * Validate estimate is eligible for QB creation
   */
  private async validateEstimateEligibility(
    estimateId: number,
    estimatePreviewData: EstimatePreviewData
  ): Promise<void> {
    const estimateDetails = await quickbooksRepository.getEstimateDetails(estimateId);

    if (!estimateDetails) {
      throw new Error('Estimate not found');
    }

    if (!estimateDetails.is_draft) {
      throw new Error('Only draft estimates can be sent to QuickBooks. This estimate is already finalized.');
    }

    if (estimateDetails.qb_estimate_id) {
      const qbEstimateUrl = getEstimateWebUrl(estimateDetails.qb_estimate_id);
      throw new Error(`Estimate already sent to QuickBooks. URL: ${qbEstimateUrl}`);
    }

    if (!estimatePreviewData.customerName || !estimatePreviewData.customerName.trim()) {
      throw new Error('Customer QuickBooks name is not configured. Please set the QuickBooks name in customer settings.');
    }
  }

  /**
   * Build QB line items from estimate items
   */
  private async buildLineItems(
    items: EstimatePreviewData['items'],
    qbTaxCodeId: string,
    taxName: string,
    realmId: string
  ): Promise<QBLine[]> {
    const lines: QBLine[] = [];
    const missingItems: string[] = [];
    let lineNum = 0;

    for (const item of items) {
      lineNum++;

      const processedLine = await this.processProductType(
        item,
        lineNum,
        qbTaxCodeId,
        taxName,
        realmId,
        missingItems
      );

      if (processedLine) {
        lines.push(processedLine);
      }
    }

    if (missingItems.length > 0) {
      throw new Error(
        `The following items were not found in QuickBooks. Please create them in QuickBooks first:\n${missingItems.join('\n')}`
      );
    }

    return lines;
  }

  /**
   * Process product type and return QB line item
   * Handles special types: Divider, Subtotal, Empty Row, Custom, Multiplier
   */
  private async processProductType(
    item: EstimatePreviewData['items'][0],
    lineNum: number,
    qbTaxCodeId: string,
    taxName: string,
    realmId: string,
    missingItems: string[]
  ): Promise<QBLine | null> {
    // DIVIDER - Skip entirely
    if (item.productTypeId === PRODUCT_TYPES.DIVIDER) {
      console.log(`   Skipping Divider item at line ${lineNum}`);
      return null;
    }

    // SUBTOTAL - DescriptionOnly with text processing
    if (item.productTypeId === PRODUCT_TYPES.SUBTOTAL) {
      const displayText = item.calculationDisplay || item.itemName || '';
      console.log(`   Processing Subtotal at line ${lineNum}`);

      if (displayText) {
        // Replace colons with equals to avoid QB magic subtotal pattern
        const processedText = displayText
          .replace(/Subtotal:/g, 'Subtotal =')
          .replace(/Tax\s*\(/g, 'Tax (')
          .replace(/Tax\s*\([^)]+\):/g, (match: string) => match.replace(':', ' ='))
          .replace(/Section Total:/g, 'Section Total =')
          .replace(/Total:/g, 'Total =');

        const safeDescription = '--------------------------------------\n' + processedText + '\n--------------------------------------';

        return {
          DetailType: 'DescriptionOnly',
          Description: safeDescription,
          DescriptionLineDetail: {},
          LineNum: lineNum,
        };
      } else {
        return {
          DetailType: 'DescriptionOnly',
          Description: '--------------------------------------\nSection Total = $0.00\n--------------------------------------',
          DescriptionLineDetail: {},
          LineNum: lineNum,
        };
      }
    }

    // EMPTY ROW - DescriptionOnly for spacing
    if (item.productTypeId === PRODUCT_TYPES.EMPTY_ROW) {
      const description = item.calculationDisplay || item.itemName || ' ';
      console.log(`   Adding Empty Row at line ${lineNum}`);

      return {
        DetailType: 'DescriptionOnly',
        Description: description,
        DescriptionLineDetail: {},
        LineNum: lineNum,
      };
    }

    // CUSTOM - Conditional: DescriptionOnly vs. SalesItem
    if (item.productTypeId === PRODUCT_TYPES.CUSTOM) {
      const hasPrice = item.unitPrice && item.unitPrice > 0;

      if (!hasPrice && item.calculationDisplay && item.calculationDisplay.trim()) {
        console.log(`   Adding Custom (description-only) at line ${lineNum}`);
        return {
          DetailType: 'DescriptionOnly',
          Description: item.calculationDisplay,
          DescriptionLineDetail: {},
          LineNum: lineNum,
        };
      }
      console.log(`   Custom item at line ${lineNum} has price, treating as regular item`);
    }

    // MULTIPLIER - Skip (already applied)
    if (item.productTypeId === PRODUCT_TYPES.MULTIPLIER) {
      console.log(`   Skipping Multiplier at line ${lineNum} (already applied to items)`);
      return null;
    }

    // REGULAR ITEM or DISCOUNT/FEE - SalesItemLineDetail
    let itemData = await quickbooksRepository.getCachedItemId(item.itemName);
    let qbItemId: string | null = itemData?.qb_item_id || null;
    let qbDescription: string | null = itemData?.description || null;

    if (!qbItemId) {
      console.log(`Looking up item in QB: "${item.itemName}"`);
      qbItemId = await getItemIdByName(item.itemName, realmId);

      if (!qbItemId) {
        missingItems.push(item.itemName);
        return null;
      }

      await quickbooksRepository.storeItemMapping({
        item_name: item.itemName,
        qb_item_id: qbItemId,
      });
      console.log(`Cached item mapping: "${item.itemName}" -> ${qbItemId}`);
    } else {
      console.log(`Using cached item ID for "${item.itemName}": ${qbItemId}`);
    }

    return {
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: {
          value: qbItemId,
          name: item.itemName,
        },
        Qty: item.quantity || 0,
        UnitPrice: item.unitPrice || 0,
        TaxCodeRef: {
          value: qbTaxCodeId,
          name: taxName,
        },
      },
      Amount: item.extendedPrice || 0,
      Description: qbDescription || '',
      LineNum: lineNum,
    };
  }

  // =============================================
  // DEBUG METHODS (DELEGATED)
  // =============================================

  /**
   * Fetch estimate from QuickBooks for analysis
   * @see fetchEstimateForAnalysis
   */
  async fetchEstimateForAnalysis(estimateId: string, realmId?: string): Promise<any> {
    return fetchEstimateForAnalysis(estimateId, realmId);
  }

  /**
   * Test logging functionality
   * @see testLogging
   */
  testLogging(): { success: boolean; message: string; timestamp: string } {
    return testLogging();
  }
}

// Export singleton instance
export const quickbooksService = new QuickBooksService();
