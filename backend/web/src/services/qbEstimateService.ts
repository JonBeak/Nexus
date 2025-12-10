// Refactored: 2025-11-21
// Changes:
//   - Now uses shared entityResolver for customer and tax code resolution
//   - Removed duplicate resolveCustomerIdForOrder() function (now in entityResolver.ts)
//   - Simplified tax resolution using resolveTaxCodeWithFallback()
// Previous cleanup (2025-11-21):
//   - Removed getOrderData() - moved to orderPrepRepo.getOrderDataForQBEstimate()
//   - Removed getOrderParts() - moved to orderPrepRepo.getOrderPartsForQBEstimate()
//   - Added proper TypeScript types (OrderDataForQBEstimate, OrderPartForQBEstimate)
//   - Removed direct database queries from service layer (architecture violation fixed)

/**
 * QuickBooks Estimate Service for Orders
 *
 * Business logic for creating and managing QuickBooks estimates from orders.
 * Handles staleness detection, data mapping, and PDF download.
 */

import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createEstimate, getEstimateWebUrl, getEstimatePdfApiUrl } from '../utils/quickbooks/apiClient';
import * as orderPrepRepo from '../repositories/orderPreparationRepository';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import { quickbooksOAuthRepository } from '../repositories/quickbooksOAuthRepository';
import { StalenessCheckResult, OrderDataForQBEstimate, OrderPartForQBEstimate } from '../types/orderPreparation';
import { calculateOrderDataHash } from '../utils/orderDataHashService';
import { SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER } from '../config/paths';
import { resolveCustomerId, resolveTaxCodeWithFallback } from '../utils/quickbooks/entityResolver';

/**
 * Check if the current QB estimate is stale (order data changed since estimate created)
 */
export async function checkEstimateStaleness(orderId: number): Promise<StalenessCheckResult> {
  try {
    // Get current QB estimate
    const currentEstimate = await orderPrepRepo.getCurrentQBEstimate(orderId);

    if (!currentEstimate) {
      return {
        exists: false,
        isStale: false,
        currentHash: null,
        storedHash: null,
        qbEstimateNumber: null,
        createdAt: null
      };
    }

    // Calculate current hash from order parts
    const currentHash = await calculateOrderDataHash(orderId);

    // Compare with stored hash
    const isStale = currentHash !== currentEstimate.estimate_data_hash;

    return {
      exists: true,
      isStale,
      currentHash,
      storedHash: currentEstimate.estimate_data_hash,
      qbEstimateNumber: currentEstimate.qb_estimate_number,
      createdAt: currentEstimate.created_at
    };
  } catch (error) {
    console.error('Error checking QB estimate staleness:', error);
    throw new Error('Failed to check estimate staleness');
  }
}

/**
 * Create a QuickBooks estimate from an order
 * Main orchestration method for estimate creation
 */
