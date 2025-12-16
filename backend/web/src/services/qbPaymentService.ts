/**
 * QuickBooks Payment Service
 * Created: 2025-12-17
 *
 * Business logic for recording payments against multiple QuickBooks invoices.
 * Supports selecting multiple open invoices and allocating payment amounts.
 */

import {
  queryOpenInvoicesByCustomer,
  buildMultiInvoicePaymentPayload,
  createQBPayment,
  getQBInvoice
} from '../utils/quickbooks/invoiceClient';
import { resolveCustomerId } from '../utils/quickbooks/entityResolver';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import { customerRepository } from '../repositories/customerRepository';
import * as invoiceListingRepo from '../repositories/invoiceListingRepository';
import {
  OpenInvoice,
  MultiPaymentInput,
  MultiPaymentResult
} from '../types/qbInvoice';

// =============================================
// INVOICE QUERIES
// =============================================

/**
 * Get all open invoices for a customer
 * Resolves local customer ID to QB customer, then queries open invoices
 */
export async function getOpenInvoicesForCustomer(customerId: number): Promise<OpenInvoice[]> {
  try {
    // 1. Get customer details
    const customer = await customerRepository.getCustomerById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // 2. Validate QuickBooks name is configured
    const qbName = customer.quickbooks_name || customer.company_name;
    if (!qbName || !qbName.trim()) {
      throw new Error('Customer does not have a QuickBooks name configured');
    }

    // 3. Get QuickBooks realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    // 4. Resolve QB customer ID
    const qbCustomerId = await resolveCustomerId(customerId, qbName, realmId);

    // 5. Query open invoices from QuickBooks
    const qbInvoices = await queryOpenInvoicesByCustomer(qbCustomerId, realmId);

    // 6. Map to our OpenInvoice type
    const openInvoices: OpenInvoice[] = qbInvoices.map(inv => ({
      invoiceId: inv.Id,
      docNumber: inv.DocNumber,
      txnDate: inv.TxnDate,
      dueDate: inv.DueDate || null,
      totalAmt: inv.TotalAmt,
      balance: inv.Balance,
      customerName: inv.CustomerRef.name || qbName
    }));

    console.log(`Found ${openInvoices.length} open invoice(s) for customer ${customerId}`);

    return openInvoices;
  } catch (error) {
    console.error('Error fetching open invoices:', error);
    throw error;
  }
}

/**
 * Get QB customer ID for a local customer
 * Used by the controller to pass to frontend for payment creation
 */
export async function getQBCustomerId(customerId: number): Promise<string> {
  // 1. Get customer details
  const customer = await customerRepository.getCustomerById(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  // 2. Validate QuickBooks name is configured
  const qbName = customer.quickbooks_name || customer.company_name;
  if (!qbName || !qbName.trim()) {
    throw new Error('Customer does not have a QuickBooks name configured');
  }

  // 3. Get QuickBooks realm ID
  const realmId = await quickbooksRepository.getDefaultRealmId();
  if (!realmId) {
    throw new Error('QuickBooks realm ID not configured');
  }

  // 4. Resolve and return QB customer ID
  return await resolveCustomerId(customerId, qbName, realmId);
}

// =============================================
// PAYMENT CREATION
// =============================================

/**
 * Create a payment in QuickBooks that applies to multiple invoices
 */
export async function createMultiInvoicePayment(
  input: MultiPaymentInput
): Promise<MultiPaymentResult> {
  try {
    // 1. Validate input
    if (!input.allocations || input.allocations.length === 0) {
      throw new Error('At least one invoice allocation is required');
    }

    // Validate all amounts are positive
    for (const alloc of input.allocations) {
      if (alloc.amount <= 0) {
        throw new Error('All allocation amounts must be greater than zero');
      }
    }

    // 2. Get QuickBooks realm ID
    const realmId = await quickbooksRepository.getDefaultRealmId();
    if (!realmId) {
      throw new Error('QuickBooks realm ID not configured');
    }

    // 3. Build payment payload
    const paymentPayload = buildMultiInvoicePaymentPayload(
      input.qbCustomerId,
      input.allocations,
      input.paymentDate,
      {
        paymentMethodRef: input.paymentMethod,
        referenceNumber: input.referenceNumber,
        memo: input.memo
      }
    );

    // 4. Create payment in QuickBooks
    const { paymentId } = await createQBPayment(paymentPayload, realmId);

    // 5. Calculate total amount
    const totalAmount = input.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);

    console.log(`Created multi-invoice payment: ${paymentId}, total: $${totalAmount}`);

    // 6. Update cached balances for linked orders
    for (const alloc of input.allocations) {
      try {
        const orderId = await invoiceListingRepo.getOrderIdByQBInvoiceId(alloc.invoiceId);
        if (orderId) {
          // Fetch updated invoice to get new balance
          const updatedInvoice = await getQBInvoice(alloc.invoiceId, realmId);
          await invoiceListingRepo.updateCachedBalance(orderId, updatedInvoice.Balance, updatedInvoice.TotalAmt);
          console.log(`Updated cached balance for order ${orderId}: $${updatedInvoice.Balance}`);
        }
      } catch (error) {
        // Log but don't fail the payment - cache will update on next sync
        console.warn(`Failed to update cached balance for invoice ${alloc.invoiceId}:`, error);
      }
    }

    return {
      paymentId,
      totalAmount,
      invoicesUpdated: input.allocations.length
    };
  } catch (error) {
    console.error('Error creating multi-invoice payment:', error);
    throw error;
  }
}
