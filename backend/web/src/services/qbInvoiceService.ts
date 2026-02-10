/**
 * QuickBooks Invoice Service
 * Phase 2.e: QB Invoice Automation
 * Created: 2025-12-13
 *
 * Business logic for creating and managing QuickBooks invoices from orders.
 * Handles staleness detection, data mapping, and payment recording.
 */

import {
  createQBInvoice,
  updateQBInvoice,
  getQBInvoice,
  queryQBInvoiceByDocNumber,
  createQBPayment,
  buildPaymentPayload,
  queryAllInvoicesByCustomer
} from '../utils/quickbooks/invoiceClient';
import * as qbInvoiceRepo from '../repositories/qbInvoiceRepository';
import * as orderPrepRepo from '../repositories/orderPreparationRepository';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import { calculateOrderDataHash } from '../utils/orderDataHashService';
import { resolveCustomerId, resolveTaxCodeWithFallback } from '../utils/quickbooks/entityResolver';
import {
  InvoiceStalenessResult,
  InvoiceCreationResult,
  InvoiceUpdateResult,
  InvoiceDetailsResult,
  LinkInvoiceResult,
  PaymentInput,
  PaymentResult,
  QBInvoicePayload,
  QBLineItem
} from '../types/qbInvoice';
import { OrderDataForQBEstimate, OrderPartForQBEstimate } from '../types/orderPreparation';
import * as invoiceListingRepo from '../repositories/invoiceListingRepository';
import { updateQBInvoiceSnapshot } from './qbInvoiceComparisonService';
import { broadcastInvoiceUpdated } from '../websocket';

// =============================================
// STALENESS DETECTION
// =============================================

/**
 * Check if the QB invoice is stale (order data changed since invoice was synced)
 */
export async function checkInvoiceStaleness(orderId: number): Promise<InvoiceStalenessResult> {
  try {
    const invoiceRecord = await qbInvoiceRepo.getOrderInvoiceRecord(orderId);

    if (!invoiceRecord || !invoiceRecord.qb_invoice_id) {
      return {
        exists: false,
        isStale: false,
        currentHash: null,
        storedHash: null,
        qbInvoiceId: null,
        qbInvoiceNumber: null,
        syncedAt: null
      };
    }

    // Calculate current hash from order data
    const currentHash = await calculateOrderDataHash(orderId);

    // Compare with stored hash
    const isStale = currentHash !== invoiceRecord.qb_invoice_data_hash;

    return {
      exists: true,
      isStale,
      currentHash,
      storedHash: invoiceRecord.qb_invoice_data_hash,
      qbInvoiceId: invoiceRecord.qb_invoice_id,
      qbInvoiceNumber: invoiceRecord.qb_invoice_doc_number,
      syncedAt: invoiceRecord.qb_invoice_synced_at
    };
  } catch (error) {
    console.error('Error checking QB invoice staleness:', error);
    throw new Error('Failed to check invoice staleness');
  }
}

// =============================================
// INVOICE CREATION
// =============================================

/**
 * Create a QuickBooks invoice from an order
 */
