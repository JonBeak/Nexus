import { api } from '../apiClient';

/**
 * Print API
 * Handles printing operations for order forms and documents
 */
export const printApi = {
  /**
   * Get available printers
   */
  async getAvailablePrinters(): Promise<{
    success: boolean;
    printers: Array<{ name: string; isDefault: boolean; status: string }>;
  }> {
    const response = await api.get('/print/printers');
    return response.data;
  },

  /**
   * Print order form
   * @param orderNumber - Order number
   * @param formType - Type of form (master/customer/shop)
   * @param printerName - Optional specific printer name
   */
  async printOrderForm(
    orderNumber: number,
    formType: 'master' | 'customer' | 'shop' = 'master',
    printerName?: string
  ): Promise<{
    success: boolean;
    message: string;
    jobId?: string;
    orderNumber: number;
    formType: string;
  }> {
    const response = await api.post(`/print/order-form/${orderNumber}`, {
      formType,
      printerName
    });
    return response.data;
  },

  /**
   * Get print job status
   * @param jobId - Print job ID
   */
  async getPrintJobStatus(jobId: string): Promise<{
    success: boolean;
    jobId: string;
    status: string;
    details: string;
  }> {
    const response = await api.get(`/print/job/${jobId}`);
    return response.data;
  },

  /**
   * Cancel print job
   * @param jobId - Print job ID
   */
  async cancelPrintJob(jobId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.delete(`/print/job/${jobId}`);
    return response.data;
  },

  /**
   * Print multiple order forms with quantities
   * @param orderNumber - Order number
   * @param quantities - Quantity for each form type
   * @param printerName - Optional specific printer name
   */
  async printOrderFormsBatch(
    orderNumber: number,
    quantities: {
      master: number;
      estimate: number;
      shop: number;
      packing: number;
    },
    printerName?: string
  ): Promise<{
    success: boolean;
    message: string;
    orderNumber: number;
    results: Array<{
      formType: string;
      copy: number;
      success: boolean;
      jobId?: string;
      message?: string;
      error?: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    const response = await api.post(`/print/order-forms-batch/${orderNumber}`, {
      quantities,
      printerName
    });
    return response.data;
  }
};
