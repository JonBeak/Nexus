import api from './api';

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

  createJob: async (data: { customer_id: number; job_name: string }) => {
    const response = await api.post('/job-estimation/jobs', data);
    return response.data;
  },

  getJobDetails: async (jobId: number) => {
    const response = await api.get(`/job-estimation/jobs/${jobId}`);
    return response.data;
  },

  // Estimate Version Management
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
    console.log('🔍 [jobVersioningApi.loadGridData] Fetching grid data for estimateId:', estimateId);
    const response = await api.get(`/job-estimation/estimates/${estimateId}/grid-data`);
    console.log('📦 [jobVersioningApi.loadGridData] Response received:', {
      estimateId,
      data: response.data,
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
      length: Array.isArray(response.data) ? response.data.length : 'N/A'
    });
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

  updateJob: async (jobId: number, jobName: string) => {
    const response = await api.put(`/job-estimation/jobs/${jobId}`, {
      job_name: jobName
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
  }
};