export async function createInvoiceFromOrder(
  orderId: number,
  userId: number
): Promise<InvoiceCreationResult> {
  try {
    // 1. Check if invoice already exists
    const existingRecord = await qbInvoiceRepo.getOrderInvoiceRecord(orderId);
    if (existingRecord?.qb_invoice_id) {
      throw new Error('Invoice already exists for this order. Use update instead.');
    }

    // 2. Get order data
    const orderData = await orderPrepRepo.getOrderDataForQBEstimate(orderId);
    if (!orderData) {
      throw new Error('Order not found');
    }

    // 3. Get order parts (invoice items)
    const orderParts = await orderPrepRepo.getOrderPartsForQBEstimate(orderId);
    if (orderParts.length === 0) {
      throw new Error('No invoice parts found for order');
    }

    // 4. Calculate data hash for staleness tracking
    const dataHash = await calculateOrderDataHash(orderId);

    // 5. Get QuickBooks realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    // 6. Validate QuickBooks name is configured
    if (!orderData.quickbooks_name || !orderData.quickbooks_name.trim()) {
      throw new Error(
        `Customer "${orderData.customer_name}" does not have a QuickBooks name configured. ` +
        `Please edit the customer and set their QuickBooks name.`
      );
    }

    // 7. Resolve QB customer ID
    const qbCustomerId = await resolveCustomerId(
      orderData.customer_id,
      orderData.quickbooks_name,
      realmId
    );

    // 8. Build invoice payload
    const invoicePayload = await buildInvoicePayload(orderData, orderParts, qbCustomerId);

    // 9. Create invoice in QuickBooks
    console.log(`📝 Creating QB invoice for order #${orderData.order_number}...`);
    const { invoiceId, docNumber } = await createQBInvoice(invoicePayload, realmId);

    // 10. Fetch invoice to get the customer payment link
    const invoice = await getQBInvoice(invoiceId, realmId, true);
    // Only use payment link - do NOT fall back to admin URL
    const invoiceUrl = (invoice as any).InvoiceLink || null;
    if (!invoiceUrl) {
      console.warn('⚠️  No payment link returned from QB - customer may need to access invoice through QB directly');
    }

    // 11. Update order with invoice data
    await qbInvoiceRepo.updateOrderInvoiceRecord(orderId, {
      qb_invoice_id: invoiceId,
      qb_invoice_doc_number: docNumber,
      qb_invoice_url: invoiceUrl,
      qb_invoice_synced_at: new Date(),
      qb_invoice_data_hash: dataHash
    });

    // 12. Store QB invoice snapshot for bi-directional sync (Phase 2)
    await updateQBInvoiceSnapshot(orderId, invoice);

    // 13. Cache invoice balance and total
    await invoiceListingRepo.updateCachedBalance(orderId, invoice.Balance, invoice.TotalAmt);

    console.log(`✅ QB invoice created: ${docNumber} (ID: ${invoiceId})`);

    // Broadcast invoice created event for real-time updates
    broadcastInvoiceUpdated(orderId, orderData.order_number, 'created', userId);

    return {
      invoiceId,
      invoiceNumber: docNumber,
      dataHash,
      invoiceUrl
    };
  } catch (error) {
    console.error('Error creating QB invoice from order:', error);
    throw error;
  }
}

// =============================================
// INVOICE UPDATE
// =============================================

/**
 * Update existing QuickBooks invoice with current order data
 */
export async function updateInvoiceFromOrder(
  orderId: number,
  userId: number
): Promise<InvoiceUpdateResult> {
  try {
    // 1. Get existing invoice record
    const invoiceRecord = await qbInvoiceRepo.getOrderInvoiceRecord(orderId);
    if (!invoiceRecord?.qb_invoice_id) {
      throw new Error('No invoice exists for this order. Create one first.');
    }

    // 2. Get realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    // 3. Get current invoice from QB (need SyncToken for update)
    const currentQBInvoice = await getQBInvoice(invoiceRecord.qb_invoice_id, realmId);

    // 4. Get order data
    const orderData = await orderPrepRepo.getOrderDataForQBEstimate(orderId);
    if (!orderData) {
      throw new Error('Order not found');
    }

    // 5. Get order parts
    const orderParts = await orderPrepRepo.getOrderPartsForQBEstimate(orderId);
    if (orderParts.length === 0) {
      throw new Error('No invoice parts found for order');
    }

    // 6. Calculate new hash
    const dataHash = await calculateOrderDataHash(orderId);

    // 7. Resolve QB customer ID
    const qbCustomerId = await resolveCustomerId(
      orderData.customer_id,
      orderData.quickbooks_name!,
      realmId
    );

    // 8. Build updated invoice payload
    const invoicePayload = await buildInvoicePayload(orderData, orderParts, qbCustomerId);

    // 9. Update invoice in QB (add SyncToken)
    console.log(`📝 Updating QB invoice for order #${orderData.order_number}...`);
    const { invoiceId, docNumber } = await updateQBInvoice(
      invoiceRecord.qb_invoice_id,
      { ...invoicePayload, SyncToken: currentQBInvoice.SyncToken },
      realmId
    );

    // 10. Update order record
    await qbInvoiceRepo.updateOrderInvoiceRecord(orderId, {
      qb_invoice_synced_at: new Date(),
      qb_invoice_data_hash: dataHash
    });

    // 11. Fetch updated invoice to cache balance/total and store snapshot
    const updatedInvoice = await getQBInvoice(invoiceId, realmId);
    await invoiceListingRepo.updateCachedBalance(orderId, updatedInvoice.Balance, updatedInvoice.TotalAmt);

    // 12. Store QB invoice snapshot for bi-directional sync (Phase 2)
    await updateQBInvoiceSnapshot(orderId, updatedInvoice);

    console.log(`✅ QB invoice updated: ${docNumber}`);

    return {
      invoiceId,
      invoiceNumber: docNumber,
      dataHash
    };
  } catch (error) {
    console.error('Error updating QB invoice:', error);
    throw error;
  }
}

