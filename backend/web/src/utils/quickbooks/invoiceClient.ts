/**
 * QuickBooks Invoice Client
 * Phase 2.e: QB Invoice Automation
 * Created: 2025-12-13
 *
 * Handles authenticated API calls for Invoice and Payment operations
 */

import { makeQBApiCall, queryQB, APIError } from './apiClient';
import { QBInvoicePayload, QBPaymentPayload, QBInvoice, QBPayment } from '../../types/qbInvoice';

// =============================================
// CONFIGURATION
// =============================================

const QB_API_BASE_URL = 'https://quickbooks.api.intuit.com/v3/company';
const QB_ENVIRONMENT = process.env.QB_ENVIRONMENT || 'sandbox';

// =============================================
// INVOICE OPERATIONS
// =============================================

/**
 * Create invoice in QuickBooks
 */
export async function createQBInvoice(
  invoicePayload: QBInvoicePayload,
  realmId: string
): Promise<{ invoiceId: string; docNumber: string }> {
  console.log('📝 Creating invoice in QuickBooks...');

  // Log the actual API call being made
  console.log('\n🌐 QUICKBOOKS API CALL:');
  console.log('=======================');
  console.log(`Endpoint: POST /v3/company/${realmId}/invoice`);
  console.log(`Environment: ${QB_ENVIRONMENT}`);
  console.log(`Customer: ${invoicePayload.CustomerRef.name || invoicePayload.CustomerRef.value}`);
  console.log(`Line Items Count: ${invoicePayload.Line.length}`);
  console.log('=======================\n');

  const response = await makeQBApiCall('POST', 'invoice', realmId, {
    data: invoicePayload,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const invoice = response.Invoice;
  if (!invoice || !invoice.Id) {
    throw new APIError('Invoice creation returned no ID');
  }

  console.log(`✅ Invoice created: ID=${invoice.Id}, Doc#=${invoice.DocNumber}`);

  return {
    invoiceId: invoice.Id,
    docNumber: invoice.DocNumber,
  };
}

/**
 * Update existing invoice in QuickBooks
 * Requires SyncToken from the current invoice for optimistic locking
 */
export async function updateQBInvoice(
  invoiceId: string,
  invoicePayload: QBInvoicePayload & { SyncToken: string },
  realmId: string
): Promise<{ invoiceId: string; docNumber: string }> {
  console.log(`📝 Updating invoice ${invoiceId} in QuickBooks...`);

  // Add the Id to the payload for sparse update
  const updatePayload = {
    ...invoicePayload,
    Id: invoiceId,
    sparse: true, // Sparse update - only update provided fields
  };

  console.log('\n🌐 QUICKBOOKS API CALL:');
  console.log('=======================');
  console.log(`Endpoint: POST /v3/company/${realmId}/invoice?operation=update`);
  console.log(`Invoice ID: ${invoiceId}`);
  console.log(`SyncToken: ${invoicePayload.SyncToken}`);
  console.log('=======================\n');

  const response = await makeQBApiCall('POST', 'invoice', realmId, {
    data: updatePayload,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const invoice = response.Invoice;
  if (!invoice || !invoice.Id) {
    throw new APIError('Invoice update returned no ID');
  }

  console.log(`✅ Invoice updated: ID=${invoice.Id}, Doc#=${invoice.DocNumber}`);

  return {
    invoiceId: invoice.Id,
    docNumber: invoice.DocNumber,
  };
}

/**
 * Get invoice details from QuickBooks
 * Returns full invoice including balance and payment link
 */
export async function getQBInvoice(
  invoiceId: string,
  realmId: string,
  includePaymentLink: boolean = true
): Promise<QBInvoice & { InvoiceLink?: string }> {
  console.log(`📋 Fetching invoice ${invoiceId} from QuickBooks...`);

  // Include invoiceLink to get the customer-facing payment URL
  // minorversion 65+ is required for invoiceLink feature
  const params = includePaymentLink
    ? { include: 'invoiceLink', minorversion: '65' }
    : { minorversion: '65' };

  const response = await makeQBApiCall('GET', `invoice/${invoiceId}`, realmId, { params });

  const invoice = response.Invoice;
  if (!invoice) {
    throw new APIError(`Invoice ${invoiceId} not found`);
  }

  console.log(`✅ Invoice fetched: Doc#=${invoice.DocNumber}, Balance=$${invoice.Balance}`);
  if (invoice.InvoiceLink) {
    console.log(`🔗 Payment link: ${invoice.InvoiceLink}`);
  } else {
    console.log(`⚠️  No payment link returned - ensure invoice has email and payments are enabled in QB`);
  }

  return invoice as QBInvoice & { InvoiceLink?: string };
}

/**
 * Query invoice by document number
 * Used for linking existing invoices
 */
export async function queryQBInvoiceByDocNumber(
  docNumber: string,
  realmId: string
): Promise<QBInvoice | null> {
  if (!docNumber || !docNumber.trim()) {
    console.error('❌ Document number cannot be empty');
    return null;
  }

  try {
    const safeDocNumber = docNumber.replace(/'/g, "\\'");
    const query = `SELECT * FROM Invoice WHERE DocNumber = '${safeDocNumber}' MAXRESULTS 1`;

    console.log(`🔍 Looking up QB invoice: "${docNumber}"`);
    const response = await queryQB(query, realmId);

    const invoices = response?.QueryResponse?.Invoice || [];
    if (invoices.length > 0) {
      const invoice = invoices[0];
      console.log(`✅ Found QB Invoice: ID=${invoice.Id}, Doc#=${invoice.DocNumber}`);
      return invoice as QBInvoice;
    }

    console.log(`⚠️  Invoice "${docNumber}" not found in QuickBooks`);
    return null;
  } catch (error) {
    console.error('❌ Error looking up invoice:', error);
    return null;
  }
}

/**
 * Query invoice by QB Invoice ID
 * Returns null if not found (useful for validation)
 */
export async function queryQBInvoiceById(
  invoiceId: string,
  realmId: string
): Promise<QBInvoice | null> {
  try {
    return await getQBInvoice(invoiceId, realmId);
  } catch (error) {
    if (error instanceof APIError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

// =============================================
// PAYMENT OPERATIONS
// =============================================

/**
 * Create payment in QuickBooks
 * Links payment to a specific invoice
 */
export async function createQBPayment(
  paymentPayload: QBPaymentPayload,
  realmId: string
): Promise<{ paymentId: string }> {
  console.log('💳 Creating payment in QuickBooks...');

  console.log('\n🌐 QUICKBOOKS API CALL:');
  console.log('=======================');
  console.log(`Endpoint: POST /v3/company/${realmId}/payment`);
  console.log(`Amount: $${paymentPayload.TotalAmt}`);
  console.log(`Customer: ${paymentPayload.CustomerRef.value}`);
  console.log('=======================\n');

  const response = await makeQBApiCall('POST', 'payment', realmId, {
    data: paymentPayload,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const payment = response.Payment;
  if (!payment || !payment.Id) {
    throw new APIError('Payment creation returned no ID');
  }

  console.log(`✅ Payment created: ID=${payment.Id}`);

  return {
    paymentId: payment.Id,
  };
}

/**
 * Get payments for a specific invoice
 * Queries payments that are linked to the given invoice
 */
export async function getQBPaymentsForInvoice(
  invoiceId: string,
  realmId: string
): Promise<QBPayment[]> {
  console.log(`📋 Fetching payments for invoice ${invoiceId}...`);

  try {
    // Query payments that have this invoice in their LinkedTxn
    const query = `SELECT * FROM Payment WHERE Line.LinkedTxn.TxnId = '${invoiceId}'`;
    const response = await queryQB(query, realmId);

    const payments = response?.QueryResponse?.Payment || [];
    console.log(`✅ Found ${payments.length} payment(s) for invoice ${invoiceId}`);

    return payments as QBPayment[];
  } catch (error) {
    console.error('❌ Error fetching payments:', error);
    return [];
  }
}

// =============================================
// PDF OPERATIONS
// =============================================

/**
 * Download invoice PDF from QuickBooks
 * Returns the PDF as a Buffer for serving to clients
 */
export async function getQBInvoicePdf(
  invoiceId: string,
  realmId: string
): Promise<Buffer> {
  console.log(`📄 Downloading PDF for invoice ${invoiceId}...`);

  const { quickbooksOAuthRepository } = await import('../../repositories/quickbooksOAuthRepository');
  const { refreshAccessToken } = await import('./oauthClient');

  // Get active access token
  let tokenData = await quickbooksOAuthRepository.getActiveTokens(realmId);

  if (!tokenData) {
    console.log(`⚠️  No active access token for Realm ${realmId}. Attempting refresh...`);
    await refreshAccessToken(realmId);
    tokenData = await quickbooksOAuthRepository.getActiveTokens(realmId);
  }

  if (!tokenData) {
    throw new APIError('No active access token available for PDF download');
  }

  const url = `${QB_API_BASE_URL}/${realmId}/invoice/${invoiceId}/pdf`;

  try {
    const axios = (await import('axios')).default;
    const response = await axios.get<ArrayBuffer>(url, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/pdf',
      },
      responseType: 'arraybuffer',
    });

    const data = response.data as ArrayBuffer;
    console.log(`✅ PDF downloaded: ${data.byteLength} bytes`);
    return Buffer.from(data);
  } catch (error: any) {
    const status = error.response?.status;
    console.error(`❌ PDF download failed (${status}):`, error.message);
    throw new APIError(`Failed to download invoice PDF: ${error.message}`, status);
  }
}

// =============================================
// URL HELPERS
// =============================================

/**
 * Get invoice admin URL (FALLBACK ONLY)
 * Returns the QuickBooks admin dashboard URL - requires QB login
 * Prefer using InvoiceLink from getQBInvoice() for customer-facing payment links
 */
export function getInvoiceWebUrl(invoiceId: string): string {
  return `https://qbo.intuit.com/app/invoice?txnId=${invoiceId}`;
}

/**
 * Get invoice PDF API URL
 * Returns the QuickBooks API endpoint for server-to-server PDF downloads
 * DO NOT use for user-facing links (requires Bearer token auth)
 */
export function getInvoicePdfApiUrl(invoiceId: string, realmId: string): string {
  return `${QB_API_BASE_URL}/${realmId}/invoice/${invoiceId}/pdf`;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Build payment payload for recording a payment against an invoice
 */
export function buildPaymentPayload(
  customerId: string,
  invoiceId: string,
  amount: number,
  paymentDate: string,
  options: {
    paymentMethodRef?: string;
    referenceNumber?: string;
    memo?: string;
  } = {}
): QBPaymentPayload {
  const payload: QBPaymentPayload = {
    CustomerRef: { value: customerId },
    TotalAmt: amount,
    TxnDate: paymentDate,
    Line: [
      {
        Amount: amount,
        LinkedTxn: [
          {
            TxnId: invoiceId,
            TxnType: 'Invoice',
          },
        ],
      },
    ],
  };

  if (options.paymentMethodRef) {
    payload.PaymentMethodRef = { value: options.paymentMethodRef };
  }

  if (options.referenceNumber) {
    payload.PaymentRefNum = options.referenceNumber;
  }

  if (options.memo) {
    payload.PrivateNote = options.memo;
  }

  return payload;
}

/**
 * Query open invoices for a customer (invoices with balance > 0)
 * Used for multi-invoice payment selection
 */
export async function queryOpenInvoicesByCustomer(
  qbCustomerId: string,
  realmId: string
): Promise<Array<{
  Id: string;
  DocNumber: string;
  TxnDate: string;
  DueDate?: string;
  TotalAmt: number;
  Balance: number;
  CustomerRef: { value: string; name?: string };
}>> {
  console.log(`🔍 Querying open invoices for QB customer ${qbCustomerId}...`);

  try {
    // Query invoices where customer matches and balance is greater than 0
    const query = `SELECT * FROM Invoice WHERE CustomerRef = '${qbCustomerId}' AND Balance > '0' ORDERBY TxnDate`;
    const response = await queryQB(query, realmId);

    const invoices = response?.QueryResponse?.Invoice || [];
    console.log(`✅ Found ${invoices.length} open invoice(s) for customer ${qbCustomerId}`);

    return invoices;
  } catch (error) {
    console.error('❌ Error querying open invoices:', error);
    throw error;
  }
}

/**
 * Build payment payload for recording a payment against multiple invoices
 * Each invoice gets its own Line entry with the amount to apply
 */
export function buildMultiInvoicePaymentPayload(
  qbCustomerId: string,
  allocations: Array<{ invoiceId: string; amount: number }>,
  paymentDate: string,
  options: {
    paymentMethodRef?: string;
    referenceNumber?: string;
    memo?: string;
  } = {}
): QBPaymentPayload {
  // Calculate total from allocations
  const totalAmount = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);

  const payload: QBPaymentPayload = {
    CustomerRef: { value: qbCustomerId },
    TotalAmt: totalAmount,
    TxnDate: paymentDate,
    Line: allocations.map(alloc => ({
      Amount: alloc.amount,
      LinkedTxn: [
        {
          TxnId: alloc.invoiceId,
          TxnType: 'Invoice' as const,
        },
      ],
    })),
  };

  if (options.paymentMethodRef) {
    payload.PaymentMethodRef = { value: options.paymentMethodRef };
  }

  if (options.referenceNumber) {
    payload.PaymentRefNum = options.referenceNumber;
  }

  if (options.memo) {
    payload.PrivateNote = options.memo;
  }

  console.log(`📝 Built multi-invoice payment payload: $${totalAmount} across ${allocations.length} invoice(s)`);

  return payload;
}
