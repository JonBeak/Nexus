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
import { createEstimate, getEstimatePdfUrl } from '../utils/quickbooks/apiClient';
import * as orderPrepRepo from '../repositories/orderPreparationRepository';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import { StalenessCheckResult } from '../types/orderPreparation';
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

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

    // 5. Get QB customer ID
    const qbCustomerId = await quickbooksRepository.getCachedCustomerId(orderData.customer_id);
    if (!qbCustomerId) {
      throw new Error(`QuickBooks customer mapping not found for customer ID ${orderData.customer_id}`);
    }

    // 6. Map order to QB estimate format
    const qbEstimatePayload = await mapOrderToQBEstimate(
      orderData,
      orderParts,
      qbCustomerId
    );

    // 7. Create estimate in QuickBooks
    console.log(`Creating QB estimate for order #${orderData.order_number}...`);
    const { estimateId, docNumber } = await createEstimate(qbEstimatePayload, realmId);

    // 8. Get estimate URL
    const estimateUrl = getEstimatePdfUrl(estimateId, realmId);

    // 9. Mark previous estimates as not current
    await orderPrepRepo.markPreviousEstimatesNotCurrent(orderId);

    // 10. Save estimate record to database
    await orderPrepRepo.createQBEstimateRecord({
      order_id: orderId,
      qb_estimate_id: estimateId,
      qb_estimate_number: docNumber,
      created_by: userId,
      estimate_data_hash: dataHash,
      qb_estimate_url: estimateUrl
    });

    console.log(`QB estimate created: ${docNumber} (ID: ${estimateId})`);

    return {
      estimateId,
      estimateNumber: docNumber,
      dataHash,
      estimateUrl
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

    // 2. Get QB estimate PDF URL
    const pdfUrl = getEstimatePdfUrl(qbEstimateId, realmId);

    // 3. Download PDF from QuickBooks
    console.log(`Downloading QB estimate PDF from: ${pdfUrl}`);
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 30000 // 30 second timeout
    });

    // 4. Get order folder path
    const order = await orderPrepRepo.getOrderByOrderNumber(orderNumber);
    if (!order || !order.folder_location) {
      throw new Error('Order folder location not found');
    }

    // 5. Save PDF to order folder
    const filename = `${orderNumber} - QB Estimate.pdf`;
    const pdfPath = path.join(order.folder_location, filename);

    await fs.writeFile(pdfPath, response.data as Buffer);
    console.log(`QB estimate PDF saved to: ${pdfPath}`);

    return {
      pdfPath,
      pdfUrl: `/orders/${orderNumber}/${filename}` // URL for frontend preview
    };
  } catch (error) {
    console.error('Error downloading QB estimate PDF:', error);
    throw new Error('Failed to download QB estimate PDF');
  }
}

/**
 * Calculate SHA256 hash of order parts data for staleness detection
 */
async function calculateOrderDataHash(orderId: number): Promise<string> {
  const orderParts = await orderPrepRepo.getOrderPartsForHash(orderId);

  // Create normalized data structure for hashing
  const hashData = orderParts.map(part => ({
    part_number: part.part_number,
    invoice_description: part.invoice_description,
    quantity: part.quantity,
    unit_price: part.unit_price,
    extended_price: part.extended_price,
    product_type: part.product_type,
    is_taxable: part.is_taxable
  }));

  // Calculate SHA256 hash
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(hashData))
    .digest('hex');

  return hash;
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
      o.job_name,
      o.tax_name,
      o.folder_location,
      c.company_name as customer_name
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
      quantity,
      unit_price,
      extended_price,
      product_type,
      is_taxable
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

  // Get tax code if applicable
  let taxCodeId = 'NON'; // Default non-taxable
  if (orderData.tax_name) {
    const taxCodeIdResult = await quickbooksRepository.getTaxCodeIdByName(orderData.tax_name);
    if (taxCodeIdResult) {
      taxCodeId = taxCodeIdResult;
    }
  }

  // Build line items
  const lineItems: any[] = [];
  let lineNum = 1;

  for (const part of orderParts) {
    // Get QB item ID for product type (using Map.get for case-insensitive lookup)
    const mapping = itemMappings.get(part.product_type?.toLowerCase());
    const qbItemId = mapping?.qb_item_id || '1'; // Default to first item if no mapping

    lineItems.push({
      LineNum: lineNum++,
      DetailType: 'SalesItemLineDetail',
      Description: part.invoice_description || '',
      Amount: parseFloat(part.extended_price || 0),
      SalesItemLineDetail: {
        ItemRef: {
          value: qbItemId,
          name: part.product_type || 'General Item'
        },
        Qty: parseFloat(part.quantity || 1),
        UnitPrice: parseFloat(part.unit_price || 0),
        TaxCodeRef: {
          value: part.is_taxable ? taxCodeId : 'NON'
        }
      }
    });
  }

  // Build QB estimate payload
  const estimatePayload = {
    CustomerRef: {
      value: qbCustomerId
    },
    TxnDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    Line: lineItems,
    CustomerMemo: {
      value: `Order #${orderData.order_number} - ${orderData.job_name}`
    }
  };

  return estimatePayload;
}