// =============================================
// INVOICE DETAILS
// =============================================

/**
 * Get invoice details including balance from QuickBooks
 */
export async function getInvoiceDetails(orderId: number): Promise<InvoiceDetailsResult> {
  try {
    const invoiceRecord = await qbInvoiceRepo.getOrderInvoiceRecord(orderId);

    if (!invoiceRecord?.qb_invoice_id) {
      return {
        exists: false,
        invoiceId: null,
        invoiceNumber: null,
        invoiceUrl: null,
        total: null,
        balance: null,
        dueDate: null,
        syncedAt: null,
        sentAt: null
      };
    }

    // Fetch fresh data from QB
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    const qbInvoice = await getQBInvoice(invoiceRecord.qb_invoice_id, realmId);

    // Use payment link from QB if available, otherwise fall back to stored URL
    let invoiceUrl = invoiceRecord.qb_invoice_url;
    const paymentLink = (qbInvoice as any).InvoiceLink;
    if (paymentLink) {
      invoiceUrl = paymentLink;
      // Update stored URL if we got a new payment link
      if (paymentLink !== invoiceRecord.qb_invoice_url) {
        await qbInvoiceRepo.updateOrderInvoiceRecord(orderId, {
          qb_invoice_url: paymentLink
        });
        console.log(`🔗 Updated stored invoice URL to payment link: ${paymentLink}`);
      }
    }

    // Always update cached balance when fetching fresh data from QB
    // This keeps the order object as single source of truth for balance
    await invoiceListingRepo.updateCachedBalance(orderId, qbInvoice.Balance, qbInvoice.TotalAmt);

    // Sync DocNumber if it differs (QB may have auto-generated it)
    const qbDocNumber = qbInvoice.DocNumber;
    let invoiceNumber = invoiceRecord.qb_invoice_doc_number;

    if (qbDocNumber && qbDocNumber !== invoiceRecord.qb_invoice_doc_number) {
      console.log(`📋 Syncing invoice DocNumber: ${invoiceRecord.qb_invoice_doc_number} → ${qbDocNumber}`);
      await qbInvoiceRepo.updateOrderInvoiceRecord(orderId, {
        qb_invoice_doc_number: qbDocNumber
      });
      invoiceNumber = qbDocNumber;
    }

    return {
      exists: true,
      invoiceId: invoiceRecord.qb_invoice_id,
      invoiceNumber,
      invoiceUrl,
      total: qbInvoice.TotalAmt,
      balance: qbInvoice.Balance,
      dueDate: qbInvoice.DueDate || null,
      syncedAt: invoiceRecord.qb_invoice_synced_at,
      sentAt: invoiceRecord.invoice_sent_at
    };
  } catch (error) {
    console.error('Error getting invoice details:', error);
    throw error;
  }
}

