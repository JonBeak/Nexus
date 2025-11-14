import { api } from '../../apiClient';

/**
 * Time Requests API
 * Manages edit and delete requests with approval workflow
 */
export const timeRequestsApi = {
  /**
   * Submit edit request
   */
  submitEditRequest: async (data: {
    entry_id: number;
    requested_clock_in: string;
    requested_clock_out: string;
    requested_break_minutes: number;
    reason: string;
  }) => {
    const response = await api.post('/time/edit-request', data);
    return response.data;
  },

  /**
   * Submit delete request
   */
  submitDeleteRequest: async (data: {
    entry_id: number;
    reason: string;
  }) => {
    const response = await api.post('/time/delete-request', data);
    return response.data;
  },

  /**
   * Get pending requests
   */
  getPendingRequests: async () => {
    const response = await api.get('/time/pending-requests');
    return response.data;
  },

  /**
   * Process request (approve/reject/modify)
   */
  processRequest: async (data: {
    request_id: number;
    action: 'approve' | 'reject' | 'modify';
    reviewer_notes: string;
    modified_clock_in?: string;
    modified_clock_out?: string;
    modified_break_minutes?: number;
  }) => {
    const response = await api.post('/time/process-request', data);
    return response.data;
  },
};
