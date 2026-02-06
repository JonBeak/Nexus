/**
 * Document API Adapter
 *
 * Factory function that returns the appropriate API based on document type.
 * This provides a unified interface for both invoice and estimate operations.
 */

import { qbInvoiceApi, orderPreparationApi } from '../../../../services/api';
import {
  DocumentType,
  DocumentSyncStatus,
  DocumentConflictResolution,
  DocumentDifference,
  DocumentSyncResult,
  DocumentEmailInput,
  DocumentScheduledEmailInput,
  DocumentEmailHistoryItem,
  CustomerDocumentListItem,
  CustomerDocumentListResult,
  DocumentSearchResult,
} from '../../../../types/document';

// Create result from QB operations
export interface DocumentCreateResult {
  documentId: string;
  documentNumber: string;
  documentUrl?: string;
  dataHash?: string;
}

// Compare result from QB
export interface DocumentCompareResult {
  status: DocumentSyncStatus;
  localChanged: boolean;
  qbChanged: boolean;
  differences?: DocumentDifference[];
}

// PDF result
export interface DocumentPdfResult {
  pdf: string;
  filename: string;
}

// Link result
export interface DocumentLinkResult {
  documentId: string;
  documentNumber: string;
}

// Line item for details
export interface DocumentLineItemDetail {
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

// Details result with line items
export interface DocumentDetailsResult {
  documentId: string;
  docNumber: string;
  txnDate: string;
  dueDate?: string;
  total: number;
  balance?: number;
  customerName: string;
  lineItems: DocumentLineItemDetail[];
}

/**
 * Document API Adapter Interface
 * Unified interface for invoice and estimate operations
 */
export interface DocumentApiAdapter {
  // Create/Update
  create: (orderNumber: number) => Promise<DocumentCreateResult>;
  update?: (orderNumber: number) => Promise<DocumentCreateResult>;

  // Sync/Conflict
  compare: (orderNumber: number) => Promise<DocumentCompareResult>;
  resolveConflict: (orderNumber: number, resolution: DocumentConflictResolution) => Promise<{ success: boolean; message?: string }>;

  // PDF
  getPdf: (orderNumber: number) => Promise<DocumentPdfResult>;

  // Email
  sendEmail: (orderNumber: number, data: DocumentEmailInput) => Promise<{ success: boolean }>;
  scheduleEmail: (orderNumber: number, data: DocumentScheduledEmailInput) => Promise<{ scheduledEmailId: number }>;
  getEmailHistory: (orderNumber: number) => Promise<DocumentEmailHistoryItem[]>;
  markAsSent: (orderNumber: number) => Promise<void>;

  // Link
  link: (orderNumber: number, qbId: string) => Promise<DocumentLinkResult>;
  unlink?: (orderNumber: number) => Promise<void>;
  listForCustomer: (orderNumber: number, page?: number, pageSize?: number) => Promise<CustomerDocumentListResult>;
  search?: (query: string, searchType: 'docNumber' | 'id') => Promise<DocumentSearchResult>;
  getDetails?: (documentId: string) => Promise<DocumentDetailsResult>;

