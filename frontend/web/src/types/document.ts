/**
 * Unified Document Types
 * Shared type definitions for Invoice and Estimate document operations
 */

// Document type discriminator
export type DocumentType = 'invoice' | 'estimate';

// Sync status values (shared between invoice and estimate)
export type DocumentSyncStatus =
  | 'in_sync'       // Local and QB match
  | 'local_stale'   // Local data changed since last sync
  | 'qb_modified'   // QB document was modified directly
  | 'conflict'      // Both local and QB changed
  | 'not_found'     // QB document was deleted
  | 'error';        // Error checking sync status

// Conflict resolution options
export type DocumentConflictResolution = 'use_local' | 'use_qb' | 'keep_both';

// Difference types for sync comparison
export type DocumentDifferenceType = 'added' | 'removed' | 'modified';

// Fields that can differ
export type DocumentDifferenceField = 'description' | 'quantity' | 'unitPrice' | 'amount' | 'item';

// A single difference between local and QB data
export interface DocumentDifference {
  type: DocumentDifferenceType;
  lineNumber: number;
  field: DocumentDifferenceField;
  localValue?: string | number;
  qbValue?: string | number;
}

// Sync comparison result
export interface DocumentSyncResult {
  status: DocumentSyncStatus;
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

  // QB document info
  qbDocumentId: string | null;
  qbDocumentNumber: string | null;
  qbSyncToken: string | null;

  // Differences (if qbChanged or conflict)
  differences?: DocumentDifference[];

  // Error info
  errorMessage?: string;
}

// Document details (invoice or estimate)
export interface DocumentDetails {
  qbDocumentId: string;
  docNumber: string;
  documentUrl?: string;
  total: number;
  balance?: number;  // Invoices have balance, estimates don't
  customerName: string;
  txnDate: string;
  dueDate?: string;  // Invoices only
  status?: string;
  syncedAt?: string;
}

// Email recipient entry for the checkbox table
export interface DocumentRecipientEntry {
  id: string;
  source: 'accounting' | 'point_person';
  email: string;
  name?: string;
  label?: string;
  emailType: 'to' | 'cc' | 'bcc' | null;
}

// Email history item
export interface DocumentEmailHistoryItem {
  id: number;
  emailType: string;
  recipientEmails: string[];
  ccEmails?: string[];
  bccEmails?: string[];
  subject: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  scheduledFor: string;
  sentAt: string | null;
  createdAt: string;
}

// Email input for sending
export interface DocumentEmailInput {
  recipientEmails: string[];
  ccEmails?: string[];
  bccEmails?: string[];
  subject: string;
  body: string;
  attachPdf?: boolean;
}

// Scheduled email input
export interface DocumentScheduledEmailInput extends DocumentEmailInput {
  scheduledFor: string;
}

// Line item for preview
export interface DocumentLineItem {
  itemName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

// List item for customer documents
export interface CustomerDocumentListItem {
  id: string;
  docNumber: string;
  total: number;
  balance?: number;  // Invoice only
  txnDate: string;
  customerName?: string;
  isOpen?: boolean;  // Invoice only
}

// List result for customer documents
export interface CustomerDocumentListResult {
  documents: CustomerDocumentListItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

// Search result
export interface DocumentSearchResult {
  found: boolean;
  documentId?: string;
  docNumber?: string;
  customerName?: string;
  total?: number;
  balance?: number;
  txnDate?: string;
  alreadyLinked?: boolean;
  linkedOrderNumber?: number;
}

// Config for document modals based on type
export interface DocumentConfig {
  type: DocumentType;
  title: {
    create: string;
    update: string;
    send: string;
    view: string;
    link: string;
    conflict: string;
  };
  labels: {
    documentName: string;       // "Invoice" or "Estimate"
    documentNamePlural: string; // "Invoices" or "Estimates"
    localValueLabel: string;    // "Local Value" or "Dual Table Value"
    createAction: string;       // "Create Invoice" or "Create Estimate"
    sendAction: string;         // "Send Invoice" or "Send Estimate"
  };
  features: {
    hasBalance: boolean;        // Invoices track balance, estimates don't
    hasSearch: boolean;         // Link modal search feature
    hasPreview: boolean;        // Link modal preview panel
    hasUnlink: boolean;         // Link modal unlink feature
    hasKeepBoth: boolean;       // Conflict modal keep_both option
    hasMarkAsSent: boolean;     // Action modal mark as sent button
    hasSchedule: boolean;       // Action modal schedule feature
  };
  colors: {
    primary: string;            // Primary button color
    accent: string;             // Accent color for highlights
  };
}

// Get config for a document type
export function getDocumentConfig(type: DocumentType): DocumentConfig {
  if (type === 'invoice') {
    return {
      type: 'invoice',
      title: {
        create: 'Create QB Invoice',
        update: 'Update Invoice',
        send: 'Send Invoice',
        view: 'View Invoice',
        link: 'Link Existing Invoice',
        conflict: 'Invoice Sync Conflict',
      },
      labels: {
        documentName: 'Invoice',
        documentNamePlural: 'Invoices',
        localValueLabel: 'Local Value',
        createAction: 'Create Invoice',
        sendAction: 'Send Invoice',
      },
      features: {
        hasBalance: true,
        hasSearch: true,
        hasPreview: true,
        hasUnlink: true,
        hasKeepBoth: true,
        hasMarkAsSent: true,
        hasSchedule: true,
      },
      colors: {
        primary: 'blue',
        accent: 'green',
      },
    };
  }

  // Estimate config
  return {
    type: 'estimate',
    title: {
      create: 'Create QB Estimate',
      update: 'Update Estimate',
      send: 'Send Estimate',
      view: 'View Estimate',
      link: 'Link Existing Estimate',
      conflict: 'Estimate Sync Conflict',
    },
    labels: {
      documentName: 'Estimate',
      documentNamePlural: 'Estimates',
      localValueLabel: 'Dual Table Value',
      createAction: 'Create Estimate',
      sendAction: 'Send Estimate',
    },
    features: {
      hasBalance: false,
      hasSearch: false,     // Can be enabled when backend supports it
      hasPreview: true,
      hasUnlink: false,     // Can be enabled when backend supports it
      hasKeepBoth: false,   // Estimates only have use_local and use_qb
      hasMarkAsSent: true,
      hasSchedule: true,
    },
    colors: {
      primary: 'blue',
      accent: 'green',
    },
  };
}

// Field labels for differences display
export const DOCUMENT_FIELD_LABELS: Record<string, string> = {
  description: 'Description',
  quantity: 'Quantity',
  unitPrice: 'Unit Price',
  amount: 'Amount',
  item: 'Line Item',
};

// Format value for differences display
export function formatDocumentValue(value: string | number | undefined | null, field: string): string {
  if (value === undefined || value === null) return '-';
  if (field === 'unitPrice' || field === 'amount') {
    return `$${Number(value).toFixed(2)}`;
  }
  return String(value);
}
