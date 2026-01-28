/**
 * Cash Estimate Sync Service
 * Cash Job Conflict Resolution - Phase 2
 *
 * Detects when estimates have been modified in QuickBooks directly,
 * enabling conflict detection and resolution for cash jobs.
 *
 * @module services/cashEstimateSyncService
 * @created 2025-01-27
 */

import * as crypto from 'crypto';
import { getQBEstimate, QBEstimate, QBEstimateLine, queryEstimatesByCustomer } from '../utils/quickbooks/apiClient';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import * as orderPrepRepo from '../repositories/orderPreparationRepository';
import { calculateQBEstimateHash } from '../utils/orderDataHashService';
import { query } from '../config/database';

// =============================================
// TYPES
// =============================================

export type EstimateSyncStatus = 'in_sync' | 'local_stale' | 'qb_modified' | 'conflict' | 'not_found' | 'error';

export interface EstimateSyncResult {
  status: EstimateSyncStatus;
  localChanged: boolean;
  qbChanged: boolean;

  // Timestamps
  localSyncedAt: Date | null;
  qbLastUpdatedAt: Date | null;

  // Hash details
  localDataHash: string | null;
  storedDataHash: string | null;
  qbContentHash: string | null;
  storedContentHash: string | null;

  // QB estimate info
  qbEstimateId: string | null;
  qbEstimateNumber: string | null;
  qbSyncToken: string | null;

  // Differences (if qbChanged or conflict)
  differences?: EstimateDifference[];

  // Error info
  errorMessage?: string;
}

export interface EstimateDifference {
  type: 'added' | 'removed' | 'modified';
  lineNumber: number;
  field: 'description' | 'quantity' | 'unitPrice' | 'amount' | 'item';
  localValue?: string | number;
  qbValue?: string | number;
}

export interface QBEstimateSnapshot {
  syncToken: string;
  lastUpdatedTime: Date;
  contentHash: string;
  lineItems: QBEstimateLineSnapshot[];
}

export interface QBEstimateLineSnapshot {
  lineNum: number;
  detailType: 'SalesItemLineDetail' | 'DescriptionOnly';
  description: string;
  amount: number;
  quantity: number | null;
  unitPrice: number | null;
  itemName: string | null;
}

// QB Estimate for customer listing
export interface CustomerEstimate {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  TotalAmt: number;
  CustomerRef: { value: string; name?: string };
}

// =============================================
// HASH CALCULATION
// =============================================

/**
 * Calculate a hash of QB estimate line items for content comparison.
 * This hash represents the actual content in QuickBooks.
 */
