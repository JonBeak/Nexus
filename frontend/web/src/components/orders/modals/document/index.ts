/**
 * Document Modals - Unified components for Invoice and Estimate operations
 *
 * These unified modals replace separate Invoice and Estimate modals:
 * - DocumentActionModal: Create/Update/Send/View workflow
 * - DocumentConflictModal: Sync conflict resolution
 * - LinkDocumentModal: Link existing QB document to order
 *
 * Usage:
 *   import { DocumentActionModal, DocumentConflictModal, LinkDocumentModal } from './document';
 *
 *   // For invoices
 *   <DocumentActionModal documentType="invoice" mode="create" ... />
 *   <LinkDocumentModal documentType="invoice" ... />
 *
 *   // For estimates
 *   <DocumentActionModal documentType="estimate" mode="create" ... />
 *   <LinkDocumentModal documentType="estimate" ... />
 */

// Main modal components
export { DocumentActionModal, type DocumentMode } from './DocumentActionModal';
export { DocumentConflictModal } from './DocumentConflictModal';
export { LinkDocumentModal, type OrderTotals } from './LinkDocumentModal';
export { InvoiceLinkingPanel, type InvoiceLinkingPanelProps } from './InvoiceLinkingPanel';

// API adapter
export { createDocumentApi, type DocumentApiAdapter } from './documentApi';

// Re-export types from the central types file
export type {
  DocumentType,
  DocumentSyncStatus,
  DocumentConflictResolution,
  DocumentDifference,
  DocumentSyncResult,
  DocumentDetails,
  DocumentRecipientEntry,
  DocumentEmailHistoryItem,
  DocumentEmailInput,
  DocumentScheduledEmailInput,
  DocumentLineItem,
  CustomerDocumentListItem,
  CustomerDocumentListResult,
  DocumentSearchResult,
  DocumentConfig,
} from '../../../../types/document';

export { getDocumentConfig, DOCUMENT_FIELD_LABELS, formatDocumentValue } from '../../../../types/document';
