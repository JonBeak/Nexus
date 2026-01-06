// File Clean up Finished: 2025-11-18
// Cleanup Summary:
// - ✅ Removed savePDFsToFolder method (backend endpoint removed - redundant functionality)
// - ✅ 8 API methods remain (matching backend routes)
// - ✅ All methods use api client from apiClient.ts
// - ✅ File size: 116 lines (reduced from 126 lines)

/**
 * Order Preparation API Client
 *
 * Frontend API methods for order preparation workflow.
 * Communicates with backend order-preparation endpoints.
 */

import { api } from '../../apiClient';

export const orderPreparationApi = {
  /**
   * Check if QB estimate is stale (order data changed)
   */
  checkQBEstimateStaleness: async (orderNumber: number) => {
    const response = await api.get(
      `/order-preparation/${orderNumber}/qb-estimate/staleness`
    );
    return response.data;
  },

  /**
   * Create QB estimate from order
   */
  createQBEstimate: async (orderNumber: number) => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/qb-estimate`
    );
    return response.data;
  },

  /**
   * Check if order form PDFs are stale (order data changed)
   */
  checkPDFStaleness: async (orderNumber: number) => {
    const response = await api.get(
      `/order-preparation/${orderNumber}/pdfs/staleness`
    );
    return response.data;
  },

  /**
   * Generate order form PDF
   */
  generateOrderFormPDF: async (orderNumber: number) => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/pdfs/order-form`
    );
    return response.data;
  },

  /**
   * Download QB estimate PDF
   */
  downloadQBEstimatePDF: async (orderNumber: number, qbEstimateId?: string) => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/pdfs/qb-estimate`,
      { qbEstimateId }
    );
    return response.data;
  },

  /**
   * Validate order for preparation
   * (PLACEHOLDER - always succeeds)
   */
  validateForPreparation: async (orderNumber: number) => {
    const response = await api.get(
      `/order-preparation/${orderNumber}/validate`
    );
    return response.data;
  },

  /**
   * Check if production tasks are stale (order data changed)
   * Uses same hash as QB estimates and PDFs - shared staleness
   */
  checkTaskStaleness: async (orderNumber: number) => {
    const response = await api.get(
      `/order-preparation/${orderNumber}/tasks/staleness`
    );
    return response.data;
  },

  /**
   * Generate production tasks
   * (PLACEHOLDER for Phase 1.5.d)
   */
  generateProductionTasks: async (orderNumber: number) => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/tasks`
    );
    return response.data;
  },

  /**
   * Get point persons for order
   * (For Phase 1.5.c.6.3 - Send to Customer)
   */
  getPointPersons: async (orderNumber: number) => {
    const response = await api.get(
      `/order-preparation/${orderNumber}/point-persons`
    );
    return response.data;
  },

  /**
   * Get email preview HTML (legacy - simple recipients list)
   * (Phase 1.5.c.6.3 - Send to Customer)
   */
  getEmailPreview: async (orderNumber: number, recipients: string[]) => {
    const response = await api.get(
      `/order-preparation/${orderNumber}/email-preview`,
      {
        params: {
          recipients: recipients.join(',')
        }
      }
    );
    return response.data;
  },

  /**
   * Get order email preview with customizable content
   * Uses new navy-styled template with company logo
   */
  getOrderEmailPreview: async (orderNumber: number, data: {
    recipients: {
      to: string[];
      cc: string[];
      bcc: string[];
    };
    emailContent: {
      subject: string;
      beginning: string;
      includeActionRequired: boolean;
      includeAttachments: boolean;
      end: string;
    };
    customerName?: string;
    orderName?: string;
    pdfUrls?: {
      specsOrderForm: string | null;
      qbEstimate: string | null;
    };
  }) => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/email-preview`,
      data
    );
    return response.data;
  },

  /**
   * Finalize order and optionally send to customer
   * Supports To/CC/BCC recipients and customizable email content
   * (Phase 1.5.c.6.3 - Send to Customer)
   */
  finalizeOrder: async (orderNumber: number, data: {
    sendEmail: boolean;
    recipients?: string[];  // Legacy: simple list (all To)
    recipientSelection?: {  // New: To/CC/BCC
      to: string[];
      cc: string[];
      bcc: string[];
    };
    emailContent?: {
      subject: string;
      beginning: string;
      includeActionRequired: boolean;
      includeAttachments: boolean;
      end: string;
    };
    orderName?: string;
    pdfUrls?: {
      orderForm: string | null;
      qbEstimate: string | null;
    };
  }) => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/finalize`,
      data
    );
    return response.data;
  }
};