export async function createEstimateFromOrder(
  orderId: number,
  userId: number
): Promise<{
  estimateId: string;
  estimateNumber: string;
  dataHash: string;
  estimateUrl: string;
  pdfPath: string | null;
}> {
  try {
    // 1. Get order data
    const orderData = await orderPrepRepo.getOrderDataForQBEstimate(orderId);
    if (!orderData) {
      throw new Error('Order not found');
    }

    // 2. Get order parts (invoice items only)
    const orderParts = await orderPrepRepo.getOrderPartsForQBEstimate(orderId);
    if (orderParts.length === 0) {
      throw new Error('No invoice parts found for order');
    }

    // 3. Calculate data hash for staleness tracking
    const dataHash = await calculateOrderDataHash(orderId);

    // 4. Get QuickBooks realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    // 5. Validate QuickBooks name is configured
    if (!orderData.quickbooks_name || !orderData.quickbooks_name.trim()) {
      throw new Error(
        `Customer "${orderData.customer_name}" does not have a QuickBooks name configured. ` +
        `Please edit the customer and set their QuickBooks name to match their exact DisplayName in QuickBooks.`
      );
    }

    // 6. Resolve QB customer ID (with caching and validation)
    const qbCustomerId = await resolveCustomerId(
      orderData.customer_id,
      orderData.quickbooks_name,
      realmId
    );

    // 7. Map order to QB estimate format
    const qbEstimatePayload = await mapOrderToQBEstimate(
      orderData,
      orderParts,
      qbCustomerId
    );

    // 8. Create estimate in QuickBooks
    console.log(`Creating QB estimate for order #${orderData.order_number}...`);
    const { estimateId, docNumber } = await createEstimate(qbEstimatePayload, realmId);

    // 9. Get estimate URL (web interface URL for users to click)
    const estimateUrl = getEstimateWebUrl(estimateId);

    // 10. Mark previous estimates as not current
    await orderPrepRepo.markPreviousEstimatesNotCurrent(orderId);

    // 11. Save estimate record to database
    await orderPrepRepo.createQBEstimateRecord({
      order_id: orderId,
      qb_estimate_id: estimateId,
      qb_estimate_number: docNumber,
      created_by: userId,
      estimate_data_hash: dataHash,
      qb_estimate_url: estimateUrl
    });

    console.log(`QB estimate created: ${docNumber} (ID: ${estimateId})`);

    // 12. Auto-download PDF to order Specs folder
    let pdfPath = null;
    try {
      console.log(`Auto-downloading QB estimate PDF to Specs folder...`);
      const pdfResult = await downloadEstimatePDF(estimateId, orderData.order_number);
      pdfPath = pdfResult.pdfPath;
      console.log(`QB estimate PDF auto-downloaded to: ${pdfPath}`);
    } catch (pdfError) {
      console.error('Failed to auto-download QB estimate PDF:', pdfError);
      // Don't fail the entire estimate creation if PDF download fails
      console.warn('Continuing without PDF - you can download it manually later');
    }

    return {
      estimateId,
      estimateNumber: docNumber,
      dataHash,
      estimateUrl,
      pdfPath
    };
  } catch (error) {
    console.error('Error creating QB estimate from order:', error);
    throw error;
  }
}

/**
 * Download QB estimate PDF and save to order folder
 */
export async function downloadEstimatePDF(
  qbEstimateId: string,
  orderNumber: number
): Promise<{
  pdfPath: string;
  pdfUrl: string;
}> {
  try {
    // 1. Get realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    // 2. Get access token for QB API
    const tokenData = await quickbooksOAuthRepository.getActiveTokens(realmId);
    if (!tokenData) {
      throw new Error('No active QuickBooks access token');
    }

    // 3. Download PDF from QuickBooks API (using API endpoint with authentication)
    const pdfUrl = getEstimatePdfApiUrl(qbEstimateId, realmId);
    console.log(`Downloading QB estimate PDF from: ${pdfUrl}`);
    const response = await axios.get(pdfUrl, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/pdf'
      },
      responseType: 'arraybuffer',
      timeout: 30000 // 30 second timeout
    });

    // 4. Get order data for folder path and name
    const order = await orderPrepRepo.getOrderByOrderNumber(orderNumber);
    if (!order || !order.folder_name || order.folder_location === 'none') {
      throw new Error('Order folder not found');
    }

    // 5. Construct full folder path (same logic as PDF generation service)
    const basePath = order.folder_location === 'active'
      ? path.join(SMB_ROOT, ORDERS_FOLDER)
      : path.join(SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER);
    const orderFolderRoot = path.join(basePath, order.folder_name);

    // 6. Ensure Specs subfolder exists
    const specsFolder = path.join(orderFolderRoot, 'Specs');
    await fs.mkdir(specsFolder, { recursive: true });

    // 7. Save PDF to Specs subfolder with proper naming
    const filename = `${orderNumber} - ${order.order_name} - QB Estimate.pdf`;
    const pdfPath = path.join(specsFolder, filename);

    await fs.writeFile(pdfPath, response.data as Buffer);
    console.log(`QB estimate PDF saved to: ${pdfPath}`);

    return {
      pdfPath,
      pdfUrl: `/orders/${order.folder_name}/Specs/${filename}` // URL for frontend preview
    };
  } catch (error) {
    console.error('Error downloading QB estimate PDF:', error);
    throw new Error('Failed to download QB estimate PDF');
  }
}

