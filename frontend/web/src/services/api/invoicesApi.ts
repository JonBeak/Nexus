// File Clean up Started: 2026-01-12
import { api } from '../apiClient';

/**
 * Invoices API - Invoice Listing and Balance Sync Operations
 * Created: 2025-12-17
 */

// ========================================
// Types
// ========================================

export interface InvoiceListingOrder {
  order_id: number;
  order_number: number;
  order_name: string;
  customer_id: number;
  customer_name: string;
  status: string;
  order_date: string;
  due_date: string | null;
  qb_invoice_id: string | null;
  qb_invoice_doc_number: string | null;
  invoice_sent_at: string | null;
  cached_invoice_total: number | null;
  cached_balance: number | null;
  cached_balance_at: string | null;
  deposit_required: boolean;
  deposit_paid: boolean;
  is_cash: boolean;
  calculated_total: number;
}

export interface InvoiceFilters {
  invoiceStatus?: 'all' | 'invoiced' | 'not_invoiced' | 'cash';
  balanceStatus?: 'all' | 'open' | 'paid';
  sentStatus?: 'all' | 'sent' | 'not_sent';
  depositStatus?: 'all' | 'required' | 'paid' | 'not_required';
  orderStatus?: string;
  customerId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: 'order_number' | 'customer_name' | 'order_date' | 'due_date' | 'total' | 'balance' | 'invoice_number';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface InvoiceListingResponse {
  orders: InvoiceListingOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InvoiceAnalytics {
  ytdTotalSales: number;
  ytdOrderCount: number;
  uninvoiced: {
    count: number;
    total: number;
  };
  openInvoices: {
    count: number;
    total: number;
    balance: number;
  };
  paidInvoices: {
    count: number;
    total: number;
  };
  overdue: {
    count: number;
    total: number;
    balance: number;
  };
}

export interface BalanceSyncResult {
  orderId: number;
  orderNumber: number;
  qbInvoiceId: string;
  previousBalance: number | null;
  newBalance: number;
  total: number;
  syncedAt: string;
}

export interface BatchBalanceSyncResult {
  synced: BalanceSyncResult[];
  errors: Array<{ orderId: number; orderNumber: number; error: string }>;
  totalSynced: number;
  totalErrors: number;
}

// ========================================
// API Functions
// ========================================

export const invoicesApi = {
  /**
   * Get paginated invoice listing with filters
   */
  async getListing(filters: InvoiceFilters = {}): Promise<InvoiceListingResponse> {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '' && value !== 'all') {
        params.append(key, String(value));
      }
    });

    const response = await api.get(`/invoices?${params.toString()}`);
    return response.data;
  },

  /**
   * Get invoice analytics for dashboard cards
   */
  async getAnalytics(): Promise<InvoiceAnalytics> {
    const response = await api.get('/invoices/analytics');
    return response.data;
  },

  /**
   * Sync balance for a single order from QuickBooks
   */
  async syncBalance(orderId: number): Promise<BalanceSyncResult> {
    const response = await api.post(`/invoices/${orderId}/sync-balance`);
    return response.data;
  },

  /**
   * Sync balances for multiple orders
   */
  async syncBalancesBatch(orderIds: number[]): Promise<BatchBalanceSyncResult> {
    const response = await api.post('/invoices/sync-balances', { orderIds });
    return response.data;
  },

  /**
   * Sync balances for orders with stale or missing cache
   */
  async syncStaleBalances(limit?: number): Promise<BatchBalanceSyncResult> {
    const response = await api.post('/invoices/sync-stale', { limit });
    return response.data;
  }
};