// =============================================
// INVOICE LINKING
// =============================================

/**
 * Link an existing QuickBooks invoice to an order
 */
export async function linkExistingInvoice(
  orderId: number,
  qbInvoiceIdOrDocNumber: string,
  userId: number
): Promise<LinkInvoiceResult> {
  try {
    // 1. Get realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    // 2. Look up invoice - try as ID first, then as doc number
    let qbInvoice = await getQBInvoice(qbInvoiceIdOrDocNumber, realmId).catch(() => null);

    if (!qbInvoice) {
      // Try as doc number
      qbInvoice = await queryQBInvoiceByDocNumber(qbInvoiceIdOrDocNumber, realmId);
    }

    if (!qbInvoice) {
      throw new Error(`Invoice "${qbInvoiceIdOrDocNumber}" not found in QuickBooks`);
    }

    // 3. Check if this invoice is already linked to another order
    const isLinked = await qbInvoiceRepo.isInvoiceLinkedToAnotherOrder(qbInvoice.Id, orderId);
    if (isLinked) {
      throw new Error('This invoice is already linked to another order');
    }

    // 4. Get invoice URL - only use payment link, not admin URL
    const invoiceUrl = (qbInvoice as any).InvoiceLink || null;
    if (!invoiceUrl) {
      console.warn('⚠️  No payment link returned from QB when linking invoice');
    }

    // 5. Calculate current hash (for staleness tracking going forward)
    const dataHash = await calculateOrderDataHash(orderId);

    // 6. Update order with invoice data
    await qbInvoiceRepo.updateOrderInvoiceRecord(orderId, {
      qb_invoice_id: qbInvoice.Id,
      qb_invoice_doc_number: qbInvoice.DocNumber,
      qb_invoice_url: invoiceUrl,
      qb_invoice_synced_at: new Date(),
      qb_invoice_data_hash: dataHash
    });

    // 7. Store QB invoice snapshot for bi-directional sync (Phase 2)
    await updateQBInvoiceSnapshot(orderId, qbInvoice);

    // 8. Cache invoice balance and total
    await invoiceListingRepo.updateCachedBalance(orderId, qbInvoice.Balance, qbInvoice.TotalAmt);

    console.log(`✅ Linked QB invoice ${qbInvoice.DocNumber} to order ${orderId}`);

    // Broadcast invoice linked event for real-time updates
    const orderData = await orderPrepRepo.getOrderDataForQBEstimate(orderId);
    if (orderData) {
      broadcastInvoiceUpdated(orderId, orderData.order_number, 'linked', userId);
    }

    return {
      invoiceId: qbInvoice.Id,
      invoiceNumber: qbInvoice.DocNumber,
      invoiceUrl
    };
  } catch (error) {
    console.error('Error linking invoice:', error);
    throw error;
  }
}

/**
 * Unlink invoice from order - clears all invoice fields
 * Returns previous invoice info for audit/display purposes
 */
export async function unlinkInvoice(
  orderId: number,
  userId: number
): Promise<{ previousInvoiceId: string | null; previousInvoiceNumber: string | null }> {
  try {
    // Get current invoice info before unlinking (for return value)
    const currentRecord = await qbInvoiceRepo.getOrderInvoiceRecord(orderId);
    const previousInvoiceId = currentRecord?.qb_invoice_id || null;
    const previousInvoiceNumber = currentRecord?.qb_invoice_doc_number || null;

    // Clear all invoice fields
    await qbInvoiceRepo.unlinkInvoiceFromOrder(orderId);

    console.log(`✅ Unlinked invoice ${previousInvoiceNumber || previousInvoiceId || '(none)'} from order ${orderId}`);

    // Broadcast invoice unlinked event for real-time updates
    const orderData = await orderPrepRepo.getOrderDataForQBEstimate(orderId);
    if (orderData) {
      broadcastInvoiceUpdated(orderId, orderData.order_number, 'unlinked', userId);
    }

    return {
      previousInvoiceId,
      previousInvoiceNumber
    };
  } catch (error) {
    console.error('Error unlinking invoice:', error);
    throw error;
  }
}

