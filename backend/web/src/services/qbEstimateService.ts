// File Clean up Finished: 2025-11-18
// Analysis: Service layer for QB estimate creation and management
// Status: FUNCTIONAL but feature not used in production (0 QB estimates)
// Findings:
//   - Line 219-236: getOrderData() - Direct DB query in service (should be in repository)
//   - Line 241-260: getOrderParts() - EXACT DUPLICATE of orderPrepRepo.getOrderPartsForHash()
//   - Multiple any types: line 219, 241, 266, 267, 269
//   - Already uses query() helper (good)
// Decision: Skip cleanup until feature is actively used in production
//   Will revisit when QB estimate feature has actual usage (currently 0 records)

/**
 * QuickBooks Estimate Service for Orders
 *
 * Business logic for creating and managing QuickBooks estimates from orders.
 * Handles staleness detection, data mapping, and PDF download.
 */

import crypto from 'crypto';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createEstimate, getEstimateWebUrl, getEstimatePdfApiUrl } from '../utils/quickbooks/apiClient';
import * as orderPrepRepo from '../repositories/orderPreparationRepository';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import { StalenessCheckResult } from '../types/orderPreparation';
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { calculateOrderDataHash } from './orderDataHashService';
import { SMB_ROOT, ORDERS_FOLDER, FINISHED_FOLDER } from '../config/paths';

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
    const orderData = await getOrderData(orderId);
    if (!orderData) {
      throw new Error('Order not found');
    }

    // 2. Get order parts (invoice items only)
    const orderParts = await getOrderParts(orderId);
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
    const qbCustomerId = await resolveCustomerIdForOrder(
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
    const tokenData = await quickbooksRepository.getActiveTokens(realmId);
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
 * Get order data for QB estimate creation
 */
async function getOrderData(orderId: number): Promise<any> {
  const rows = await query(
    `SELECT
      o.order_id,
      o.order_number,
      o.customer_id,
      o.order_name,
      o.tax_name,
      o.folder_location,
      o.customer_po,
      o.customer_job_number,
      c.company_name as customer_name,
      c.quickbooks_name
    FROM orders o
    JOIN customers c ON c.customer_id = o.customer_id
    WHERE o.order_id = ?`,
    [orderId]
  ) as RowDataPacket[];

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get order parts (invoice items only)
 */
async function getOrderParts(orderId: number): Promise<any[]> {
  const rows = await query(
    `SELECT
      part_id,
      part_number,
      invoice_description,
      qb_item_name,
      qb_description,
      specs_display_name,
      quantity,
      unit_price,
      extended_price,
      product_type,
      (unit_price IS NOT NULL AND unit_price > 0) as is_taxable
    FROM order_parts
    WHERE order_id = ?
      AND (invoice_description IS NOT NULL OR unit_price IS NOT NULL)
    ORDER BY part_number`,
    [orderId]
  ) as RowDataPacket[];

  return rows;
}

/**
 * Map order data to QuickBooks estimate format
 */
async function mapOrderToQBEstimate(
  orderData: any,
  orderParts: any[],
  qbCustomerId: string
): Promise<any> {
  // Get product type to QB item mappings
  const productTypes = [...new Set(orderParts.map(p => p.product_type).filter(Boolean))];
  const itemMappings = await quickbooksRepository.getBatchQBItemMappings(productTypes);

  // Resolve tax code (with database fallback for unmapped taxes)
  let taxCodeId: string;
  let taxName: string;

  if (orderData.tax_name) {
    // Try to map the order's tax_name to a QB tax code
    const taxCodeIdResult = await quickbooksRepository.getTaxCodeIdByName(orderData.tax_name);
    if (taxCodeIdResult) {
      taxCodeId = taxCodeIdResult;
      taxName = orderData.tax_name;
      console.log(`✓ Tax code mapped: "${orderData.tax_name}" → QB ID ${taxCodeId}`);
    } else {
      // Tax name not found in mappings - use default from qb_settings
      const defaultTaxCode = await quickbooksRepository.getDefaultTaxCode();
      if (!defaultTaxCode) {
        throw new Error(`Tax code "${orderData.tax_name}" not found in qb_tax_code_mappings and no default tax code configured in qb_settings.`);
      }
      taxCodeId = defaultTaxCode.id;
      taxName = defaultTaxCode.name;
      console.warn(`⚠️  Tax code "${orderData.tax_name}" not found - using default: "${taxName}" (QB ID ${taxCodeId})`);
    }
  } else {
    // No tax_name specified - use default from qb_settings
    const defaultTaxCode = await quickbooksRepository.getDefaultTaxCode();
    if (!defaultTaxCode) {
      throw new Error('No tax_name specified and no default tax code configured in qb_settings.');
    }
    taxCodeId = defaultTaxCode.id;
    taxName = defaultTaxCode.name;
    console.log(`ℹ️  No tax_name specified - using default: "${taxName}" (QB ID ${taxCodeId})`);
  }

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
    // Get QB item ID for product type (using Map.get for case-insensitive lookup)
    const mapping = itemMappings.get(part.product_type?.toLowerCase());
    const qbItemId = mapping?.qb_item_id || '1'; // Default to first item if no mapping

    // Use qb_description directly (no fallback logic)
    const description = part.qb_description || '';

    const salesItemDetail: any = {
      ItemRef: {
        value: qbItemId,
        name: part.product_type || 'General Item'
      },
      Qty: parseFloat(part.quantity || 1),
      UnitPrice: parseFloat(part.unit_price || 0),
      // ALWAYS send tax code (even for 0% taxes like "Out of Scope" or "Exempt")
      TaxCodeRef: {
        value: taxCodeId,
        name: taxName
      }
    };

    lineItems.push({
      DetailType: 'SalesItemLineDetail',
      Description: description,
      Amount: parseFloat(part.extended_price || 0),
      SalesItemLineDetail: salesItemDetail
    });
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

/**
 * Resolve customer ID with caching and validation
 * Matches the pattern from Job Estimation (quickbooksService.ts)
 */
async function resolveCustomerIdForOrder(
  customerId: number,
  quickbooksName: string,
  realmId: string
): Promise<string> {
  // Check cache first
  let qbCustomerId = await quickbooksRepository.getCachedCustomerId(customerId);

  if (!qbCustomerId) {
    // Not cached - lookup in QuickBooks
    console.log(`Looking up customer in QB: "${quickbooksName}"`);
    const { getCustomerIdByName } = await import('../utils/quickbooks/apiClient');
    qbCustomerId = await getCustomerIdByName(quickbooksName, realmId);

    if (!qbCustomerId) {
      throw new Error(
        `Customer "${quickbooksName}" not found in QuickBooks. ` +
        `Please create this customer in QuickBooks first, or update the QuickBooks name in customer settings.`
      );
    }

    // Store in cache
    await quickbooksRepository.storeCustomerMapping({
      customer_id: customerId,
      qb_customer_id: qbCustomerId,
      qb_customer_name: quickbooksName,
    });
    console.log(`✅ Cached customer mapping: ${customerId} → ${qbCustomerId}`);
  } else {
    console.log(`✅ Using cached customer ID: ${qbCustomerId}`);
  }

  return qbCustomerId;
}
