/**
 * AI File Validation API
 * Frontend API module - simplified, no database tracking
 */

import { api } from '../apiClient';
import {
  AiFileInfo,
  ValidateFilesResponse,
  ExpectedFilesComparison,
} from '../../types/aiFileValidation';

export const aiFileValidationApi = {
  /**
   * List AI files in order folder
   */
  listFiles: async (orderNumber: number): Promise<AiFileInfo[]> => {
    const response = await api.get(`/orders/${orderNumber}/ai-files`);
    return response.data;
  },

  /**
   * Run validation on AI files
   */
  validateFiles: async (orderNumber: number): Promise<ValidateFilesResponse> => {
    const response = await api.post(`/orders/${orderNumber}/ai-files/validate`, {});
    return response.data;
  },

  /**
   * Approve files (acknowledgement only, no database)
   */
  approveFiles: async (orderNumber: number): Promise<{ approved: boolean }> => {
    const response = await api.post(`/orders/${orderNumber}/ai-files/approve`, {});
    return response.data;
  },

  /**
   * Get expected files comparison (rule-based)
   * Compares expected files (from rules) against actual files in order folder
   */
  getExpectedFilesComparison: async (orderNumber: number): Promise<ExpectedFilesComparison> => {
    const response = await api.get(`/orders/${orderNumber}/expected-files/compare`);
    return response.data;
  },
};