/**
 * Verify if the linked invoice still exists in QuickBooks
 * Returns status and invoice details if found
 */
export async function verifyLinkedInvoice(
  orderId: number
): Promise<{
  exists: boolean;
  status: 'exists' | 'not_found' | 'error' | 'not_linked';
  invoiceId: string | null;
  invoiceNumber: string | null;
  errorMessage?: string;
}> {
  try {
    // Get current invoice record
    const invoiceRecord = await qbInvoiceRepo.getOrderInvoiceRecord(orderId);

    if (!invoiceRecord?.qb_invoice_id) {
      return {
        exists: false,
        status: 'not_linked',
        invoiceId: null,
        invoiceNumber: null
      };
    }

    // Get realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      return {
        exists: false,
        status: 'error',
        invoiceId: invoiceRecord.qb_invoice_id,
        invoiceNumber: invoiceRecord.qb_invoice_doc_number,
        errorMessage: 'QuickBooks realm ID not configured'
      };
    }

    // Try to fetch from QB
    try {
      await getQBInvoice(invoiceRecord.qb_invoice_id, realmId);
      return {
        exists: true,
        status: 'exists',
        invoiceId: invoiceRecord.qb_invoice_id,
        invoiceNumber: invoiceRecord.qb_invoice_doc_number
      };
    } catch (error: any) {
      if (error.statusCode === 404 || error.message?.includes('not found')) {
        return {
          exists: false,
          status: 'not_found',
          invoiceId: invoiceRecord.qb_invoice_id,
          invoiceNumber: invoiceRecord.qb_invoice_doc_number,
          errorMessage: 'Invoice was deleted in QuickBooks'
        };
      }
      // Other QB API error (connection, auth, etc.)
      return {
        exists: false,
        status: 'error',
        invoiceId: invoiceRecord.qb_invoice_id,
        invoiceNumber: invoiceRecord.qb_invoice_doc_number,
        errorMessage: error.message || 'Failed to verify invoice'
      };
    }
  } catch (error: any) {
    console.error('Error verifying linked invoice:', error);
    return {
      exists: false,
      status: 'error',
      invoiceId: null,
      invoiceNumber: null,
      errorMessage: error.message || 'Failed to verify invoice'
    };
  }
}

// =============================================
// PAYMENT RECORDING
// =============================================

/**
 * Record a payment against the order's invoice
 */
export async function recordPayment(
  orderId: number,
  paymentData: PaymentInput,
  userId: number
): Promise<PaymentResult> {
  try {
    // 1. Get invoice record
    const invoiceRecord = await qbInvoiceRepo.getOrderInvoiceRecord(orderId);
    if (!invoiceRecord?.qb_invoice_id) {
      throw new Error('No invoice exists for this order');
    }

    // 2. Get realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    // 3. Get invoice from QB to get customer ID
    const qbInvoice = await getQBInvoice(invoiceRecord.qb_invoice_id, realmId);

    // 4. Build payment payload
    const paymentPayload = buildPaymentPayload(
      qbInvoice.CustomerRef.value,
      invoiceRecord.qb_invoice_id,
      paymentData.amount,
      paymentData.paymentDate,
      {
        referenceNumber: paymentData.referenceNumber,
        memo: paymentData.memo
        // Note: paymentMethodRef would need QB payment method ID lookup
      }
    );

    // 5. Create payment in QB
    console.log(`💳 Recording payment of $${paymentData.amount} for order ${orderId}...`);
    const { paymentId } = await createQBPayment(paymentPayload, realmId);

    // 6. Fetch updated invoice to get new balance
    const updatedInvoice = await getQBInvoice(invoiceRecord.qb_invoice_id, realmId);

    console.log(`✅ Payment recorded: ID=${paymentId}, New Balance=$${updatedInvoice.Balance}`);

    // Broadcast invoice payment event for real-time updates
    const orderData = await orderPrepRepo.getOrderDataForQBEstimate(orderId);
    if (orderData) {
      broadcastInvoiceUpdated(orderId, orderData.order_number, 'payment', userId);
    }

    return {
      paymentId,
      newBalance: updatedInvoice.Balance
    };
  } catch (error) {
    console.error('Error recording payment:', error);
    throw error;
  }
}

