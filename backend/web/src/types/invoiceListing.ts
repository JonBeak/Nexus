/**
 * Invoice Listing Types
 * Created: 2025-12-17
 *
 * Types for the /invoices page - listing orders with invoice status and cached balances.
 */

// =============================================
// ORDER WITH INVOICE DATA
// =============================================

/**
 * Order data for the invoice listing page
 */
export interface InvoiceListingOrder {
  order_id: number;
  order_number: number;
  order_name: string;
  customer_id: number;
  customer_name: string;
  status: string;
  order_date: string;
  due_date: string | null;

  // Invoice data
  qb_invoice_id: string | null;
  qb_invoice_doc_number: string | null;
  invoice_sent_at: string | null;

  // Cached QB data
  cached_invoice_total: number | null;
  cached_balance: number | null;
  cached_balance_at: string | null;

  // Deposit info
  deposit_required: boolean;
  deposit_paid: boolean; // Derived: deposit_required && cached_balance < cached_invoice_total

  // Cash job flag
  is_cash: boolean;

  // Calculated totals (from order_parts if no cached values)
  calculated_total: number;
}

// =============================================
// FILTERS AND PAGINATION
// =============================================

/**
 * Filters for invoice listing queries
 */
export interface InvoiceFilters {
  // Invoice status filters
  invoiceStatus?: 'all' | 'invoiced' | 'not_invoiced' | 'cash';
  balanceStatus?: 'all' | 'open' | 'paid';
  sentStatus?: 'all' | 'sent' | 'not_sent';
  depositStatus?: 'all' | 'required' | 'paid' | 'not_required';

  // Order filters
  orderStatus?: string;
  customerId?: number;

  // Date range
  dateFrom?: string;
  dateTo?: string;

  // Search
  search?: string;

  // Sorting
  sortBy?: 'order_number' | 'customer_name' | 'order_date' | 'due_date' | 'total' | 'balance' | 'invoice_number';
  sortOrder?: 'asc' | 'desc';

  // Pagination
  page?: number;
  limit?: number;
}

/**
 * Paginated response for invoice listing
 */
export interface InvoiceListingResponse {
  orders: InvoiceListingOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================
// ANALYTICS
// =============================================

/**
 * YTD analytics for the invoices page
 */
export interface InvoiceAnalytics {
  // YTD Sales = sum of all order totals for current year
  ytdTotalSales: number;
  ytdOrderCount: number;

  // Breakdown by invoice status
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

  // Overdue = orders with balance from before current year
  overdue: {
    count: number;
    total: number;
    balance: number;
  };
}

// =============================================
// BALANCE SYNC
// =============================================

/**
 * Result of syncing a single order's balance from QB
 */
export interface BalanceSyncResult {
  orderId: number;
  orderNumber: number;
  qbInvoiceId: string;
  previousBalance: number | null;
  newBalance: number;
  total: number;
  syncedAt: string;
  autoCompleted?: boolean;  // True if order was auto-completed due to balance reaching 0
}

/**
 * Result of batch balance sync
 */
export interface BatchBalanceSyncResult {
  synced: BalanceSyncResult[];
  errors: Array<{
    orderId: number;
    orderNumber: number;
    error: string;
  }>;
  totalSynced: number;
  totalErrors: number;
}
