/**
 * QuickBooks Invoice Type Definitions
 * Phase 2.e: QB Invoice Automation
 * Created: 2025-12-13
 */

// =============================================
// QB INVOICE PAYLOAD TYPES (sent to QB API)
// =============================================

export interface QBLineItem {
  DetailType: 'SalesItemLineDetail' | 'DescriptionOnly';
  Amount?: number;
  Description?: string;
  SalesItemLineDetail?: {
    ItemRef: { value: string; name?: string };
    Qty?: number;
    UnitPrice?: number;
    TaxCodeRef?: { value: string };
  };
  DescriptionOnlyDetail?: {
    ServiceDate?: string;
  };
}

export interface QBInvoicePayload {
  CustomerRef: { value: string; name?: string };
  TxnDate: string;
  DueDate?: string;
  DocNumber?: string;
  Line: QBLineItem[];
  CustomerMemo?: { value: string };
  BillEmail?: { Address: string };
  TxnTaxDetail?: {
    TxnTaxCodeRef: { value: string; name: string };
  };
  PrivateNote?: string;
}

export interface QBPaymentPayload {
  CustomerRef: { value: string };
  TotalAmt: number;
  TxnDate: string;
  Line: Array<{
    Amount: number;
    LinkedTxn: Array<{
      TxnId: string;
      TxnType: 'Invoice';
    }>;
  }>;
  PaymentMethodRef?: { value: string };
  PaymentRefNum?: string;
  PrivateNote?: string;
}

// =============================================
// QB API RESPONSE TYPES (received from QB)
// =============================================

export interface QBInvoice {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  DueDate?: string;
  TotalAmt: number;
  Balance: number;
  CustomerRef: { value: string; name?: string };
  Line: QBLineItem[];
  SyncToken: string;
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
  BillEmail?: { Address: string };
  EmailStatus?: 'NotSet' | 'NeedToSend' | 'EmailSent';
}

export interface QBPayment {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  PaymentMethodRef?: { value: string; name?: string };
  PaymentRefNum?: string;
  PrivateNote?: string;
  Line: Array<{
    Amount: number;
    LinkedTxn: Array<{
      TxnId: string;
      TxnType: string;
    }>;
  }>;
}

// =============================================
// SERVICE INPUT/OUTPUT TYPES
// =============================================

export interface InvoiceStalenessResult {
  exists: boolean;
  isStale: boolean;
  currentHash: string | null;
  storedHash: string | null;
  qbInvoiceId: string | null;
  qbInvoiceNumber: string | null;
  syncedAt: Date | null;
}

export interface InvoiceCreationResult {
  invoiceId: string;
  invoiceNumber: string;
  dataHash: string;
  invoiceUrl: string;
}

export interface InvoiceUpdateResult {
  invoiceId: string;
  invoiceNumber: string;
  dataHash: string;
}

export interface InvoiceDetailsResult {
  exists: boolean;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  total: number | null;
  balance: number | null;
  syncedAt: Date | null;
  sentAt: Date | null;
}

export interface LinkInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  invoiceUrl: string;
}

export interface PaymentInput {
  amount: number;
  paymentDate: string; // YYYY-MM-DD format
  paymentMethod?: string;
  referenceNumber?: string;
  memo?: string;
}

export interface PaymentResult {
  paymentId: string;
  newBalance: number;
}

// =============================================
// SCHEDULED EMAIL TYPES
// =============================================

export type EmailType = 'deposit_request' | 'full_invoice' | 'reminder';
export type EmailStatus = 'pending' | 'sent' | 'cancelled' | 'failed';

export interface ScheduledEmail {
  id: number;
  order_id: number;
  email_type: EmailType;
  recipient_emails: string[];
  cc_emails: string[] | null;
  subject: string;
  body: string;
  scheduled_for: Date;
  status: EmailStatus;
  sent_at: Date | null;
  error_message: string | null;
  created_at: Date;
  created_by: number;
  updated_at: Date;
}

export interface ScheduledEmailInput {
  order_id: number;
  email_type: EmailType;
  recipient_emails: string[];
  cc_emails?: string[];
  subject: string;
  body: string;
  scheduled_for: Date;
  created_by: number;
}

export interface EmailSendInput {
  recipient_emails: string[];
  cc_emails?: string[];
  subject: string;
  body: string;
  attach_invoice_pdf?: boolean;
}

export interface EmailPreview {
  subject: string;
  body: string;
  recipient_emails: string[];
}

// =============================================
// EMAIL TEMPLATE TYPES
// =============================================

export interface EmailTemplate {
  id: number;
  template_key: string;
  template_name: string;
  subject: string;
  body: string;
  variables: string[] | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TemplateVariables {
  orderNumber: string;
  customerName: string;
  invoiceTotal: string;
  depositAmount?: string;
  dueDate?: string;
  qbInvoiceUrl: string;
}

// =============================================
// ORDER INVOICE DATA TYPES
// =============================================

export interface OrderInvoiceRecord {
  order_id: number;
  order_number: number;
  qb_invoice_id: string | null;
  qb_invoice_doc_number: string | null;
  qb_invoice_url: string | null;
  qb_invoice_synced_at: Date | null;
  qb_invoice_data_hash: string | null;
  invoice_sent_at: Date | null;
}

export interface OrderInvoiceUpdateData {
  qb_invoice_id?: string;
  qb_invoice_doc_number?: string;
  qb_invoice_url?: string;
  qb_invoice_synced_at?: Date;
  qb_invoice_data_hash?: string;
  invoice_sent_at?: Date;
}

// =============================================
// REQUEST/RESPONSE TYPES (Controller layer)
// =============================================

export interface CreateInvoiceRequest {
  // No body params needed - uses order data
}

export interface LinkInvoiceRequest {
  qbInvoiceId?: string;
  docNumber?: string;
}

export interface RecordPaymentRequest {
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  referenceNumber?: string;
  memo?: string;
}

export interface SendEmailRequest {
  recipientEmails: string[];
  ccEmails?: string[];
  subject: string;
  body: string;
  attachInvoicePdf?: boolean;
}

export interface ScheduleEmailRequest {
  recipientEmails: string[];
  ccEmails?: string[];
  subject: string;
  body: string;
  scheduledFor: string; // ISO datetime string
}

export interface UpdateScheduledEmailRequest {
  subject?: string;
  body?: string;
  scheduledFor?: string;
  recipientEmails?: string[];
  ccEmails?: string[];
}