export function calculateQBEstimateContentHash(estimate: QBEstimate): string {
  // Extract line item data for hashing (exclude SubTotalLineDetail auto-lines)
  const lineData = estimate.Line
    .filter(line => line.DetailType !== 'SubTotalLineDetail')
    .map(line => ({
      detailType: line.DetailType,
      description: (line.Description || '').trim(),
      amount: line.Amount || 0,
      qty: line.SalesItemLineDetail?.Qty || null,
      unitPrice: line.SalesItemLineDetail?.UnitPrice || null,
      itemId: line.SalesItemLineDetail?.ItemRef?.value || null
    }));

  // Sort for deterministic hashing (by description then amount)
  lineData.sort((a, b) => {
    const descCompare = a.description.localeCompare(b.description);
    return descCompare !== 0 ? descCompare : a.amount - b.amount;
  });

  const hashInput = JSON.stringify({
    lines: lineData,
    total: estimate.TotalAmt,
    customerId: estimate.CustomerRef.value
  });

  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Parse QB estimate into a snapshot for storage/comparison
 */
export function parseQBEstimateSnapshot(estimate: QBEstimate): QBEstimateSnapshot {
  const lineItems: QBEstimateLineSnapshot[] = estimate.Line
    .filter(line => line.DetailType !== 'SubTotalLineDetail')
    .map((line, index) => ({
      lineNum: index + 1,
      detailType: line.DetailType as 'SalesItemLineDetail' | 'DescriptionOnly',
      description: (line.Description || '').trim(),
      amount: line.Amount || 0,
      quantity: line.SalesItemLineDetail?.Qty || null,
      unitPrice: line.SalesItemLineDetail?.UnitPrice || null,
      itemName: line.SalesItemLineDetail?.ItemRef?.name || null
    }));

  return {
    syncToken: estimate.SyncToken,
    lastUpdatedTime: new Date(estimate.MetaData?.LastUpdatedTime || new Date()),
    contentHash: calculateQBEstimateContentHash(estimate),
    lineItems
  };
}

// =============================================
// DATABASE HELPERS
// =============================================

interface EstimateRecordFull {
  id: number;
  order_id: number;
  qb_estimate_id: string;
  qb_estimate_number: string;
  estimate_data_hash: string;
  qb_estimate_sync_token: string | null;
  qb_estimate_last_updated_time: Date | null;
  qb_estimate_content_hash: string | null;
  qb_estimate_synced_at: Date | null;
}

/**
 * Get full estimate record including sync tracking fields
 */
async function getEstimateRecordFull(orderId: number): Promise<EstimateRecordFull | null> {
  const rows = await query(
    `SELECT
      id,
      order_id,
      qb_estimate_id,
      qb_estimate_number,
      estimate_data_hash,
      qb_estimate_sync_token,
      qb_estimate_last_updated_time,
      qb_estimate_content_hash,
      qb_estimate_synced_at
    FROM order_qb_estimates
    WHERE order_id = ? AND is_current = 1
    ORDER BY created_at DESC
    LIMIT 1`,
    [orderId]
  ) as any[];

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Update estimate sync tracking fields
 */
async function updateEstimateTrackingData(
  orderId: number,
  data: Partial<{
    qb_estimate_sync_token: string;
    qb_estimate_last_updated_time: Date;
    qb_estimate_content_hash: string;
    qb_estimate_synced_at: Date;
    estimate_data_hash: string;
  }>
): Promise<void> {
  const updates: string[] = [];
  const values: any[] = [];

  if (data.qb_estimate_sync_token !== undefined) {
    updates.push('qb_estimate_sync_token = ?');
    values.push(data.qb_estimate_sync_token);
  }
  if (data.qb_estimate_last_updated_time !== undefined) {
    updates.push('qb_estimate_last_updated_time = ?');
    values.push(data.qb_estimate_last_updated_time);
  }
  if (data.qb_estimate_content_hash !== undefined) {
    updates.push('qb_estimate_content_hash = ?');
    values.push(data.qb_estimate_content_hash);
  }
  if (data.qb_estimate_synced_at !== undefined) {
    updates.push('qb_estimate_synced_at = ?');
    values.push(data.qb_estimate_synced_at);
  }
  if (data.estimate_data_hash !== undefined) {
    updates.push('estimate_data_hash = ?');
    values.push(data.estimate_data_hash);
  }

  if (updates.length === 0) return;

  values.push(orderId);
  await query(
    `UPDATE order_qb_estimates SET ${updates.join(', ')} WHERE order_id = ? AND is_current = 1`,
    values
  );
}

// =============================================
// SYNC STATUS CHECK
// =============================================

/**
 * Check full sync status between local order data and QB estimate.
 * This performs a QB API call to fetch the current estimate state.
 *
 * Returns one of:
 * - 'in_sync': Neither local nor QB changed since last sync
 * - 'local_stale': Local order data changed (need to push to QB)
 * - 'qb_modified': QB estimate was edited directly (need to review)
 * - 'conflict': Both changed (need resolution)
 * - 'not_found': Estimate doesn't exist in QB
 * - 'error': Failed to check (API error, etc.)
 */
export async function checkFullSyncStatus(orderId: number): Promise<EstimateSyncResult> {
  try {
    // 1. Get stored estimate record
    const estimateRecord = await getEstimateRecordFull(orderId);

    if (!estimateRecord || !estimateRecord.qb_estimate_id) {
      return {
        status: 'in_sync', // No estimate = nothing to compare
        localChanged: false,
        qbChanged: false,
        localSyncedAt: null,
        qbLastUpdatedAt: null,
        localDataHash: null,
        storedDataHash: null,
        qbContentHash: null,
        storedContentHash: null,
        qbEstimateId: null,
        qbEstimateNumber: null,
        qbSyncToken: null
      };
    }

    // 2. Get realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      return {
        status: 'error',
        localChanged: false,
        qbChanged: false,
        localSyncedAt: estimateRecord.qb_estimate_synced_at,
        qbLastUpdatedAt: null,
        localDataHash: null,
        storedDataHash: estimateRecord.estimate_data_hash,
        qbContentHash: null,
        storedContentHash: estimateRecord.qb_estimate_content_hash,
        qbEstimateId: estimateRecord.qb_estimate_id,
        qbEstimateNumber: estimateRecord.qb_estimate_number,
        qbSyncToken: null,
        errorMessage: 'QuickBooks realm ID not configured'
      };
    }

    // 3. Fetch current estimate from QB
    let qbEstimate: QBEstimate;
    try {
      qbEstimate = await getQBEstimate(estimateRecord.qb_estimate_id, realmId);
    } catch (error: any) {
      // Check if estimate was deleted
      if (error.statusCode === 404 || error.message?.includes('not found')) {
        return {
          status: 'not_found',
          localChanged: false,
          qbChanged: true,
          localSyncedAt: estimateRecord.qb_estimate_synced_at,
          qbLastUpdatedAt: null,
          localDataHash: null,
          storedDataHash: estimateRecord.estimate_data_hash,
          qbContentHash: null,
          storedContentHash: estimateRecord.qb_estimate_content_hash,
          qbEstimateId: estimateRecord.qb_estimate_id,
          qbEstimateNumber: estimateRecord.qb_estimate_number,
          qbSyncToken: null,
          errorMessage: 'Estimate was deleted in QuickBooks'
        };
      }
      throw error;
    }

    // 4. Calculate current local hash
    const currentLocalHash = await calculateQBEstimateHash(orderId);

    // 5. Calculate current QB content hash
    const qbSnapshot = parseQBEstimateSnapshot(qbEstimate);

    // 6. Determine changes
    const localChanged = currentLocalHash !== estimateRecord.estimate_data_hash;

    // QB changed if: SyncToken different OR LastUpdatedTime different OR content hash different
    let qbChanged = false;
    const hasTrackingData = !!(
      estimateRecord.qb_estimate_sync_token ||
      estimateRecord.qb_estimate_last_updated_time ||
      estimateRecord.qb_estimate_content_hash
    );

    if (hasTrackingData) {
      // We have baseline data - compare against it
      if (estimateRecord.qb_estimate_sync_token) {
        qbChanged = qbSnapshot.syncToken !== estimateRecord.qb_estimate_sync_token;
      } else if (estimateRecord.qb_estimate_last_updated_time) {
        qbChanged = qbSnapshot.lastUpdatedTime > estimateRecord.qb_estimate_last_updated_time;
      } else if (estimateRecord.qb_estimate_content_hash) {
        qbChanged = qbSnapshot.contentHash !== estimateRecord.qb_estimate_content_hash;
      }
    } else {
      // LAZY INITIALIZATION: No tracking data exists (estimate created before this feature)
      // Store current QB state as baseline for future comparisons
      console.log(`[Cash Estimate Sync] Initializing tracking data for estimate ${estimateRecord.qb_estimate_id}`);
      await updateEstimateTrackingData(orderId, {
        qb_estimate_sync_token: qbSnapshot.syncToken,
        qb_estimate_last_updated_time: qbSnapshot.lastUpdatedTime,
        qb_estimate_content_hash: qbSnapshot.contentHash
      });
      // First check after initialization - no QB changes detected yet
      qbChanged = false;
    }

    // 7. Determine sync status
    let status: EstimateSyncStatus;
    if (!localChanged && !qbChanged) {
      status = 'in_sync';
    } else if (localChanged && !qbChanged) {
      status = 'local_stale';
    } else if (!localChanged && qbChanged) {
      status = 'qb_modified';
    } else {
      status = 'conflict';
    }

    // 8. Build result
    const result: EstimateSyncResult = {
      status,
      localChanged,
      qbChanged,
      localSyncedAt: estimateRecord.qb_estimate_synced_at,
      qbLastUpdatedAt: qbSnapshot.lastUpdatedTime,
      localDataHash: currentLocalHash,
      storedDataHash: estimateRecord.estimate_data_hash,
      qbContentHash: qbSnapshot.contentHash,
      storedContentHash: estimateRecord.qb_estimate_content_hash,
      qbEstimateId: estimateRecord.qb_estimate_id,
      qbEstimateNumber: estimateRecord.qb_estimate_number,
      qbSyncToken: qbSnapshot.syncToken
    };

    // 9. If QB changed or conflict, calculate differences
    if (qbChanged) {
      result.differences = await calculateDifferences(orderId, qbSnapshot.lineItems);
    }

    return result;

  } catch (error: any) {
    console.error('Error checking estimate sync status:', error);
    return {
      status: 'error',
      localChanged: false,
      qbChanged: false,
      localSyncedAt: null,
      qbLastUpdatedAt: null,
      localDataHash: null,
      storedDataHash: null,
      qbContentHash: null,
      storedContentHash: null,
      qbEstimateId: null,
      qbEstimateNumber: null,
      qbSyncToken: null,
      errorMessage: error.message || 'Failed to check sync status'
    };
  }
}

