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
   * Save all PDFs to order folder
   */
  savePDFsToFolder: async (orderNumber: number) => {
    const response = await api.post(
      `/order-preparation/${orderNumber}/pdfs/save-to-folder`
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
  }
};