/**
 * Map order data to QuickBooks estimate format
 */
async function mapOrderToQBEstimate(
  orderData: OrderDataForQBEstimate,
  orderParts: OrderPartForQBEstimate[],
  qbCustomerId: string
): Promise<any> {
  // Get QB item name to QB item mappings (use qb_item_name, not product_type)
  const qbItemNames = [...new Set(orderParts.map(p => p.qb_item_name).filter(Boolean))] as string[];
  const itemMappings = await quickbooksRepository.getBatchQBItemMappings(qbItemNames);

  // Resolve tax code (with database fallback for unmapped taxes)
  const { taxCodeId, taxName } = await resolveTaxCodeWithFallback(orderData.tax_name);

  // Build memo text for DescriptionOnly line item #1
  let memoText = `Order #${orderData.order_number} - ${orderData.order_name}`;

  // Add PO # if present
  if (orderData.customer_po && orderData.customer_po.trim()) {
    memoText += `\nPO #: ${orderData.customer_po}`;
  }

  // Add Job # if present
  if (orderData.customer_job_number && orderData.customer_job_number.trim()) {
    memoText += `\nJob #: ${orderData.customer_job_number}`;
  }

  // Build line items
  const lineItems: any[] = [];

  // First: DescriptionOnly line item with order info
  lineItems.push({
    DetailType: 'DescriptionOnly',
    Description: memoText,
    DescriptionLineDetail: {}
  });

  // Order parts (invoice items) - QB will auto-number based on array order
  for (const part of orderParts) {
    // Check if this should be a DescriptionOnly row
    // Criteria: has qb_description but NO qb_item_name AND NO unit_price (or zero)
    const hasDescription = part.qb_description && part.qb_description.trim();
    const hasNoQBItem = !part.qb_item_name || !part.qb_item_name.trim();
    const hasNoPrice = !part.unit_price || part.unit_price === 0;
    const isDescriptionOnly = hasDescription && hasNoQBItem && hasNoPrice;

    if (isDescriptionOnly) {
      // DescriptionOnly row - just text, no pricing
      lineItems.push({
        DetailType: 'DescriptionOnly',
        Description: part.qb_description,
        DescriptionLineDetail: {}
      });
    } else {
      // SalesItemLineDetail row - product with pricing
      // Get QB item ID using qb_item_name (case-insensitive lookup)
      const mapping = itemMappings.get(part.qb_item_name?.toLowerCase() || '');
      const qbItemId = mapping?.qb_item_id || '1'; // Default to first item if no mapping

      // Use qb_description directly (no fallback logic)
      const description = part.qb_description || '';

      const salesItemDetail: any = {
        ItemRef: {
          value: qbItemId,
          name: part.qb_item_name || part.product_type || 'General Item'
        },
        Qty: parseFloat(String(part.quantity || 1)),
        UnitPrice: parseFloat(String(part.unit_price || 0)),
        // ALWAYS send tax code (even for 0% taxes like "Out of Scope" or "Exempt")
        TaxCodeRef: {
          value: taxCodeId,
          name: taxName
        }
      };

      lineItems.push({
        DetailType: 'SalesItemLineDetail',
        Description: description,
        Amount: parseFloat(String(part.extended_price || 0)),
        SalesItemLineDetail: salesItemDetail
      });
    }
  }

  // Build QB estimate payload (no CustomerMemo - moved to line #1)
  const estimatePayload: any = {
    CustomerRef: {
      value: qbCustomerId
    },
    TxnDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    Line: lineItems
  };

  // ALWAYS add transaction-level tax detail (even for 0% taxes)
  // This ensures QuickBooks uses the explicit tax code instead of guessing
  estimatePayload.TxnTaxDetail = {
    TxnTaxCodeRef: {
      value: taxCodeId,
      name: taxName
    }
  };

  return estimatePayload;
}