// =============================================
// DIFFERENCE CALCULATION
// =============================================

/**
 * Calculate line-by-line differences between local order parts and QB estimate lines
 */
async function calculateDifferences(
  orderId: number,
  qbLines: QBEstimateLineSnapshot[]
): Promise<EstimateDifference[]> {
  const differences: EstimateDifference[] = [];

  // Get local order parts
  const localParts = await orderPrepRepo.getOrderPartsForQBEstimate(orderId);

  // Compare by position
  const maxLength = Math.max(localParts.length, qbLines.length);

  for (let i = 0; i < maxLength; i++) {
    const localPart = localParts[i];
    const qbLine = qbLines[i];

    if (!localPart && qbLine) {
      // Line exists in QB but not locally (added in QB)
      differences.push({
        type: 'added',
        lineNumber: i + 1,
        field: 'item',
        qbValue: qbLine.description || qbLine.itemName || 'Line item'
      });
      continue;
    }

    if (localPart && !qbLine) {
      // Line exists locally but not in QB (removed from QB)
      differences.push({
        type: 'removed',
        lineNumber: i + 1,
        field: 'item',
        localValue: localPart.qb_description || localPart.product_type || 'Line item'
      });
      continue;
    }

    // Both exist - compare fields
    if (localPart && qbLine) {
      // Compare description
      const localDesc = (localPart.qb_description || '').trim();
      const qbDesc = (qbLine.description || '').trim();
      if (localDesc !== qbDesc) {
        differences.push({
          type: 'modified',
          lineNumber: i + 1,
          field: 'description',
          localValue: localDesc,
          qbValue: qbDesc
        });
      }

      // Compare quantity
      if (localPart.quantity !== qbLine.quantity) {
        differences.push({
          type: 'modified',
          lineNumber: i + 1,
          field: 'quantity',
          localValue: localPart.quantity || 0,
          qbValue: qbLine.quantity || 0
        });
      }

      // Compare unit price (with tolerance)
      const localPrice = localPart.unit_price || 0;
      const qbPrice = qbLine.unitPrice || 0;
      if (Math.abs(localPrice - qbPrice) > 0.01) {
        differences.push({
          type: 'modified',
          lineNumber: i + 1,
          field: 'unitPrice',
          localValue: localPrice,
          qbValue: qbPrice
        });
      }

      // Compare amount (with tolerance)
      const localAmount = localPart.extended_price || 0;
      const qbAmount = qbLine.amount || 0;
      if (Math.abs(localAmount - qbAmount) > 0.01) {
        differences.push({
          type: 'modified',
          lineNumber: i + 1,
          field: 'amount',
          localValue: localAmount,
          qbValue: qbAmount
        });
      }
    }
  }

  return differences;
}

