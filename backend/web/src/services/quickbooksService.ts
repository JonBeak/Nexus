// File Clean up Finished: 2025-11-14
// Changes:
// - Removed dead code: unused setDefaultRealmId import from dbManager
// - Migrated to repository pattern: storeTokens() now uses quickbooksRepository
// - Migrated to repository pattern: getActiveTokens() now uses quickbooksRepository
// - Architecture fix: All token methods now go through repository layer (uses query() helper)
// - Consistent data access: Service layer now exclusively uses repository, no direct dbManager calls
// - Preserved encryption: Token encryption with AES-256-GCM maintained through migration
/**
 * QuickBooks Service
 * Business Logic Layer for QuickBooks Integration
 *
 * Handles:
 * - OAuth flow orchestration
 * - Estimate creation with complex product type handling
 * - Entity resolution (customer/tax/item) with caching
 * - Line item construction with QB magic pattern avoidance
 */

import { quickbooksRepository } from '../repositories/quickbooksRepository';
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  validateConfig,
  OAuthError,
} from '../utils/quickbooks/oauthClient';
import {
  makeQBApiCall,
  createEstimate,
  getCustomerIdByName,
  getItemIdByName,
  getEstimatePdfUrl,
} from '../utils/quickbooks/apiClient';
import { getDefaultRealmId } from '../utils/quickbooks/dbManager';

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

/**
 * QuickBooks Service Class
 * Orchestrates business logic, NO HTTP handling, NO direct database queries
 */
export class QuickBooksService {

  // =============================================
  // OAUTH FLOW MANAGEMENT
  // =============================================

  /**
   * Initiate OAuth flow
   * Generates authorization URL and stores CSRF state token
   */
  async initiateOAuth(): Promise<{ authUrl: string; state: string }> {
    // Generate authorization URL
    const { authUrl, state } = await getAuthorizationUrl();

    // Store state token for CSRF validation (10 minutes)
    await quickbooksRepository.storeOAuthState(state, 600);

    console.log(`🔗 OAuth flow initiated with state: ${state.substring(0, 8)}...`);

    return { authUrl, state };
  }

  /**
   * Process OAuth callback
   * Validates CSRF token, exchanges code for tokens, stores tokens
   */
  async processCallback(
    code: string,
    realmId: string,
    state: string
  ): Promise<void> {
    // CSRF Protection: Validate state token
    const isValidState = await quickbooksRepository.validateAndConsumeOAuthState(state);
    if (!isValidState) {
      throw new OAuthError('Invalid or expired state token (possible CSRF attack)');
    }

    console.log(`🔐 Processing OAuth callback for Realm ID: ${realmId}`);

    // Exchange authorization code for tokens
    const tokenData = await exchangeCodeForTokens(code);

    // Store tokens in database (encrypted)
    await quickbooksRepository.storeTokens(realmId, tokenData);

    // Set as default realm if this is first/only connection
    const currentDefault = await quickbooksRepository.getDefaultRealmId();
    if (!currentDefault) {
      await quickbooksRepository.setDefaultRealmId(realmId);
      console.log(`✅ Set Realm ID ${realmId} as default`);
    }

    console.log(`✅ QuickBooks connected successfully for Realm ID: ${realmId}`);
  }

  /**
   * Disconnect from QuickBooks
   * Deletes stored tokens
   */
  async disconnect(realmId: string): Promise<void> {
    await quickbooksRepository.deleteTokens(realmId);
    console.log(`✅ Disconnected from QuickBooks (Realm ID: ${realmId})`);
  }

  // =============================================
  // CONNECTION & DATA MANAGEMENT
  // =============================================

  /**
   * Check QuickBooks connection status
   * Returns connection info and token expiry
   */
  async checkConnectionStatus(realmId: string | null): Promise<{
    connected: boolean;
    realmId?: string;
    environment?: string;
    tokenExpiresAt?: Date;
    message: string;
  }> {
    if (!realmId) {
      return {
        connected: false,
        message: 'Not connected to QuickBooks',
      };
    }

    const tokenData = await quickbooksRepository.getActiveTokens(realmId);

    if (!tokenData) {
      return {
        connected: false,
        realmId,
        message: 'Token expired or invalid. Please reconnect.',
      };
    }

    return {
      connected: true,
      realmId,
      environment: process.env.QB_ENVIRONMENT || 'sandbox',
      tokenExpiresAt: tokenData.access_token_expires_at,
      message: 'Connected to QuickBooks',
    };
  }