// =============================================
// INVOICE LINE ITEMS PREVIEW
// =============================================

/**
 * Invoice line item for preview
 * Single source of truth for line item formatting (used by both preview and creation)
 */
export interface InvoicePreviewLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  isHeaderRow: boolean;
  qbItemName: string | null;
  isDescriptionOnly: boolean;
  isDefaultDescription?: boolean;
}

/**
 * Build invoice line items for preview or creation
 * Single source of truth for line item formatting - ensures preview matches actual QB invoice
 */
export async function buildInvoiceLineItems(orderId: number): Promise<InvoicePreviewLineItem[]> {
  const orderParts = await orderPrepRepo.getOrderPartsForQBEstimate(orderId);

  return orderParts
    .filter(part => {
      // Description-only lines are included even without quantity
      const hasDescription = part.qb_description?.trim();
      const hasNoQBItem = !part.qb_item_name?.trim();
      const hasNoPrice = !part.unit_price || part.unit_price === 0;
      const isDescriptionOnly = hasDescription && hasNoQBItem && hasNoPrice;

      // Include description-only lines OR lines with quantity
      return isDescriptionOnly || (part.quantity && part.quantity > 0);
    })
    .map(part => {
      const hasDescription = part.qb_description?.trim();
      const hasNoQBItem = !part.qb_item_name?.trim();
      const hasNoPrice = !part.unit_price || part.unit_price === 0;
      const isDescriptionOnly = !!(hasDescription && hasNoQBItem && hasNoPrice);

      const qty = parseFloat(String(part.quantity || 1));
      const unitPrice = parseFloat(String(part.unit_price || 0));
      const calculatedAmount = Math.round(qty * unitPrice * 100) / 100;

      return {
        description: part.qb_description || '',  // Same logic as buildInvoicePayload - NO fallback!
        quantity: qty,
        unitPrice: unitPrice,
        amount: calculatedAmount,
        isHeaderRow: false, // Header rows are filtered by the query (no invoice_description, qb_description, or unit_price)
        qbItemName: part.qb_item_name || null,
        isDescriptionOnly
      };
    });
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Build QB invoice payload from order data
 * Similar to estimate mapping but for invoices
 */
async function buildInvoicePayload(
  orderData: OrderDataForQBEstimate,
  orderParts: OrderPartForQBEstimate[],
  qbCustomerId: string
): Promise<QBInvoicePayload> {
  // Get QB item mappings
  const qbItemNames = [...new Set(orderParts.map(p => p.qb_item_name).filter(Boolean))] as string[];
  const itemMappings = await quickbooksRepository.getBatchQBItemMappings(qbItemNames);

  // Resolve tax code
  const { taxCodeId, taxName } = await resolveTaxCodeWithFallback(orderData.tax_name);

  // Get point person email for BillEmail (required for payment link)
  const pointPersons = await orderPrepRepo.getOrderPointPersons(orderData.order_number);
  const primaryEmail = pointPersons.length > 0 ? pointPersons[0].contact_email : null;

  // Build line items
  // NOTE: Header row is now stored in order_parts (is_header_row=true, part_number=0)
  // It's included in orderParts from the query (sorted by part_number), so we iterate all parts
  // This ensures 1:1 mapping between order_parts and QB invoice lines
  const lineItems: QBLineItem[] = [];

  // Order parts (includes header row as first item)
  for (const part of orderParts) {
    const hasDescription = part.qb_description?.trim();
    const hasNoQBItem = !part.qb_item_name?.trim();
    const hasNoPrice = !part.unit_price || part.unit_price === 0;
    const isDescriptionOnly = hasDescription && hasNoQBItem && hasNoPrice;

    if (isDescriptionOnly) {
      lineItems.push({
        DetailType: 'DescriptionOnly',
        Description: part.qb_description || ''
      });
    } else {
      const mapping = itemMappings.get(part.qb_item_name?.toLowerCase() || '');
      const qbItemId = mapping?.qb_item_id || '1';

      // Calculate Amount from Qty * UnitPrice to ensure QB validation passes
      // QB requires Amount === Qty * UnitPrice exactly
      const qty = parseFloat(String(part.quantity || 1));
      const unitPrice = parseFloat(String(part.unit_price || 0));
      const calculatedAmount = Math.round(qty * unitPrice * 100) / 100; // Round to 2 decimals

      lineItems.push({
        DetailType: 'SalesItemLineDetail',
        Description: part.qb_description || '',
        Amount: calculatedAmount,
        SalesItemLineDetail: {
          ItemRef: {
            value: qbItemId,
            name: part.qb_item_name || part.product_type || 'General Item'
          },
          Qty: qty,
          UnitPrice: unitPrice,
          TaxCodeRef: { value: taxCodeId }
        }
      });
    }
  }

  // Build payload
  // Get today's date in local timezone
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const payload: QBInvoicePayload = {
    CustomerRef: { value: qbCustomerId },
    TxnDate: todayStr,
    Line: lineItems,
    TxnTaxDetail: {
      TxnTaxCodeRef: { value: taxCodeId, name: taxName }
    },
    // Enable online payments - REQUIRED for QB to generate a payment link
    AllowOnlineCreditCardPayment: true,
    AllowOnlineACHPayment: true
  };

  // Add BillEmail if we have a point person email (required for payment link)
  if (primaryEmail) {
    payload.BillEmail = { Address: primaryEmail };
    console.log(`📧 Setting invoice BillEmail to: ${primaryEmail}`);
  } else {
    console.warn('⚠️  No point person email found - invoice may not get a payment link');
  }

  return payload;
}

/**
 * Mark invoice as sent (update invoice_sent_at timestamp)
 */
export async function markInvoiceSent(orderId: number): Promise<void> {
  await qbInvoiceRepo.updateOrderInvoiceRecord(orderId, {
    invoice_sent_at: new Date()
  });
}

// =============================================
// INVOICE SEARCH
// =============================================

export interface InvoiceSearchResult {
  found: boolean;
  invoiceId: string | null;
  docNumber: string | null;
  customerName: string | null;
  total: number | null;
  balance: number | null;
  txnDate: string | null;
  alreadyLinked: boolean;
  linkedOrderNumber: number | null;
}

/**
 * Search for a QB invoice by document number or ID (for preview before linking)
 */
export async function searchInvoice(
  searchValue: string,
  searchType: 'docNumber' | 'id'
): Promise<InvoiceSearchResult> {
  try {
    // 1. Get realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    // 2. Look up invoice in QB
    let qbInvoice: any = null;

    if (searchType === 'id') {
      qbInvoice = await getQBInvoice(searchValue, realmId).catch(() => null);
    } else {
      // Search by doc number
      qbInvoice = await queryQBInvoiceByDocNumber(searchValue, realmId).catch(() => null);
    }

    if (!qbInvoice) {
      return {
        found: false,
        invoiceId: null,
        docNumber: null,
        customerName: null,
        total: null,
        balance: null,
        txnDate: null,
        alreadyLinked: false,
        linkedOrderNumber: null
      };
    }

    // 3. Check if this invoice is already linked to an order
    const linkedOrder = await qbInvoiceRepo.getOrderByQbInvoiceId(qbInvoice.Id);

    return {
      found: true,
      invoiceId: qbInvoice.Id,
      docNumber: qbInvoice.DocNumber,
      customerName: qbInvoice.CustomerRef?.name || null,
      total: qbInvoice.TotalAmt,
      balance: qbInvoice.Balance,
      txnDate: qbInvoice.TxnDate || null,
      alreadyLinked: !!linkedOrder,
      linkedOrderNumber: linkedOrder?.order_number || null
    };
  } catch (error) {
    console.error('Error searching QB invoice:', error);
    throw new Error('Failed to search invoice in QuickBooks');
  }
}

// =============================================
// CUSTOMER INVOICE LISTING
// =============================================

export interface CustomerInvoiceListItem {
  invoiceId: string;
  docNumber: string;
  customerName: string | null;
  total: number;
  balance: number;
  txnDate: string | null;
  isOpen: boolean;
  /** If linked to another order, the order number */
  linkedToOrderNumber?: number;
  /** If linked to another order, the order name */
  linkedToOrderName?: string;
}

export interface CustomerInvoiceListResult {
  invoices: CustomerInvoiceListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * List all QB invoices for the customer associated with an order
 * Returns open invoices first, then closed, excluding already-linked invoices
 */
export async function listCustomerInvoicesForLinking(
  orderId: number,
  page: number = 1,
  pageSize: number = 10
): Promise<CustomerInvoiceListResult> {
  try {
    // 1. Get realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    // 2. Get order data to find customer's QB ID
    const orderData = await orderPrepRepo.getOrderDataForQBEstimate(orderId);
    if (!orderData) {
      throw new Error('Order not found');
    }

    if (!orderData.quickbooks_name) {
      throw new Error('Customer does not have a QuickBooks name configured');
    }

    // 3. Resolve QB customer ID
    const { resolveCustomerId } = await import('../utils/quickbooks/entityResolver');
    const qbCustomerId = await resolveCustomerId(
      orderData.customer_id,
      orderData.quickbooks_name,
      realmId
    );

    // 4. Query all invoices for this customer from QB
    const qbInvoices = await queryAllInvoicesByCustomer(qbCustomerId, realmId);

    // 5. Get linked invoice details (invoice ID -> order info) excluding current order
    const linkedInvoiceDetails = await qbInvoiceRepo.getLinkedInvoiceDetails(orderId);

    // 6. Transform all invoices (including linked ones, with their linked info)
    const availableInvoices: CustomerInvoiceListItem[] = qbInvoices
      .map(inv => {
        const linkedInfo = linkedInvoiceDetails.get(inv.Id);
        return {
          invoiceId: inv.Id,
          docNumber: inv.DocNumber,
          customerName: inv.CustomerRef?.name || null,
          total: inv.TotalAmt,
          balance: inv.Balance,
          txnDate: inv.TxnDate || null,
          isOpen: inv.Balance > 0,
          linkedToOrderNumber: linkedInfo?.orderNumber,
          linkedToOrderName: linkedInfo?.orderName
        };
      });

    // 7. Sort: open invoices first, then closed (all by date desc) - linked invoices mixed in
    availableInvoices.sort((a, b) => {
      // Open invoices come first
      if (a.isOpen !== b.isOpen) {
        return a.isOpen ? -1 : 1;
      }

      // Within same category, sort by date descending (newest first)
      const dateA = a.txnDate || '';
      const dateB = b.txnDate || '';
      return dateB.localeCompare(dateA);
    });

    // 8. Paginate
    const totalCount = availableInvoices.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const pagedInvoices = availableInvoices.slice(startIndex, startIndex + pageSize);

    return {
      invoices: pagedInvoices,
      totalCount,
      page,
      pageSize,
      totalPages
    };
  } catch (error) {
    console.error('Error listing customer invoices:', error);
    throw error;
  }
}
