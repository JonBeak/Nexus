import { api } from '../../apiClient';

/**
 * QB Invoice API - QuickBooks Invoice Operations
 * Handles invoice creation, updates, payments, and email operations
 */

export interface InvoiceDetails {
  qbInvoiceId: string;
  docNumber: string;
  invoiceUrl: string;
  total: number;
  balance: number;
  customerName: string;
  txnDate: string;
  dueDate: string;
  status: string;
  syncedAt: string;
}

/**
 * Invoice line item for preview
 * Matches backend InvoicePreviewLineItem - single source of truth
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

export interface InvoiceStalenessResult {
  exists: boolean;
  isStale: boolean;
  currentHash: string | null;
  storedHash: string | null;
}

// Phase 2: Bi-directional sync types
export type InvoiceSyncStatus = 'in_sync' | 'local_stale' | 'qb_modified' | 'conflict' | 'not_found' | 'error';
export type ConflictResolution = 'use_local' | 'use_qb' | 'keep_both';

export interface InvoiceDifference {
  type: 'added' | 'removed' | 'modified';
  lineNumber: number;
  field: 'description' | 'quantity' | 'unitPrice' | 'amount' | 'item';
  localValue?: string | number;
  qbValue?: string | number;
}

export interface InvoiceSyncResult {
  status: InvoiceSyncStatus;
  localChanged: boolean;
  qbChanged: boolean;

  // Timestamps
  localSyncedAt: string | null;
  qbLastUpdatedAt: string | null;

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

export interface PaymentInput {
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  memo?: string;
}

export interface PaymentResult {
  paymentId: string;
  newBalance: number;
}

export interface EmailInput {
  recipientEmails: string[];
  ccEmails?: string[];
  bccEmails?: string[];
  subject: string;
  body: string;
  attachInvoicePdf?: boolean;
}

export interface ScheduledEmailInput extends EmailInput {
  scheduledFor: string;
}

export interface ScheduledEmail {
  id: number;
  orderId: number;
  emailType: string;
  recipientEmails: string[];
  ccEmails: string[] | null;
  subject: string;
  body: string;
  scheduledFor: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface EmailPreview {
  subject: string;
  body: string;
  variables: Record<string, string>;
}

export const qbInvoiceApi = {
  // ========================================
  // Invoice Operations
  // ========================================

  /**
   * Get invoice line items preview for create/update modal
   * Returns the exact line items that will be created in QuickBooks
   * Single source of truth - ensures preview matches actual invoice
   */
  async getInvoicePreview(orderNumber: number): Promise<InvoicePreviewLineItem[]> {
    const response = await api.get(`/orders/${orderNumber}/invoice-preview`);
    return response.data.lineItems;
  },

  /**
   * Create a new invoice in QuickBooks from order data
   */
  async createInvoice(orderNumber: number): Promise<{
    invoiceId: string;
    invoiceNumber: string;
    invoiceUrl: string;
    dataHash: string;
  }> {
    const response = await api.post(`/orders/${orderNumber}/qb-invoice`);
    return response.data;
  },

  /**
   * Update an existing invoice in QuickBooks with current order data
   */
  async updateInvoice(orderNumber: number): Promise<{
    invoiceId: string;
    invoiceNumber: string;
    invoiceUrl: string;
    dataHash: string;
  }> {
    const response = await api.put(`/orders/${orderNumber}/qb-invoice`);
    return response.data;
  },

  /**
   * Get invoice details including current balance from QuickBooks
   */
  async getInvoice(orderNumber: number): Promise<InvoiceDetails> {
    const response = await api.get(`/orders/${orderNumber}/qb-invoice`);
    return response.data;
  },

  /**
   * Link an existing QuickBooks invoice to this order
   */
  async linkInvoice(orderNumber: number, data: {
    qbInvoiceId?: string;
    docNumber?: string;
  }): Promise<{
    invoiceId: string;
    invoiceNumber: string;
    invoiceUrl: string;
  }> {
    const response = await api.post(`/orders/${orderNumber}/qb-invoice/link`, data);
    return response.data;
  },

  /**
   * Unlink QB invoice from order
   * Returns info about the previously linked invoice
   */
  async unlinkInvoice(orderNumber: number): Promise<{
    previousInvoiceId: string | null;
    previousInvoiceNumber: string | null;
  }> {
    const response = await api.delete(`/orders/${orderNumber}/qb-invoice/link`);
    return response.data;
  },

  /**
   * Mark order as invoice sent (manual marking)
   * Used for cash jobs or when invoice was sent manually through QuickBooks
   */
  async markAsSent(orderNumber: number): Promise<void> {
    await api.post(`/orders/${orderNumber}/qb-invoice/mark-sent`);
  },

  /**
   * Verify if the linked QB invoice still exists in QuickBooks
   * Used to detect deleted invoices
   */
  async verifyInvoice(orderNumber: number): Promise<{
    exists: boolean;
    status: 'exists' | 'not_found' | 'error' | 'not_linked';
    invoiceId: string | null;
    invoiceNumber: string | null;
    errorMessage?: string;
  }> {
    const response = await api.get(`/orders/${orderNumber}/qb-invoice/verify`);
    return response.data;
  },

  /**
   * Check if the invoice is stale (order data changed since last sync)
   * This is a fast local-only check.
   */
  async checkUpdates(orderNumber: number): Promise<InvoiceStalenessResult> {
    const response = await api.get(`/orders/${orderNumber}/qb-invoice/check-updates`);
    return response.data;
  },

  // ========================================
  // Phase 2: Bi-directional Sync
  // ========================================

  /**
   * Deep comparison with QuickBooks (Phase 2)
   * Fetches current QB invoice and compares with local data.
   * Detects both local changes AND QB-side modifications.
   */
  async compareWithQB(orderNumber: number): Promise<InvoiceSyncResult> {
    const response = await api.get(`/orders/${orderNumber}/qb-invoice/compare`);
    return response.data;
  },

  /**
   * Resolve a sync conflict (Phase 2)
   * @param resolution - 'use_local' to push local data to QB,
   *                     'use_qb' to accept QB version,
   *                     'keep_both' to acknowledge without changes
   */
  async resolveConflict(orderNumber: number, resolution: ConflictResolution): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.post(`/orders/${orderNumber}/qb-invoice/resolve-conflict`, { resolution });
    return response.data;
  },

  /**
   * Get invoice PDF from QuickBooks
   * Returns base64-encoded PDF data
   */
  async getInvoicePdf(orderNumber: number): Promise<{ pdf: string; filename: string }> {
    const response = await api.get(`/orders/${orderNumber}/qb-invoice/pdf`);
    if (!response.data?.pdf) {
      throw new Error(response.data?.error || 'Failed to fetch invoice PDF');
    }
    return response.data;
  },

  // ========================================
  // Payment Operations
  // ========================================

  /**
   * Record a payment against the invoice in QuickBooks
   * Returns the new balance after payment
   */
  async recordPayment(orderNumber: number, data: PaymentInput): Promise<PaymentResult> {
    const response = await api.post(`/orders/${orderNumber}/qb-payment`, data);
    return response.data;
  },

  // ========================================
  // Email Operations
  // ========================================

  /**
   * Send invoice email immediately
   */
  async sendEmail(orderNumber: number, data: EmailInput): Promise<{ success: boolean }> {
    const response = await api.post(`/orders/${orderNumber}/invoice-email/send`, data);
    return response.data;
  },

  /**
   * Schedule invoice email for later delivery
   */
  async scheduleEmail(orderNumber: number, data: ScheduledEmailInput): Promise<{
    scheduledEmailId: number;
  }> {
    const response = await api.post(`/orders/${orderNumber}/invoice-email/schedule`, data);
    return response.data;
  },

  /**
   * Get pending scheduled email for this order (if any)
   */
  async getScheduledEmail(orderNumber: number): Promise<ScheduledEmail | null> {
    const response = await api.get(`/orders/${orderNumber}/invoice-email/scheduled`);
    return response.data;
  },

  /**
   * Update a scheduled email
   */
  async updateScheduledEmail(orderNumber: number, id: number, data: Partial<ScheduledEmailInput>): Promise<void> {
    await api.put(`/orders/${orderNumber}/invoice-email/scheduled/${id}`, data);
  },

  /**
   * Cancel a scheduled email
   */
  async cancelScheduledEmail(orderNumber: number, id: number): Promise<void> {
    await api.delete(`/orders/${orderNumber}/invoice-email/scheduled/${id}`);
  },

  /**
   * Get email preview with template variables populated
   */
  async getEmailPreview(orderNumber: number, templateKey: string): Promise<EmailPreview> {
    const response = await api.get(`/orders/${orderNumber}/invoice-email/preview/${templateKey}`);
    return response.data;
  },

  /**
   * Get styled email preview (4-part structure with logo/footer)
   */
  async getStyledEmailPreview(
    orderNumber: number,
    emailContent: {
      subject?: string;
      beginning?: string;
      end?: string;
      summaryConfig?: Record<string, boolean>;
      includePayButton?: boolean;
      invoiceData?: {
        jobName?: string;
        jobNumber?: string;
        customerPO?: string;
        invoiceNumber?: string;
        invoiceDate?: string;
        dueDate?: string;
        subtotal?: number;
        tax?: number;
        total?: number;
        balanceDue?: number;
        qbInvoiceUrl?: string;
      };
    }
  ): Promise<{ subject: string; html: string }> {
    const response = await api.post(`/orders/${orderNumber}/invoice-email/styled-preview`, emailContent);
    return response.data;
  },

  /**
   * Get all invoice emails for this order (history)
   */
  async getEmailHistory(orderNumber: number): Promise<ScheduledEmail[]> {
    const response = await api.get(`/orders/${orderNumber}/invoice-email/history`);
    // Transform snake_case from backend to camelCase for frontend
    const rawData = response.data as any[];
    return rawData.map(item => ({
      id: item.id,
      orderId: item.order_id,
      emailType: item.email_type,
      recipientEmails: item.recipient_emails,
      ccEmails: item.cc_emails,
      subject: item.subject,
      body: item.body,
      scheduledFor: item.scheduled_for,
      status: item.status,
      sentAt: item.sent_at,
      errorMessage: item.error_message,
      createdAt: item.created_at,
      createdBy: item.created_by,
      updatedAt: item.updated_at
    }));
  },

  // ========================================
  // Templates
  // ========================================

  /**
   * Get email template by key
   */
  async getEmailTemplate(templateKey: string): Promise<{
    templateKey: string;
    templateName: string;
    subject: string;
    body: string;
    variables: string[];
  }> {
    const response = await api.get(`/orders/email-templates/${templateKey}`);
    return response.data;
  },

  // ========================================
  // Invoice Search (for linking)
  // ========================================

  /**
   * Search for a QB invoice by doc number or ID (for preview before linking)
   */
  async searchInvoice(searchValue: string, searchType: 'docNumber' | 'id'): Promise<InvoiceSearchResult> {
    const response = await api.get('/invoices/search', {
      params: { query: searchValue, type: searchType }
    });
    return response.data;
  },

  /**
   * List all QB invoices for the customer associated with an order
   * Returns open invoices first, then closed, excluding already-linked invoices
   */
  async listCustomerInvoices(orderNumber: number, page: number = 1, pageSize: number = 10): Promise<CustomerInvoiceListResult> {
    const response = await api.get(`/orders/${orderNumber}/customer-invoices`, {
      params: { page, pageSize }
    });
    return response.data;
  },

  /**
   * Get detailed QB invoice including line items
   * Used for expandable row preview in invoice linking
   */
  async getInvoiceDetails(invoiceId: string): Promise<InvoiceDetailsResult> {
    const response = await api.get(`/invoices/${invoiceId}/details`);
    // Interceptor unwraps { success, data } automatically
    return response.data;
  },
};

// Search result interface
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

// Customer invoice list interfaces
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

// Invoice line item detail
export interface InvoiceLineItem {
  description: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

// Invoice details with line items
export interface InvoiceDetailsResult {
  invoiceId: string;
  docNumber: string;
  txnDate: string;
  dueDate?: string;
  total: number;
  balance: number;
  customerName: string;
  lineItems: InvoiceLineItem[];
}

export interface CustomerInvoiceListResult {
  invoices: CustomerInvoiceListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
