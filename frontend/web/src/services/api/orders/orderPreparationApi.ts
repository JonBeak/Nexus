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
   * Resolve unknown vinyl/digital print applications
   * Creates tasks for each resolution and optionally saves to matrix
   */
  resolveUnknownApplications: async (
    orderNumber: number,
    resolutions: Array<{
      partId: number;
      application: string;
      applicationKey: string;
      productType: string;
      productTypeKey: string;
      colour: string | null;
      specName: 'Vinyl' | 'Digital Print';
      taskNames: string[];
      saveApplication: boolean;
      saveToMatrix: boolean;
    }>
  ) => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/resolve-unknown-applications`,
      { resolutions }
    );
    return response.data;
  },

  /**
   * Resolve painting configurations when matrix lookup returns no tasks
   * Creates tasks for each resolution and optionally saves to matrix
   */
  resolvePaintingConfigurations: async (
    orderNumber: number,
    resolutions: Array<{
      partId: number;
      itemType: string;
      itemTypeKey: string;
      component: string;
      componentKey: string;
      timing: string;
      timingKey: string;
      colour: string;
      taskNames: string[];
      saveToMatrix: boolean;
    }>
  ) => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/resolve-painting-configurations`,
      { resolutions }
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
      attachments: {
        specsOrderForm: boolean;
        qbEstimate: boolean;
      };
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
      attachments: {
        specsOrderForm: boolean;
        qbEstimate: boolean;
      };
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
  },

  // =============================================
  // CASH JOB ESTIMATE CONFLICT RESOLUTION
  // =============================================

  /**
   * Compare local order data with QB estimate for conflict detection
   * Returns sync status and differences if any
   */
  compareQBEstimate: async (orderNumber: number) => {
    const response = await api.get(
      `/order-preparation/${orderNumber}/qb-estimate/compare`
    );
    return response.data;
  },

  /**
   * Resolve estimate conflict by applying chosen resolution
   * @param resolution - 'use_local' to create new QB estimate, 'use_qb' to sync QB lines to order
   */
  resolveEstimateConflict: async (orderNumber: number, resolution: 'use_local' | 'use_qb') => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/qb-estimate/resolve-conflict`,
      { resolution }
    );
    return response.data;
  },

  /**
   * Link an existing QB estimate to the order
   */
  linkExistingEstimate: async (orderNumber: number, qbEstimateId: string) => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/qb-estimate/link`,
      { qbEstimateId }
    );
    return response.data;
  },

  /**
   * Get QB estimates for the order's customer (for linking)
   */
  getCustomerEstimates: async (orderNumber: number) => {
    const response = await api.get(
      `/order-preparation/${orderNumber}/qb-estimate/customer-estimates`
    );
    return response.data;
  },

  // =============================================
  // CASH JOB ESTIMATE EMAIL WORKFLOW
  // =============================================

  /**
   * Get estimate PDF from QuickBooks (base64 encoded)
   */
  getEstimatePdf: async (orderNumber: number): Promise<{ pdf: string; filename: string }> => {
    const response = await api.get(
      `/order-preparation/${orderNumber}/qb-estimate/pdf`
    );
    if (!response.data?.pdf) {
      throw new Error(response.data?.error || 'Failed to fetch estimate PDF');
    }
    return response.data;
  },

  /**
   * Send estimate email to customer
   */
  sendEstimateEmail: async (orderNumber: number, data: {
    recipientEmails: string[];
    ccEmails?: string[];
    bccEmails?: string[];
    subject: string;
    body: string;
    attachEstimatePdf?: boolean;
  }): Promise<{ success: boolean }> => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/qb-estimate/send-email`,
      data
    );
    return response.data;
  },

  /**
   * Schedule estimate email for later delivery
   */
  scheduleEstimateEmail: async (orderNumber: number, data: {
    recipientEmails: string[];
    ccEmails?: string[];
    bccEmails?: string[];
    subject: string;
    body: string;
    attachEstimatePdf?: boolean;
    scheduledFor: string;
  }): Promise<{ scheduledEmailId: number }> => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/qb-estimate/schedule-email`,
      data
    );
    return response.data;
  },

  /**
   * Mark estimate as sent manually (without sending email)
   */
  markEstimateAsSent: async (orderNumber: number): Promise<void> => {
    await api.post(
      `/order-preparation/${orderNumber}/qb-estimate/mark-sent`
    );
  },

  /**
   * Get estimate email preview with styled template
   */
  getEstimateEmailPreview: async (orderNumber: number, data: {
    subject?: string;
    beginning?: string;
    end?: string;
    summaryConfig?: Record<string, boolean>;
    estimateData?: {
      jobName?: string;
      customerJobNumber?: string;
      qbEstimateNumber?: string;
      subtotal?: number;
      tax?: number;
      total?: number;
      estimateDate?: string;
    };
  }): Promise<{ subject: string; html: string }> => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/qb-estimate/email-preview`,
      data
    );
    return response.data;
  },

  /**
   * Get estimate email history for this order
   */
  getEstimateEmailHistory: async (orderNumber: number): Promise<Array<{
    id: number;
    emailType: string;
    recipientEmails: string[];
    ccEmails: string[] | null;
    subject: string;
    status: 'pending' | 'sent' | 'cancelled' | 'failed';
    scheduledFor: string;
    sentAt: string | null;
    createdAt: string;
  }>> => {
    const response = await api.get(
      `/order-preparation/${orderNumber}/qb-estimate/email-history`
    );
    // Transform snake_case from backend to camelCase
    const rawData = response.data as any[];
    return rawData.map(item => ({
      id: item.id,
      emailType: item.email_type,
      recipientEmails: item.recipient_emails,
      ccEmails: item.cc_emails,
      subject: item.subject,
      status: item.status,
      scheduledFor: item.scheduled_for,
      sentAt: item.sent_at,
      createdAt: item.created_at
    }));
  }
};