  // Verify
  verify?: (orderNumber: number) => Promise<{ exists: boolean; status: string }>;
}

/**
 * Create document API adapter for invoice operations
 */
function createInvoiceApiAdapter(): DocumentApiAdapter {
  return {
    create: async (orderNumber) => {
      const result = await qbInvoiceApi.createInvoice(orderNumber);
      return {
        documentId: result.invoiceId,
        documentNumber: result.invoiceNumber,
        documentUrl: result.invoiceUrl,
        dataHash: result.dataHash,
      };
    },

    update: async (orderNumber) => {
      const result = await qbInvoiceApi.updateInvoice(orderNumber);
      return {
        documentId: result.invoiceId,
        documentNumber: result.invoiceNumber,
        documentUrl: result.invoiceUrl,
        dataHash: result.dataHash,
      };
    },

    compare: async (orderNumber) => {
      const result = await qbInvoiceApi.compareWithQB(orderNumber);
      return {
        status: result.status,
        localChanged: result.localChanged,
        qbChanged: result.qbChanged,
        differences: result.differences,
      };
    },

    resolveConflict: async (orderNumber, resolution) => {
      return await qbInvoiceApi.resolveConflict(orderNumber, resolution);
    },

    getPdf: async (orderNumber) => {
      return await qbInvoiceApi.getInvoicePdf(orderNumber);
    },

    sendEmail: async (orderNumber, data) => {
      return await qbInvoiceApi.sendEmail(orderNumber, {
        recipientEmails: data.recipientEmails,
        ccEmails: data.ccEmails,
        bccEmails: data.bccEmails,
        subject: data.subject,
        body: data.body,
        attachInvoicePdf: data.attachPdf,
      });
    },

    scheduleEmail: async (orderNumber, data) => {
      return await qbInvoiceApi.scheduleEmail(orderNumber, {
        recipientEmails: data.recipientEmails,
        ccEmails: data.ccEmails,
        bccEmails: data.bccEmails,
        subject: data.subject,
        body: data.body,
        attachInvoicePdf: data.attachPdf,
        scheduledFor: data.scheduledFor,
      });
    },

    getEmailHistory: async (orderNumber) => {
      const history = await qbInvoiceApi.getEmailHistory(orderNumber);
      return history.map(item => ({
        id: item.id,
        emailType: item.emailType,
        recipientEmails: item.recipientEmails,
        ccEmails: item.ccEmails || undefined,
        bccEmails: undefined,
        subject: item.subject,
        status: item.status,
        scheduledFor: item.scheduledFor,
        sentAt: item.sentAt,
        createdAt: item.createdAt,
      }));
    },

    markAsSent: async (orderNumber) => {
      await qbInvoiceApi.markAsSent(orderNumber);
    },

    link: async (orderNumber, qbId) => {
      const result = await qbInvoiceApi.linkInvoice(orderNumber, { qbInvoiceId: qbId });
      return {
        documentId: result.invoiceId,
        documentNumber: result.invoiceNumber,
      };
    },

    unlink: async (orderNumber) => {
      await qbInvoiceApi.unlinkInvoice(orderNumber);
    },

    listForCustomer: async (orderNumber, page = 1, pageSize = 10) => {
      const result = await qbInvoiceApi.listCustomerInvoices(orderNumber, page, pageSize);
      return {
        documents: result.invoices.map(inv => ({
          id: inv.invoiceId,
          docNumber: inv.docNumber,
          total: inv.total,
          balance: inv.balance,
          txnDate: inv.txnDate || '',
          customerName: inv.customerName || undefined,
          isOpen: inv.isOpen,
        })),
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        currentPage: result.page,
      };
    },

    search: async (query, searchType) => {
      const result = await qbInvoiceApi.searchInvoice(query, searchType);
      return {
        found: result.found,
        documentId: result.invoiceId || undefined,
        docNumber: result.docNumber || undefined,
        customerName: result.customerName || undefined,
        total: result.total || undefined,
        balance: result.balance || undefined,
        txnDate: result.txnDate || undefined,
        alreadyLinked: result.alreadyLinked,
        linkedOrderNumber: result.linkedOrderNumber || undefined,
      };
    },

    getDetails: async (documentId) => {
      const result = await qbInvoiceApi.getInvoiceDetails(documentId);
      return {
        documentId: result.invoiceId,
        docNumber: result.docNumber,
        txnDate: result.txnDate,
        dueDate: result.dueDate,
        total: result.total,
        balance: result.balance,
        customerName: result.customerName,
        lineItems: result.lineItems.map(line => ({
          itemName: line.itemName,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: line.amount,
        })),
      };
    },

    verify: async (orderNumber) => {
      const result = await qbInvoiceApi.verifyInvoice(orderNumber);
      return { exists: result.exists, status: result.status };
    },
  };
}

/**
 * Create document API adapter for estimate operations
 */
function createEstimateApiAdapter(): DocumentApiAdapter {
  return {
    create: async (orderNumber) => {
      const result = await orderPreparationApi.createQBEstimate(orderNumber);
      return {
        documentId: result.qbEstimateId || result.estimateId,
        documentNumber: result.qbEstimateDocNumber || result.estimateNumber,
        documentUrl: undefined,
        dataHash: result.dataHash,
      };
    },

    // Estimates don't support update - they recreate
    update: undefined,

    compare: async (orderNumber) => {
      const result = await orderPreparationApi.compareQBEstimate(orderNumber);
      return {
        status: result.status,
        localChanged: result.localChanged,
        qbChanged: result.qbChanged,
        differences: result.differences,
      };
    },

    resolveConflict: async (orderNumber, resolution) => {
      // Estimates only support use_local and use_qb (no keep_both)
      if (resolution === 'keep_both') {
        throw new Error('keep_both is not supported for estimates');
      }
      const result = await orderPreparationApi.resolveEstimateConflict(orderNumber, resolution);
      return { success: result.success, message: result.message };
    },

    getPdf: async (orderNumber) => {
      return await orderPreparationApi.getEstimatePdf(orderNumber);
    },

    sendEmail: async (orderNumber, data) => {
      return await orderPreparationApi.sendEstimateEmail(orderNumber, {
        recipientEmails: data.recipientEmails,
        ccEmails: data.ccEmails,
        bccEmails: data.bccEmails,
        subject: data.subject,
        body: data.body,
        attachEstimatePdf: data.attachPdf,
      });
    },

    scheduleEmail: async (orderNumber, data) => {
      return await orderPreparationApi.scheduleEstimateEmail(orderNumber, {
        recipientEmails: data.recipientEmails,
        ccEmails: data.ccEmails,
        bccEmails: data.bccEmails,
        subject: data.subject,
        body: data.body,
        attachEstimatePdf: data.attachPdf,
        scheduledFor: data.scheduledFor,
      });
    },

    getEmailHistory: async (orderNumber) => {
      const history = await orderPreparationApi.getEstimateEmailHistory(orderNumber);
      return history.map(item => ({
        id: item.id,
        emailType: item.emailType,
        recipientEmails: item.recipientEmails,
        ccEmails: item.ccEmails || undefined,
        bccEmails: undefined,
        subject: item.subject,
        status: item.status,
        scheduledFor: item.scheduledFor,
        sentAt: item.sentAt,
        createdAt: item.createdAt,
      }));
    },

    markAsSent: async (orderNumber) => {
      await orderPreparationApi.markEstimateAsSent(orderNumber);
    },

    link: async (orderNumber, qbId) => {
      const result = await orderPreparationApi.linkExistingEstimate(orderNumber, qbId);
      return {
        documentId: result.qbEstimateId,
        documentNumber: result.qbEstimateDocNumber,
      };
    },

    // Estimates don't currently support unlink
    unlink: undefined,

    listForCustomer: async (orderNumber, page = 1, _pageSize = 10) => {
      const result = await orderPreparationApi.getCustomerEstimates(orderNumber);
      const estimates = result.estimates || [];
      return {
        documents: estimates.map((est: any) => ({
          id: est.Id,
          docNumber: est.DocNumber,
          total: est.TotalAmt,
          txnDate: est.TxnDate,
          customerName: est.CustomerRef?.name,
        })),
        totalCount: estimates.length,
        totalPages: 1, // Backend returns all estimates
        currentPage: page,
      };
    },

    // Search not currently supported for estimates
    search: undefined,

    getDetails: async (documentId) => {
      const result = await orderPreparationApi.getEstimateDetails(documentId);
      return {
        documentId: result.estimateId,
        docNumber: result.docNumber,
        txnDate: result.txnDate,
        total: result.total,
        customerName: result.customerName,
        lineItems: result.lineItems.map((line: any) => ({
          itemName: line.itemName,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: line.amount,
        })),
      };
    },

    // Verify not currently supported for estimates
    verify: undefined,
  };
}

/**
 * Factory function to create a document API adapter
 */
export function createDocumentApi(type: DocumentType): DocumentApiAdapter {
  if (type === 'invoice') {
    return createInvoiceApiAdapter();
  }
  return createEstimateApiAdapter();
}

export default createDocumentApi;
