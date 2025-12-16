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
  buildPaymentPayload
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

    console.log(`✅ QB invoice created: ${docNumber} (ID: ${invoiceId})`);

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

    return {
      exists: true,
      invoiceId: invoiceRecord.qb_invoice_id,
      invoiceNumber: invoiceRecord.qb_invoice_doc_number,
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

    console.log(`✅ Linked QB invoice ${qbInvoice.DocNumber} to order ${orderId}`);

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
  const lineItems: QBLineItem[] = [];

  // First line: Order info
  let memoText = `Order #${orderData.order_number} - ${orderData.order_name}`;
  if (orderData.customer_po?.trim()) {
    memoText += `\nPO #: ${orderData.customer_po}`;
  }
  if (orderData.customer_job_number?.trim()) {
    memoText += `\nJob #: ${orderData.customer_job_number}`;
  }

  lineItems.push({
    DetailType: 'DescriptionOnly',
    Description: memoText
  });

  // Order parts
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

      lineItems.push({
        DetailType: 'SalesItemLineDetail',
        Description: part.qb_description || '',
        Amount: parseFloat(String(part.extended_price || 0)),
        SalesItemLineDetail: {
          ItemRef: {
            value: qbItemId,
            name: part.qb_item_name || part.product_type || 'General Item'
          },
          Qty: parseFloat(String(part.quantity || 1)),
          UnitPrice: parseFloat(String(part.unit_price || 0)),
          TaxCodeRef: { value: taxCodeId }
        }
      });
    }
  }

  // Build payload
  const payload: QBInvoicePayload = {
    CustomerRef: { value: qbCustomerId },
    TxnDate: new Date().toISOString().split('T')[0],
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