// =============================================
// CONFLICT RESOLUTION
// =============================================

export type EstimateConflictResolution = 'use_local' | 'use_qb';

/**
 * Resolve a sync conflict by applying the chosen resolution
 */
export async function resolveConflict(
  orderId: number,
  resolution: EstimateConflictResolution,
  userId: number
): Promise<{ success: boolean; message: string }> {
  const realmId = await quickbooksRepository.getDefaultRealmId();
  if (!realmId) {
    throw new Error('QuickBooks realm ID not configured');
  }

  switch (resolution) {
    case 'use_local':
      // Create new QB estimate from local data (existing createEstimateFromOrder)
      const { createEstimateFromOrder } = await import('./qbEstimateService');
      await createEstimateFromOrder(orderId, userId);
      return {
        success: true,
        message: 'New QuickBooks estimate created from local order data'
      };

    case 'use_qb':
      // Accept QB version: sync QB line items back to order_parts (INVOICE side only)
      const estimateRecord = await getEstimateRecordFull(orderId);
      if (!estimateRecord?.qb_estimate_id) {
        throw new Error('No estimate linked to this order');
      }

      // Fetch current QB estimate
      const qbEstimate = await getQBEstimate(estimateRecord.qb_estimate_id, realmId);
      const snapshot = parseQBEstimateSnapshot(qbEstimate);

      // Sync QB line items back to order_parts (INVOICE columns only)
      const syncResult = await syncQBLinesToOrderParts(orderId, snapshot.lineItems);
      console.log(`[Cash Estimate Sync] Synced ${syncResult.updatedCount} order parts from QB estimate`);
      if (syncResult.warnings.length > 0) {
        console.log(`[Cash Estimate Sync] Warnings:`, syncResult.warnings);
      }

      // Update stored tracking data to match QB state
      await updateEstimateTrackingData(orderId, {
        qb_estimate_synced_at: new Date(),
        qb_estimate_sync_token: snapshot.syncToken,
        qb_estimate_last_updated_time: snapshot.lastUpdatedTime,
        qb_estimate_content_hash: snapshot.contentHash
      });

      // Also update the local data hash since we've synced the invoice columns
      const newLocalHash = await calculateQBEstimateHash(orderId);
      await updateEstimateTrackingData(orderId, {
        estimate_data_hash: newLocalHash
      });

      // Build result message
      let resultMessage = `Synced ${syncResult.updatedCount} line(s) from QuickBooks.`;
      if (syncResult.addedInQB > 0 || syncResult.removedInQB > 0) {
        resultMessage += ` Warning: ${syncResult.addedInQB} extra line(s) in QB, ${syncResult.removedInQB} missing line(s) in QB.`;
      }

      return {
        success: true,
        message: resultMessage
      };

    default:
      throw new Error(`Unknown resolution type: ${resolution}`);
  }
}