  /**
   * Get QuickBooks items for dropdown
   * Returns all cached items from database
   */
  async getQuickBooksItems(): Promise<Array<{
    id: number;
    name: string;
    description: string | null;
    qbItemId: string;
    qbItemType: string | null;
  }>> {
    const items = await quickbooksRepository.getAllQBItems();
    console.log(`✅ Fetched ${items.length} QuickBooks items for dropdown`);
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
  // ESTIMATE CREATION (COMPLEX)
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
    console.log('\n📥 CREATE-ESTIMATE REQUEST:');
    console.log(`  estimateId: ${estimateId}`);
    console.log(`  debugMode: ${debugMode}`);
    console.log(`  items count: ${estimatePreviewData.items.length}`);

    // STEP 1: Validate estimate eligibility
    await this.validateEstimateEligibility(estimateId, estimatePreviewData);

    // Get realm ID
    const realmId = await getDefaultRealmId();
    if (!realmId) {
      throw new Error('Not connected to QuickBooks. Please connect first.');
    }

    // Get estimate details
    const estimateDetails = await quickbooksRepository.getEstimateDetails(estimateId);
    if (!estimateDetails) {
      throw new Error('Estimate not found');
    }

    // STEP 2: Resolve customer ID (with caching)
    const qbCustomerId = await this.resolveCustomerId(
      estimateDetails.customer_id,
      estimatePreviewData.customerName,
      realmId
    );

    // STEP 3: Resolve tax code (province-based)
    const { taxCodeId: qbTaxCodeId, taxName } = await this.resolveTaxCode(
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
      TxnDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      Line: lines,
    };

    console.log(`\n💰 TAX CONFIGURATION:`);
    console.log(`  Tax Name: "${taxName}"`);
    console.log(`  QB Tax Code ID: ${qbTaxCodeId}`);
    console.log(`  Tax Rate: ${(estimatePreviewData.taxRate * 100).toFixed(2)}%\n`);

    console.log(`📤 Creating estimate in QB with ${lines.length} line items...`);

    const result = await createEstimate(qbPayload, realmId);
    const qbEstimateUrl = getEstimatePdfUrl(result.estimateId, realmId);

    console.log(`✅ QB Estimate created: ID=${result.estimateId}, Doc#=${result.docNumber}`);

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

    console.log(`✅ Estimate ${estimateId} finalized and linked to QB estimate ${result.estimateId}`);

    // STEP 7: Debug mode (if enabled)
    if (debugMode) {
      const debugData = await this.fetchEstimateForDebug(result.estimateId, realmId, lines);

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
   * PRIVATE: Called by createEstimateInQuickBooks
   */
  private async validateEstimateEligibility(
    estimateId: number,
    estimatePreviewData: EstimatePreviewData
  ): Promise<void> {
    const estimateDetails = await quickbooksRepository.getEstimateDetails(estimateId);

    if (!estimateDetails) {
      throw new Error('Estimate not found');
    }

    // Validate: Only drafts can be sent
    if (!estimateDetails.is_draft) {
      throw new Error('Only draft estimates can be sent to QuickBooks. This estimate is already finalized.');
    }

    // Validate: Not already sent
    if (estimateDetails.qb_estimate_id) {
      const realmId = await getDefaultRealmId();
      const qbEstimateUrl = getEstimatePdfUrl(estimateDetails.qb_estimate_id, realmId || '');
      throw new Error(`Estimate already sent to QuickBooks. URL: ${qbEstimateUrl}`);
    }

    // Validate: Customer name is configured
    if (!estimatePreviewData.customerName || !estimatePreviewData.customerName.trim()) {
      throw new Error('Customer QuickBooks name is not configured. Please set the QuickBooks name in customer settings.');
    }
  }

  /**
   * Resolve customer ID with caching
   * PRIVATE: Called by createEstimateInQuickBooks
   */
  private async resolveCustomerId(
    customerId: number,
    customerName: string,
    realmId: string
  ): Promise<string> {
    // Check cache first
    let qbCustomerId = await quickbooksRepository.getCachedCustomerId(customerId);

    if (!qbCustomerId) {
      // Not cached - lookup in QuickBooks
      console.log(`Looking up customer in QB: ${customerName}`);
      qbCustomerId = await getCustomerIdByName(customerName, realmId);

      if (!qbCustomerId) {
        throw new Error(`Customer "${customerName}" not found in QuickBooks. Please create this customer in QuickBooks first.`);
      }

      // Store in cache
      await quickbooksRepository.storeCustomerMapping({
        customer_id: customerId,
        qb_customer_id: qbCustomerId,
        qb_customer_name: customerName,
      });
      console.log(`✅ Cached customer mapping: ${customerId} → ${qbCustomerId}`);
    } else {
      console.log(`✅ Using cached customer ID: ${qbCustomerId}`);
    }

    return qbCustomerId;
  }

  /**
   * Resolve tax code from customer province
   * PRIVATE: Called by createEstimateInQuickBooks
   */
  private async resolveTaxCode(customerId: number): Promise<{
    taxCodeId: string;
    taxName: string;
  }> {
    // Get customer's billing province
    const customerProvince = await quickbooksRepository.getCustomerProvince(customerId);
    if (!customerProvince) {
      throw new Error('Customer does not have a primary address. Please set a primary address first.');
    }

    console.log(`Customer billing province: ${customerProvince}`);

    // Map province to tax name
    const taxName = await quickbooksRepository.getTaxNameForProvince(customerProvince);
    if (!taxName) {
      throw new Error(`No tax configuration found for province ${customerProvince}. Please check provinces_tax table.`);
    }

    console.log(`Province ${customerProvince} mapped to tax: "${taxName}"`);

    // Get QB tax code ID
    const qbTaxCodeId = await quickbooksRepository.getTaxCodeIdByName(taxName);
    if (!qbTaxCodeId) {
      throw new Error(`No QuickBooks tax code mapping found for "${taxName}". Please configure the mapping in qb_tax_code_mappings.`);
    }

    console.log(`✅ Using tax code: "${taxName}" → QB ID: ${qbTaxCodeId}`);

    return { taxCodeId: qbTaxCodeId, taxName };
  }

  /**
   * Build QB line items from estimate items
   * Handles all product types and item caching
   * PRIVATE: Called by createEstimateInQuickBooks
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

      // Process product type
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

    // Fail if any items are missing (aggregate all errors)
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
   * PRIVATE: Called by buildLineItems
   */
  private async processProductType(
    item: EstimatePreviewData['items'][0],
    lineNum: number,
    qbTaxCodeId: string,
    taxName: string,
    realmId: string,
    missingItems: string[]
  ): Promise<QBLine | null> {
    // DIVIDER (Type 25) - Skip entirely
    if (item.productTypeId === 25) {
      console.log(`   ↳ Skipping Divider item at line ${lineNum}`);
      return null;
    }

    // SUBTOTAL (Type 21) - DescriptionOnly with text processing
    if (item.productTypeId === 21) {
      const displayText = item.calculationDisplay || item.itemName || '';
      console.log(`   ↳ Processing Subtotal at line ${lineNum}`);

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
        // Empty subtotal
        const emptySubtotal = '--------------------------------------\nSection Total = $0.00\n--------------------------------------';
        return {
          DetailType: 'DescriptionOnly',
          Description: emptySubtotal,
          DescriptionLineDetail: {},
          LineNum: lineNum,
        };
      }
    }

    // EMPTY ROW (Type 27) - DescriptionOnly for spacing
    if (item.productTypeId === 27) {
      const description = item.calculationDisplay || item.itemName || ' ';
      console.log(`   ↳ Adding Empty Row at line ${lineNum}`);

      return {
        DetailType: 'DescriptionOnly',
        Description: description,
        DescriptionLineDetail: {},
        LineNum: lineNum,
      };
    }

    // CUSTOM (Type 9) - Conditional: DescriptionOnly vs. SalesItem
    if (item.productTypeId === 9) {
      const hasPrice = item.unitPrice && item.unitPrice > 0;

      if (!hasPrice && item.calculationDisplay && item.calculationDisplay.trim()) {
        // Description-only custom item
        console.log(`   ↳ Adding Custom (description-only) at line ${lineNum}`);
        return {
          DetailType: 'DescriptionOnly',
          Description: item.calculationDisplay,
          DescriptionLineDetail: {},
          LineNum: lineNum,
        };
      }
      // Has price - fall through to regular item handling
      console.log(`   ↳ Custom item at line ${lineNum} has price, treating as regular item`);
    }

    // MULTIPLIER (Type 23) - Skip (already applied)
    if (item.productTypeId === 23) {
      console.log(`   ↳ Skipping Multiplier at line ${lineNum} (already applied to items)`);
      return null;
    }

    // REGULAR ITEM or DISCOUNT/FEE (Type 22) - SalesItemLineDetail
    // Resolve item ID with caching
    let itemData = await quickbooksRepository.getCachedItemId(item.itemName);
    let qbItemId: string | null = itemData?.qb_item_id || null;
    let qbDescription: string | null = itemData?.description || null;

    if (!qbItemId) {
      console.log(`Looking up item in QB: "${item.itemName}"`);
      qbItemId = await getItemIdByName(item.itemName, realmId);

      if (!qbItemId) {
        missingItems.push(item.itemName);
        return null; // Continue checking other items
      }

      await quickbooksRepository.storeItemMapping({
        item_name: item.itemName,
        qb_item_id: qbItemId,
      });
      console.log(`✅ Cached item mapping: "${item.itemName}" → ${qbItemId}`);
    } else {
      console.log(`✅ Using cached item ID for "${item.itemName}": ${qbItemId}`);
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

  /**
   * Fetch estimate back from QB for debug comparison
   * PRIVATE: Called by createEstimateInQuickBooks when debugMode=true
   */
  private async fetchEstimateForDebug(
    qbEstimateId: string,
    realmId: string,
    sentLines: QBLine[]
  ): Promise<any> {
    console.log('\n🔬 DEBUG MODE: Fetching estimate back from QuickBooks...');

    const fetchedEstimate = await makeQBApiCall('GET', `estimate/${qbEstimateId}`, realmId, {});
    const returnedLines = fetchedEstimate.Estimate?.Line || [];

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📤 WHAT WE SENT TO QUICKBOOKS:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Line Items Sent: ${sentLines.length}\n`);

    sentLines.forEach((line, index) => {
      console.log(`\n[Sent Line ${index + 1}]`);
      console.log(`  DetailType: ${line.DetailType}`);
      console.log(`  LineNum: ${line.LineNum || 'N/A'}`);

      if (line.DetailType === 'SalesItemLineDetail') {
        console.log(`  Product/Service: "${line.SalesItemLineDetail?.ItemRef?.name}"`);
        console.log(`  Quantity: ${line.SalesItemLineDetail?.Qty}`);
        console.log(`  Unit Price: $${line.SalesItemLineDetail?.UnitPrice}`);
        console.log(`  Extended Amount: $${line.Amount}`);
      } else if (line.DetailType === 'DescriptionOnly') {
        const desc = line.Description || '(empty)';
        console.log(`  Text: "${desc.substring(0, 100)}${desc.length > 100 ? '...' : ''}"`);
      }
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📥 WHAT QUICKBOOKS RETURNED:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Line Items Returned: ${returnedLines.length}\n`);

    returnedLines.forEach((line: any, index: number) => {
      console.log(`\n[Returned Line ${index + 1}]`);
      console.log(`  DetailType: ${line.DetailType}`);
      console.log(`  LineNum: ${line.LineNum || 'N/A'}`);

      if (line.DetailType === 'SalesItemLineDetail') {
        console.log(`  Product/Service: "${line.SalesItemLineDetail?.ItemRef?.name}"`);
        console.log(`  Quantity: ${line.SalesItemLineDetail?.Qty}`);
        console.log(`  Unit Price: $${line.SalesItemLineDetail?.UnitPrice}`);
        console.log(`  Extended Amount: $${line.Amount}`);
      } else if (line.DetailType === 'DescriptionOnly') {
        const desc = line.Description || '(empty)';
        console.log(`  Text: "${desc.substring(0, 100)}${desc.length > 100 ? '...' : ''}"`);
      }
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📊 COMPARISON: Sent ${sentLines.length} lines, QB returned ${returnedLines.length} lines`);
    if (sentLines.length !== returnedLines.length) {
      console.log(`⚠️  WARNING: Line count mismatch!`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');

    return {
      linesSent: sentLines.length,
      linesReturned: returnedLines.length,
      sentLines: sentLines,
      returnedLines: returnedLines,
      fullEstimate: fetchedEstimate.Estimate,
    };
  }

  /**
   * Fetch estimate from QuickBooks for analysis
   * Used by debug endpoints
   */
  async fetchEstimateForAnalysis(estimateId: string, realmId: string): Promise<any> {
    console.log('\n🔍 FETCHING QUICKBOOKS ESTIMATE');
    console.log('================================');
    console.log(`Estimate ID: ${estimateId}`);
    console.log(`Realm ID: ${realmId}`);

    const response = await makeQBApiCall('GET', `estimate/${estimateId}`, realmId, {});
    const estimate = response.Estimate;

    if (!estimate) {
      throw new Error('Estimate not found');
    }

    console.log('\n📋 QUICKBOOKS ESTIMATE STRUCTURE');
    console.log('==================================');
    console.log(`Doc Number: ${estimate.DocNumber}`);
    console.log(`Total Amount: ${estimate.TotalAmt}`);
    console.log(`Line Items: ${estimate.Line ? estimate.Line.length : 0}`);

    return {
      id: estimate.Id,
      docNumber: estimate.DocNumber,
      totalAmount: estimate.TotalAmt,
      lineCount: estimate.Line ? estimate.Line.length : 0,
      lines: estimate.Line || [],
      raw: estimate,
    };
  }

  /**
   * Test logging functionality
   */
  testLogging(): { success: boolean; message: string; timestamp: string } {
    console.log('\n🧪 QUICKBOOKS LOGGING TEST');
    console.log('==========================');
    console.log('✅ Logging is working!');
    console.log('Timestamp:', new Date().toISOString());
    console.log('==========================\n');

    return {
      success: true,
      message: 'Logging test successful - check logs',
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const quickbooksService = new QuickBooksService();
