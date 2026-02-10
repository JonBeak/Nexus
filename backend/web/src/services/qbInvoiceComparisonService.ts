/**
 * QB Invoice Comparison Service
 * Phase 2: Bi-Directional Invoice Sync
 *
 * Detects when invoices have been modified in QuickBooks directly,
 * enabling conflict detection and resolution.
 *
 * @module services/qbInvoiceComparisonService
 * @created 2025-12-17
 */

import * as crypto from 'crypto';
import { getQBInvoice } from '../utils/quickbooks/invoiceClient';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import * as qbInvoiceRepo from '../repositories/qbInvoiceRepository';
import { calculateOrderDataHash } from '../utils/orderDataHashService';
import { QBInvoice, QBLineItem } from '../types/qbInvoice';

// =============================================
// TYPES
// =============================================

export type InvoiceSyncStatus = 'in_sync' | 'local_stale' | 'qb_modified' | 'conflict' | 'not_found' | 'error';

export interface InvoiceSyncResult {
  status: InvoiceSyncStatus;
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

  // QB invoice info
  qbInvoiceId: string | null;
  qbInvoiceNumber: string | null;
  qbSyncToken: string | null;

  // Differences (if qbChanged or conflict)
  differences?: InvoiceDifference[];

  // Error info
  errorMessage?: string;
}

export interface InvoiceDifference {
  type: 'added' | 'removed' | 'modified';
  lineNumber: number;
  field: 'description' | 'quantity' | 'unitPrice' | 'amount' | 'item';
  localValue?: string | number;
  qbValue?: string | number;
}

export interface QBInvoiceSnapshot {
  syncToken: string;
  lastUpdatedTime: Date;
  contentHash: string;
  lineItems: QBLineItemSnapshot[];
}

export interface QBLineItemSnapshot {
  lineNum: number;
  detailType: 'SalesItemLineDetail' | 'DescriptionOnly';
  description: string;
  amount: number;
  quantity: number | null;
  unitPrice: number | null;
  itemName: string | null;
}

// =============================================
// HASH CALCULATION
// =============================================

/**
 * Calculate a hash of QB invoice line items for content comparison.
 * This hash represents the actual content in QuickBooks.
 */