// =============================================
// SYNC QB LINES BACK TO ORDER PARTS
// =============================================

export interface SyncBackResult {
  updatedCount: number;
  addedInQB: number;    // Lines in QB but not in order (warning)
  removedInQB: number;  // Lines in order but not in QB (warning)
  warnings: string[];
}

/**
 * Sync QB estimate line items back to order_parts (INVOICE side only).
 * Updates: qb_description, quantity, unit_price, extended_price
 * Does NOT touch: specifications, specs_qty, product_type, etc. (SPECS side)
 *
 * Matches by position (line number). If line counts differ, syncs what we can
 * and returns warnings for mismatches.
 */
async function syncQBLinesToOrderParts(
  orderId: number,
  qbLines: QBEstimateLineSnapshot[]
): Promise<SyncBackResult> {
  console.log(`[Cash Estimate Sync] Starting sync for order ${orderId} with ${qbLines.length} QB lines`);

  // Get current order parts ordered by part_number
  const orderParts = await query(
    `SELECT part_id, part_number, qb_item_name, qb_description, quantity, unit_price, extended_price
     FROM order_parts
     WHERE order_id = ?
     ORDER BY part_number ASC`,
    [orderId]
  ) as any[];

  console.log(`[Cash Estimate Sync] Found ${orderParts.length} order parts in database`);

  const result: SyncBackResult = {
    updatedCount: 0,
    addedInQB: 0,
    removedInQB: 0,
    warnings: []
  };

  // Match by position
  const maxLength = Math.max(orderParts.length, qbLines.length);

  for (let i = 0; i < maxLength; i++) {
    const orderPart = orderParts[i];
    const qbLine = qbLines[i];

    if (!orderPart && qbLine) {
      // Line exists in QB but not in order_parts
      result.addedInQB++;
      result.warnings.push(`Line ${i + 1} exists in QB ("${qbLine.description?.substring(0, 30)}...") but not in order parts`);
      continue;
    }

    if (orderPart && !qbLine) {
      // Line exists in order_parts but not in QB
      result.removedInQB++;
      result.warnings.push(`Part #${orderPart.part_number} exists in order but not in QB estimate`);
      continue;
    }

    // Both exist - update invoice columns from QB
    if (orderPart && qbLine) {
      const updates: string[] = [];
      const values: any[] = [];

      // Only update if values differ
      // QB Item Name (Product/Service)
      if (orderPart.qb_item_name !== qbLine.itemName && qbLine.itemName !== null) {
        updates.push('qb_item_name = ?');
        values.push(qbLine.itemName);
      }
      // Description
      if (orderPart.qb_description !== qbLine.description) {
        updates.push('qb_description = ?');
        values.push(qbLine.description);
      }
      // Quantity
      if (orderPart.quantity !== qbLine.quantity && qbLine.quantity !== null) {
        updates.push('quantity = ?');
        values.push(qbLine.quantity);
      }
      // Unit Price
      if (Math.abs((orderPart.unit_price || 0) - (qbLine.unitPrice || 0)) > 0.01) {
        updates.push('unit_price = ?');
        values.push(qbLine.unitPrice);
      }
      // Extended Price / Amount
      if (Math.abs((orderPart.extended_price || 0) - (qbLine.amount || 0)) > 0.01) {
        updates.push('extended_price = ?');
        values.push(qbLine.amount);
      }

      if (updates.length > 0) {
        console.log(`[Cash Estimate Sync] Updating part ${orderPart.part_id} (part_number ${orderPart.part_number}): ${updates.join(', ')}`);
        values.push(orderPart.part_id);
        await query(
          `UPDATE order_parts SET ${updates.join(', ')} WHERE part_id = ?`,
          values
        );
        result.updatedCount++;
      } else {
        console.log(`[Cash Estimate Sync] Part ${orderPart.part_id} (part_number ${orderPart.part_number}): no changes needed`);
      }
    }
  }

  if (result.addedInQB > 0) {
    result.warnings.push(`${result.addedInQB} line(s) in QB estimate are not in order parts - manual reconciliation needed`);
  }
  if (result.removedInQB > 0) {
    result.warnings.push(`${result.removedInQB} order part(s) not in QB estimate - specs preserved but invoice data may be stale`);
  }

  return result;
}

