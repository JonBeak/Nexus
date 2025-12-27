// File Clean up Finished: 2025-11-25
import { api } from './apiClient';

// Job Estimation Versioning API
export const jobVersioningApi = {
  // Job Management
  getAllJobsWithActivity: async () => {
    const response = await api.get('/job-estimation/jobs/all-with-activity');
    return response.data;
  },

  getJobsByCustomer: async (customerId: number) => {
    const response = await api.get(`/job-estimation/customers/${customerId}/jobs`);
    return response.data;
  },

  validateJobName: async (customerId: number, jobName: string) => {
    const response = await api.post(`/job-estimation/jobs/validate-name`, {
      customer_id: customerId,
      job_name: jobName
    });
    return response.data;
  },

  createJob: async (data: { customer_id: number; job_name: string; customer_job_number?: string }) => {
    const response = await api.post('/job-estimation/jobs', data);
    return response.data;
  },

  getJobDetails: async (jobId: number) => {
    const response = await api.get(`/job-estimation/jobs/${jobId}`);
    return response.data;
  },

  // URL-based navigation support
  getCustomerByName: async (companyName: string): Promise<{ customer_id: number; company_name: string }> => {
    const response = await api.get(`/customers/by-name/${encodeURIComponent(companyName)}`);
    return response.data;
  },

  getJobByName: async (customerId: number, jobName: string): Promise<{ job_id: number; job_name: string; customer_id: number }> => {
    const response = await api.get(`/job-estimation/customers/${customerId}/jobs/by-name/${encodeURIComponent(jobName)}`);
    return response.data;
  },

  // Estimate Version Management
  getEstimateById: async (estimateId: number) => {
    const response = await api.get(`/job-estimation/estimates/${estimateId}`);
    return response.data;
  },

  // Estimate Lookup (for Copy Rows feature)
  lookupEstimate: async (params: { qbDocNumber?: string; estimateId?: number }) => {
    const queryParams = new URLSearchParams();
    if (params.qbDocNumber) queryParams.append('qbDocNumber', params.qbDocNumber);
    if (params.estimateId) queryParams.append('estimateId', params.estimateId.toString());
    const response = await api.get(`/job-estimation/estimates/lookup?${queryParams.toString()}`);
    return response.data;
  },

  getEstimateVersions: async (jobId: number) => {
    const response = await api.get(`/job-estimation/jobs/${jobId}/estimates`);
    return response.data;
  },

  createEstimateVersion: async (jobId: number, data?: { parent_estimate_id?: number; notes?: string }) => {
    const response = await api.post(`/job-estimation/jobs/${jobId}/estimates`, data || {});
    return response.data;
  },

  duplicateEstimate: async (estimateId: number, data?: { target_job_id?: number; notes?: string }) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/duplicate`, data || {});
    return response.data;
  },

  updateEstimateNotes: async (estimateId: number, notes: string) => {
    const response = await api.patch(`/job-estimation/estimates/${estimateId}/notes`, { notes });
    return response.data;
  },

  // Draft/Final Workflow  
  saveDraft: async (estimateId: number) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/save-draft`);
    return response.data;
  },

  // Phase 4: Grid Data Persistence
  saveGridData: async (estimateId: number, gridRows: any[], total?: number) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/grid-data`, {
      gridRows,
      total
    });
    return response.data;
  },

  loadGridData: async (estimateId: number) => {
    const response = await api.get(`/job-estimation/estimates/${estimateId}/grid-data`);
    return response.data;
  },

  finalizeEstimate: async (estimateId: number, data: { status: 'sent' | 'approved' | 'ordered' | 'deactivated' }) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/finalize`, data);
    return response.data;
  },

  // Edit Lock System - REMOVED Nov 14, 2025
  // Legacy lock methods removed (acquireEditLock, releaseEditLock, checkEditLock, overrideEditLock)
  // Now using generic lockService from services/lockService.ts (resource_locks table)
  // See useVersionLocking hook for current implementation

  // Enhanced Status System
  sendEstimate: async (estimateId: number) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/send`);
    return response.data;
  },

  approveEstimate: async (estimateId: number) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/approve`);
    return response.data;
  },

  markNotApproved: async (estimateId: number) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/not-approved`);
    return response.data;
  },

  retractEstimate: async (estimateId: number) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/retract`);
    return response.data;
  },

  convertToOrder: async (estimateId: number) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/convert-to-order`);
    return response.data;
  },

  // Permission Check
  canEditEstimate: async (estimateId: number) => {
    const response = await api.get(`/job-estimation/estimates/${estimateId}/can-edit`);
    return response.data;
  },

  // Multiple orders support
  checkExistingOrders: async (jobId: number) => {
    const response = await api.get(`/job-estimation/jobs/${jobId}/check-existing-orders`);
    return response.data;
  },

  createAdditionalJobForOrder: async (originalJobId: number, estimateId: number, newJobName: string) => {
    const response = await api.post('/job-estimation/jobs/create-additional-for-order', {
      original_job_id: originalJobId,
      estimate_id: estimateId,
      new_job_name: newJobName
    });
    return response.data;
  },

  suggestJobNameSuffix: async (jobId: number, baseJobName: string) => {
    const response = await api.post(`/job-estimation/jobs/${jobId}/suggest-name-suffix`, {
      baseJobName
    });
    return response.data;
  },

  updateJob: async (jobId: number, jobName: string, customerJobNumber?: string) => {
    const response = await api.put(`/job-estimation/jobs/${jobId}`, {
      job_name: jobName,
      customer_job_number: customerJobNumber
    });
    return response.data;
  },

  // Clear All estimate items
  resetEstimateItems: async (estimateId: number) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/reset`);
    return response.data;
  },

  clearAllEstimateItems: async (estimateId: number) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/clear-all`);
    return response.data;
  },

  clearEmptyItems: async (estimateId: number) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/clear-empty`);
    return response.data;
  },

  addTemplateSection: async (estimateId: number) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/add-section`);
    return response.data;
  },

  /**
   * Copy rows from another estimate and append to target estimate
   * @param targetEstimateId - The estimate to copy rows TO
   * @param sourceEstimateId - The estimate to copy rows FROM
   * @param rowIds - Array of database IDs of rows to copy
   */
  copyRowsToEstimate: async (targetEstimateId: number, sourceEstimateId: number, rowIds: number[]) => {
    const response = await api.post(`/job-estimation/estimates/${targetEstimateId}/copy-rows`, {
      sourceEstimateId,
      rowIds
    });
    return response.data;
  },

  // =============================================
  // ESTIMATE WORKFLOW - Phase 4c (Prepare to Send / Send to Customer)
  // =============================================

  /**
   * Get the email template for sending estimates
   */
  getEstimateSendTemplate: async () => {
    const response = await api.get('/job-estimation/estimates/template/send-email');
    return response.data;
  },

  /**
   * Prepare estimate for sending
   * - Cleans empty rows
   * - Saves point persons and email content (3-part structure)
   * - Locks the estimate
   */
  prepareEstimate: async (
    estimateId: number,
    data: {
      emailSubject?: string;
      emailBeginning?: string;
      emailEnd?: string;
      emailSummaryConfig?: {
        includeJobName: boolean;
        includeCustomerRef: boolean;
        includeQbEstimateNumber: boolean;
        includeSubtotal: boolean;
        includeTax: boolean;
        includeTotal: boolean;
        includeEstimateDate: boolean;
        includeValidUntilDate: boolean;
      };
      pointPersons?: Array<{
        contact_id?: number;
        contact_email: string;
        contact_name?: string;
        contact_phone?: string;
        contact_role?: string;
        saveToDatabase?: boolean;
      }>;
      estimatePreviewData?: any;
    }
  ) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/prepare`, data);
    return response.data;
  },

  /**
   * Send estimate to customer
   * - Creates QB estimate
   * - Sends email to point persons
   */
  sendEstimateToCustomer: async (estimateId: number, estimatePreviewData?: any, recipientEmails?: string[]) => {
    const response = await api.post(`/job-estimation/estimates/${estimateId}/send-to-customer`, {
      estimatePreviewData,
      recipientEmails
    });
    return response.data;
  },

  /**
   * Get point persons for an estimate
   */
  getEstimatePointPersons: async (estimateId: number) => {
    const response = await api.get(`/job-estimation/estimates/${estimateId}/point-persons`);
    return response.data;
  },

  /**
   * Update point persons for an estimate
   */
  updateEstimatePointPersons: async (
    estimateId: number,
    pointPersons: Array<{
      contact_id?: number;
      contact_email: string;
      contact_name?: string;
      contact_phone?: string;
      contact_role?: string;
      saveToDatabase?: boolean;
    }>
  ) => {
    const response = await api.put(`/job-estimation/estimates/${estimateId}/point-persons`, {
      pointPersons
    });
    return response.data;
  },

  /**
   * Get email content for an estimate
   */
  getEstimateEmailContent: async (estimateId: number) => {
    const response = await api.get(`/job-estimation/estimates/${estimateId}/email-content`);
    return response.data;
  },

  /**
   * Update email content for an estimate (3-part structure)
   */
  updateEstimateEmailContent: async (
    estimateId: number,
    subject: string | null,
    beginning: string | null,
    end: string | null,
    summaryConfig?: {
      includeJobName: boolean;
      includeCustomerRef: boolean;
      includeQbEstimateNumber: boolean;
      includeSubtotal: boolean;
      includeTax: boolean;
      includeTotal: boolean;
      includeEstimateDate: boolean;
      includeValidUntilDate: boolean;
    } | null
  ) => {
    const response = await api.put(`/job-estimation/estimates/${estimateId}/email-content`, {
      subject,
      beginning,
      end,
      summaryConfig
    });
    return response.data;
  },

  /**
   * Get email preview HTML for modal display
   * POST request with email content in body for preview generation
   */
  getEstimateEmailPreview: async (
    estimateId: number,
    recipients: string,
    emailContent?: {
      subject?: string;
      beginning?: string;
      end?: string;
      summaryConfig?: {
        includeJobName: boolean;
        includeCustomerRef: boolean;
        includeQbEstimateNumber: boolean;
        includeSubtotal: boolean;
        includeTax: boolean;
        includeTotal: boolean;
        includeEstimateDate: boolean;
        includeValidUntilDate: boolean;
      };
      estimateData?: {
        jobName?: string;
        customerJobNumber?: string;
        qbEstimateNumber?: string;
        subtotal?: number;
        tax?: number;
        total?: number;
        estimateDate?: string;
      };
    }
  ) => {
    const response = await api.post(
      `/job-estimation/estimates/${estimateId}/email-preview`,
      {
        recipients,
        ...emailContent
      }
    );
    return response.data;
  },

  // =============================================
  // QB LINE DESCRIPTIONS (Phase 4.c)
  // =============================================

  /**
   * Get QB descriptions for an estimate
   */
  getEstimateLineDescriptions: async (estimateId: number) => {
    const response = await api.get(`/job-estimation/estimates/${estimateId}/line-descriptions`);
    return response.data;
  },

  /**
   * Update QB descriptions for an estimate
   */
  updateEstimateLineDescriptions: async (
    estimateId: number,
    updates: Array<{ line_index: number; qb_description: string }>
  ) => {
    const response = await api.put(
      `/job-estimation/estimates/${estimateId}/line-descriptions`,
      { updates }
    );
    return response.data;
  },

  // =============================================
  // QB ESTIMATE PDF (Phase 4.c - PDF Preview in Send Modal)
  // =============================================

  /**
   * Get QB estimate PDF for preview in Send to Customer modal
   * Returns base64-encoded PDF
   */
  getEstimatePdf: async (estimateId: number): Promise<{ success: boolean; data: { pdf: string; filename: string } }> => {
    const response = await api.get(`/job-estimation/estimates/${estimateId}/qb-pdf`);
    return response.data;
  },

  // =============================================
  // PREPARATION TABLE (Phase 4.e - Editable QB Estimate Rows)
  // =============================================

  /**
   * Get all preparation items for an estimate
   */
  getPreparationItems: async (estimateId: number) => {
    const response = await api.get(`/job-estimation/estimates/${estimateId}/preparation-items`);
    return response.data;
  },

  /**
   * Get preparation table totals
   */
  getPreparationTotals: async (estimateId: number) => {
    const response = await api.get(`/job-estimation/estimates/${estimateId}/preparation-items/totals`);
    return response.data;
  },

  /**
   * Update a single preparation item
   */
  updatePreparationItem: async (
    estimateId: number,
    itemId: number,
    updates: {
      item_name?: string;
      qb_description?: string | null;
      quantity?: number;
      unit_price?: number;
      extended_price?: number;
      is_description_only?: boolean;
      qb_item_id?: string | null;
      qb_item_name?: string | null;
    }
  ) => {
    const response = await api.put(
      `/job-estimation/estimates/${estimateId}/preparation-items/${itemId}`,
      updates
    );
    return response.data;
  },

  /**
   * Add a new preparation item
   */
  addPreparationItem: async (
    estimateId: number,
    item: {
      item_name: string;
      qb_description?: string | null;
      quantity?: number;
      unit_price?: number;
      is_description_only?: boolean;
      qb_item_id?: string | null;
      qb_item_name?: string | null;
    },
    afterDisplayOrder?: number
  ) => {
    const response = await api.post(
      `/job-estimation/estimates/${estimateId}/preparation-items`,
      { ...item, afterDisplayOrder }
    );
    return response.data;
  },

  /**
   * Delete a preparation item
   */
  deletePreparationItem: async (estimateId: number, itemId: number) => {
    const response = await api.delete(
      `/job-estimation/estimates/${estimateId}/preparation-items/${itemId}`
    );
    return response.data;
  },

  /**
   * Reorder preparation items (for drag-and-drop)
   */
  reorderPreparationItems: async (estimateId: number, itemIds: number[]) => {
    const response = await api.post(
      `/job-estimation/estimates/${estimateId}/preparation-items/reorder`,
      { itemIds }
    );
    return response.data;
  },

  /**
   * Toggle row type between regular and description-only
   */
  togglePreparationItemType: async (estimateId: number, itemId: number) => {
    const response = await api.post(
      `/job-estimation/estimates/${estimateId}/preparation-items/${itemId}/toggle-type`
    );
    return response.data;
  }
};