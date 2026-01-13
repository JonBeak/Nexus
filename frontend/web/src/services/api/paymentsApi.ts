// File Clean up Finished: 2026-01-12
import { api } from '../apiClient';

/**
 * Payments API - Multi-Invoice Payment Operations
 * Created: 2025-12-17
 *
 * Handles fetching open invoices and recording payments against multiple invoices
 */

// ========================================
// Types
// ========================================

export interface OpenInvoice {
  invoiceId: string;
  docNumber: string;
  txnDate: string;
  dueDate: string | null;
  totalAmt: number;
  balance: number;
  customerName: string;
  orderNumber?: number;
}

export interface InvoicePaymentAllocation {
  invoiceId: string;
  amount: number;
}

export interface MultiPaymentInput {
  qbCustomerId: string;
  allocations: InvoicePaymentAllocation[];
  paymentDate: string; // YYYY-MM-DD format
  paymentMethod?: string;
  referenceNumber?: string;
  memo?: string;
}

export interface MultiPaymentResult {
  paymentId: string;
  totalAmount: number;
  invoicesUpdated: number;
}

export interface OpenInvoicesResponse {
  qbCustomerId: string;
  invoices: OpenInvoice[];
}

// ========================================
// API Functions
// ========================================

export const paymentsApi = {
  /**
   * Get all open invoices for a customer
   * Returns invoices with balance > 0
   */
  async getOpenInvoices(customerId: number): Promise<OpenInvoicesResponse> {
    const response = await api.get(`/payments/customer/${customerId}/open-invoices`);
    return response.data;
  },

  /**
   * Record a payment against multiple invoices
   * Creates a single payment in QuickBooks that allocates across invoices
   */
  async recordPayment(input: MultiPaymentInput): Promise<MultiPaymentResult> {
    const response = await api.post('/payments', input);
    return response.data;
  },
};