// =============================================
// LINK EXISTING ESTIMATE
// =============================================

/**
 * Link an existing QB estimate to an order
 */
export async function linkExistingEstimate(
  orderId: number,
  qbEstimateId: string,
  userId: number
): Promise<{ success: boolean; qbEstimateNumber: string }> {
  const realmId = await quickbooksRepository.getDefaultRealmId();
  if (!realmId) {
    throw new Error('QuickBooks realm ID not configured');
  }

  // Fetch the estimate from QB
  const qbEstimate = await getQBEstimate(qbEstimateId, realmId);

  // Mark previous estimates as not current
  await orderPrepRepo.markPreviousEstimatesNotCurrent(orderId);

  // Calculate data hash for staleness tracking
  const dataHash = await calculateQBEstimateHash(orderId);

  // Parse QB estimate snapshot for sync tracking
  const snapshot = parseQBEstimateSnapshot(qbEstimate);

  // Create new estimate record with sync tracking data
  await query(
    `INSERT INTO order_qb_estimates (
      order_id,
      qb_estimate_id,
      qb_estimate_number,
      created_by,
      is_current,
      estimate_data_hash,
      qb_estimate_url,
      qb_estimate_sync_token,
      qb_estimate_last_updated_time,
      qb_estimate_content_hash,
      qb_estimate_synced_at,
      created_at
    ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      orderId,
      qbEstimateId,
      qbEstimate.DocNumber,
      userId,
      dataHash,
      `https://qbo.intuit.com/app/estimate?txnId=${qbEstimateId}`,
      snapshot.syncToken,
      snapshot.lastUpdatedTime,
      snapshot.contentHash
    ]
  );

  return {
    success: true,
    qbEstimateNumber: qbEstimate.DocNumber
  };
}

// =============================================
// GET CUSTOMER ESTIMATES (for Link modal)
// =============================================

/**
 * Get QB estimates for a customer (for linking)
 */
export async function getCustomerEstimates(orderId: number): Promise<CustomerEstimate[]> {
  // Get customer's QB ID
  const orderData = await query(
    `SELECT c.qb_customer_id
     FROM orders o
     JOIN customers c ON c.customer_id = o.customer_id
     WHERE o.order_id = ?`,
    [orderId]
  ) as any[];

  if (!orderData.length || !orderData[0].qb_customer_id) {
    throw new Error('Customer not linked to QuickBooks');
  }

  const qbCustomerId = orderData[0].qb_customer_id;

  // Get realm ID
  const realmId = await quickbooksRepository.getDefaultRealmId();
  if (!realmId) {
    throw new Error('QuickBooks realm ID not configured');
  }

  // Fetch estimates from QB
  const estimates = await queryEstimatesByCustomer(qbCustomerId, realmId);

  return estimates.map(est => ({
    Id: est.Id,
    DocNumber: est.DocNumber,
    TxnDate: est.TxnDate,
    TotalAmt: est.TotalAmt,
    CustomerRef: est.CustomerRef
  }));
}