export function calculateQBInvoiceHash(invoice: QBInvoice): string {
  // Extract line item data for hashing (exclude SubTotalLineDetail auto-lines)
  const lineData = invoice.Line
    .filter(line => line.DetailType !== 'SubTotalLineDetail' as any)
    .map(line => ({
      detailType: line.DetailType,
      description: (line.Description || '').trim(),
      amount: line.Amount || 0,
      // Normalize qty to integer when it's a whole number (e.g., 1.00 -> 1)
      // to avoid hash mismatches between QB's "1.00" and local "1"
      qty: line.SalesItemLineDetail?.Qty != null
        ? (Number.isInteger(line.SalesItemLineDetail.Qty) ? Math.round(line.SalesItemLineDetail.Qty) : line.SalesItemLineDetail.Qty)
        : null,
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
    total: invoice.TotalAmt,
    customerId: invoice.CustomerRef.value
  });

  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Parse QB invoice into a snapshot for storage/comparison
 */
export function parseQBInvoiceSnapshot(invoice: QBInvoice): QBInvoiceSnapshot {
  const lineItems: QBLineItemSnapshot[] = invoice.Line
    .filter(line => line.DetailType !== 'SubTotalLineDetail' as any)
    .map((line, index) => ({
      lineNum: index + 1,
      detailType: line.DetailType as 'SalesItemLineDetail' | 'DescriptionOnly',
      description: (line.Description || '').trim(),
      amount: line.Amount || 0,
      // Normalize qty: convert 1.00 to 1 for consistent comparison with local integer values
      quantity: line.SalesItemLineDetail?.Qty != null
        ? (Number.isInteger(line.SalesItemLineDetail.Qty) ? Math.round(line.SalesItemLineDetail.Qty) : line.SalesItemLineDetail.Qty)
        : null,
      unitPrice: line.SalesItemLineDetail?.UnitPrice || null,
      itemName: line.SalesItemLineDetail?.ItemRef?.name || null
    }));

  return {
    syncToken: invoice.SyncToken,
    lastUpdatedTime: new Date(invoice.MetaData?.LastUpdatedTime || new Date()),
    contentHash: calculateQBInvoiceHash(invoice),
    lineItems
  };
}

// =============================================
// SYNC STATUS CHECK
// =============================================

/**
 * Check full sync status between local order data and QB invoice.
 * This performs a QB API call to fetch the current invoice state.
 *
 * Returns one of:
 * - 'in_sync': Neither local nor QB changed since last sync
 * - 'local_stale': Local order data changed (need to push to QB)
 * - 'qb_modified': QB invoice was edited directly (need to review)
 * - 'conflict': Both changed (need resolution)
 * - 'not_found': Invoice doesn't exist in QB
 * - 'error': Failed to check (API error, etc.)
 */
export async function checkFullSyncStatus(orderId: number): Promise<InvoiceSyncResult> {
  try {
    // 1. Get stored invoice record
    const invoiceRecord = await qbInvoiceRepo.getOrderInvoiceRecordFull(orderId);

    if (!invoiceRecord || !invoiceRecord.qb_invoice_id) {
      return {
        status: 'in_sync', // No invoice = nothing to compare
        localChanged: false,
        qbChanged: false,
        localSyncedAt: null,
        qbLastUpdatedAt: null,
        localDataHash: null,
        storedDataHash: null,
        qbContentHash: null,
        storedContentHash: null,
        qbInvoiceId: null,
        qbInvoiceNumber: null,
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
        localSyncedAt: invoiceRecord.qb_invoice_synced_at,
        qbLastUpdatedAt: null,
        localDataHash: null,
        storedDataHash: invoiceRecord.qb_invoice_data_hash,
        qbContentHash: null,
        storedContentHash: invoiceRecord.qb_invoice_content_hash,
        qbInvoiceId: invoiceRecord.qb_invoice_id,
        qbInvoiceNumber: invoiceRecord.qb_invoice_doc_number,
        qbSyncToken: null,
        errorMessage: 'QuickBooks realm ID not configured'
      };
    }

    // 3. Fetch current invoice from QB
    let qbInvoice: QBInvoice;
    try {
      qbInvoice = await getQBInvoice(invoiceRecord.qb_invoice_id, realmId);
    } catch (error: any) {
      // Check if invoice was deleted
      if (error.statusCode === 404 || error.message?.includes('not found')) {
        return {
          status: 'not_found',
          localChanged: false,
          qbChanged: true,
          localSyncedAt: invoiceRecord.qb_invoice_synced_at,
          qbLastUpdatedAt: null,
          localDataHash: null,
          storedDataHash: invoiceRecord.qb_invoice_data_hash,
          qbContentHash: null,
          storedContentHash: invoiceRecord.qb_invoice_content_hash,
          qbInvoiceId: invoiceRecord.qb_invoice_id,
          qbInvoiceNumber: invoiceRecord.qb_invoice_doc_number,
          qbSyncToken: null,
          errorMessage: 'Invoice was deleted in QuickBooks'
        };
      }
      throw error;
    }

    // 4. Calculate current local hash
    const currentLocalHash = await calculateOrderDataHash(orderId);

    // 5. Calculate current QB content hash
    const qbSnapshot = parseQBInvoiceSnapshot(qbInvoice);

    // 6. Determine changes
    const localChanged = currentLocalHash !== invoiceRecord.qb_invoice_data_hash;

    // QB changed if: SyncToken different OR LastUpdatedTime different OR content hash different
    let qbChanged = false;
    const hasTrackingData = !!(
      invoiceRecord.qb_invoice_sync_token ||
      invoiceRecord.qb_invoice_last_updated_time ||
      invoiceRecord.qb_invoice_content_hash
    );

    if (hasTrackingData) {
      // We have baseline data - compare against it
      if (invoiceRecord.qb_invoice_sync_token) {
        qbChanged = qbSnapshot.syncToken !== invoiceRecord.qb_invoice_sync_token;
      } else if (invoiceRecord.qb_invoice_last_updated_time) {
        qbChanged = qbSnapshot.lastUpdatedTime > invoiceRecord.qb_invoice_last_updated_time;
      } else if (invoiceRecord.qb_invoice_content_hash) {
        qbChanged = qbSnapshot.contentHash !== invoiceRecord.qb_invoice_content_hash;
      }
    } else {
      // LAZY INITIALIZATION: No tracking data exists (invoice created before Phase 2)
      // Store current QB state as baseline for future comparisons
      console.log(`[QB Comparison] Initializing tracking data for invoice ${invoiceRecord.qb_invoice_id}`);
      await qbInvoiceRepo.updateOrderInvoiceRecordFull(orderId, {
        qb_invoice_sync_token: qbSnapshot.syncToken,
        qb_invoice_last_updated_time: qbSnapshot.lastUpdatedTime,
        qb_invoice_content_hash: qbSnapshot.contentHash
      });
      // First check after initialization - no QB changes detected yet
      qbChanged = false;
    }

    // 7. Determine sync status
    let status: InvoiceSyncStatus;
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
    const result: InvoiceSyncResult = {
      status,
      localChanged,
      qbChanged,
      localSyncedAt: invoiceRecord.qb_invoice_synced_at,
      qbLastUpdatedAt: qbSnapshot.lastUpdatedTime,
      localDataHash: currentLocalHash,
      storedDataHash: invoiceRecord.qb_invoice_data_hash,
      qbContentHash: qbSnapshot.contentHash,
      storedContentHash: invoiceRecord.qb_invoice_content_hash,
      qbInvoiceId: invoiceRecord.qb_invoice_id,
      qbInvoiceNumber: invoiceRecord.qb_invoice_doc_number,
      qbSyncToken: qbSnapshot.syncToken
    };

    // 9. If QB changed, local changed, or conflict, calculate differences
    if (qbChanged || localChanged) {
      result.differences = await calculateDifferences(orderId, qbSnapshot.lineItems);
    }

    return result;

  } catch (error: any) {
    console.error('Error checking invoice sync status:', error);
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
      qbInvoiceId: null,
      qbInvoiceNumber: null,
      qbSyncToken: null,
      errorMessage: error.message || 'Failed to check sync status'
    };
  }
}

// =============================================
// DIFFERENCE CALCULATION
// =============================================

/**
 * Calculate line-by-line differences between local order parts and QB invoice lines
 */
async function calculateDifferences(
  orderId: number,
  qbLines: QBLineItemSnapshot[]
): Promise<InvoiceDifference[]> {
  const differences: InvoiceDifference[] = [];

  // Get local order parts
  const { getOrderPartsForQBEstimate } = await import('../repositories/orderPreparationRepository');
  const localParts = await getOrderPartsForQBEstimate(orderId);

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

      // Compare quantity (numeric comparison to avoid 1 !== 1.00 false positives)
      const localQty = Number(localPart.quantity) || 0;
      const qbQty = Number(qbLine.quantity) || 0;
      if (Math.abs(localQty - qbQty) > 0.001) {
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

export type ConflictResolution = 'use_local' | 'use_qb' | 'keep_both';

/**
 * Resolve a sync conflict by applying the chosen resolution
 */
export async function resolveConflict(
  orderId: number,
  resolution: ConflictResolution,
  userId: number
): Promise<{ success: boolean; message: string }> {
  const realmId = await quickbooksRepository.getDefaultRealmId();
  if (!realmId) {
    throw new Error('QuickBooks realm ID not configured');
  }

  switch (resolution) {
    case 'use_local':
      // Update QB invoice with local data (triggers normal update flow)
      const { updateInvoiceFromOrder } = await import('./qbInvoiceService');
      await updateInvoiceFromOrder(orderId, userId);
      return {
        success: true,
        message: 'QuickBooks invoice updated with local order data'
      };

    case 'use_qb':
      // Accept QB version: sync QB line items back to order_parts (INVOICE side only)
      const invoiceRecord = await qbInvoiceRepo.getOrderInvoiceRecordFull(orderId);
      if (!invoiceRecord?.qb_invoice_id) {
        throw new Error('No invoice linked to this order');
      }

      // Fetch current QB invoice
      const qbInvoice = await getQBInvoice(invoiceRecord.qb_invoice_id, realmId);
      const snapshot = parseQBInvoiceSnapshot(qbInvoice);

      // Sync QB line items back to order_parts (INVOICE columns only)
      // This updates: qb_description, quantity, unit_price, extended_price
      // Does NOT touch: specifications, specs_qty, product_type (SPECS side)
      const syncResult = await syncQBLinesToOrderParts(orderId, snapshot.lineItems);
      console.log(`[QB Sync] Synced ${syncResult.updatedCount} order parts from QB invoice`);
      if (syncResult.warnings.length > 0) {
        console.log(`[QB Sync] Warnings:`, syncResult.warnings);
      }

      // Update stored tracking data to match QB state
      await qbInvoiceRepo.updateOrderInvoiceRecordFull(orderId, {
        qb_invoice_synced_at: new Date(),
        qb_invoice_sync_token: snapshot.syncToken,
        qb_invoice_last_updated_time: snapshot.lastUpdatedTime,
        qb_invoice_content_hash: snapshot.contentHash
      });

      // Also update the local data hash since we've synced the invoice columns
      const { calculateOrderDataHash } = await import('../utils/orderDataHashService');
      const newLocalHash = await calculateOrderDataHash(orderId);
      await qbInvoiceRepo.updateOrderInvoiceRecordFull(orderId, {
        qb_invoice_data_hash: newLocalHash
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

    case 'keep_both':
      // Just clear the conflict by updating sync timestamp
      // User will review manually
      await qbInvoiceRepo.updateOrderInvoiceRecordFull(orderId, {
        qb_invoice_synced_at: new Date()
      });
      return {
        success: true,
        message: 'Conflict acknowledged. Review both versions manually.'
      };

    default:
      throw new Error(`Unknown resolution type: ${resolution}`);
  }
}

// =============================================
// EXPORT SNAPSHOT UPDATE
// =============================================

/**
 * Update stored QB invoice tracking data after a successful sync
 * Called after creating or updating an invoice
 */
export async function updateQBInvoiceSnapshot(
  orderId: number,
  qbInvoice: QBInvoice
): Promise<void> {
  const snapshot = parseQBInvoiceSnapshot(qbInvoice);

  await qbInvoiceRepo.updateOrderInvoiceRecordFull(orderId, {
    qb_invoice_sync_token: snapshot.syncToken,
    qb_invoice_last_updated_time: snapshot.lastUpdatedTime,
    qb_invoice_content_hash: snapshot.contentHash
  });
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
 * Sync QB invoice line items back to order_parts (INVOICE side only).
 * Updates: qb_description, quantity, unit_price, extended_price
 * Does NOT touch: specifications, specs_qty, product_type, etc. (SPECS side)
 *
 * Matches by position (line number). If line counts differ, syncs what we can
 * and returns warnings for mismatches.
 */
export async function syncQBLinesToOrderParts(
  orderId: number,
  qbLines: QBLineItemSnapshot[]
): Promise<SyncBackResult> {
  const { query } = await import('../config/database');

  console.log(`[QB Sync] Starting sync for order ${orderId} with ${qbLines.length} QB lines`);

  // Get current order parts ordered by part_number
  const orderParts = await query(
    `SELECT part_id, part_number, qb_item_name, qb_description, quantity, unit_price, extended_price
     FROM order_parts
     WHERE order_id = ?
     ORDER BY part_number ASC`,
    [orderId]
  ) as any[];

  console.log(`[QB Sync] Found ${orderParts.length} order parts in database`);

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
      result.warnings.push(`Part #${orderPart.part_number} exists in order but not in QB invoice`);
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
      // Quantity (numeric comparison to avoid 1 !== 1.00 false positives)
      if (qbLine.quantity !== null && Math.abs((Number(orderPart.quantity) || 0) - (Number(qbLine.quantity) || 0)) > 0.001) {
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
        console.log(`[QB Sync] Updating part ${orderPart.part_id} (part_number ${orderPart.part_number}): ${updates.join(', ')}`);
        values.push(orderPart.part_id);
        await query(
          `UPDATE order_parts SET ${updates.join(', ')} WHERE part_id = ?`,
          values
        );
        result.updatedCount++;
      } else {
        console.log(`[QB Sync] Part ${orderPart.part_id} (part_number ${orderPart.part_number}): no changes needed`);
      }
    }
  }

  if (result.addedInQB > 0) {
    result.warnings.push(`${result.addedInQB} line(s) in QB invoice are not in order parts - manual reconciliation needed`);
  }
  if (result.removedInQB > 0) {
    result.warnings.push(`${result.removedInQB} order part(s) not in QB invoice - specs preserved but invoice data may be stale`);
  }

  return result;
}
