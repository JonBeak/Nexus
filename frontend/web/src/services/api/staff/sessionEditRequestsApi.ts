/**
 * Session Edit Requests API
 * API client for task session edit request operations
 *
 * Created: 2025-01-15
 */

import { api } from '../../apiClient';

// Types for session edit requests
export interface SessionEditRequestData {
  session_id: number;
  requested_started_at: string;
  requested_ended_at: string | null;
  requested_notes?: string | null;
  reason: string;
}

export interface SessionDeleteRequestData {
  session_id: number;
  reason: string;
}

export interface ProcessRequestData {
  request_id: number;
  action: 'approve' | 'reject' | 'modify';
  modified_started_at?: string;
  modified_ended_at?: string | null;
  modified_notes?: string | null;
  reviewer_notes?: string;
}

export interface PendingSessionEditRequest {
  request_id: number;
  session_id: number;
  user_id: number;
  requested_started_at: string | null;
  requested_ended_at: string | null;
  requested_notes: string | null;
  reason: string;
  request_type: 'edit' | 'delete';
  status: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
  // Original session values
  original_started_at: string;
  original_ended_at: string | null;
  original_duration_minutes: number | null;
  original_notes: string | null;
  // Task/Order info
  task_id: number;
  task_name: string;
  order_id: number;
  order_number: string;
  order_name: string;
  // User info
  first_name: string;
  last_name: string;
  username: string;
}

export interface UpdateEditRequestData {
  request_id: number;
  requested_started_at: string;
  requested_ended_at: string | null;
  requested_notes?: string | null;
  reason: string;
}

export interface SessionPendingRequest {
  request_id: number;
  session_id: number;
  user_id: number;
  requested_started_at: string | null;
  requested_ended_at: string | null;
  requested_notes: string | null;
  reason: string;
  request_type: 'edit' | 'delete';
  status: string;
  created_at: string;
}

/**
 * Session Edit Requests API
 */
export const sessionEditRequestsApi = {
  /**
   * Submit an edit request for a session
   */
  submitEditRequest: async (data: SessionEditRequestData): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/staff/sessions/edit-request', data);
    return response.data;
  },

  /**
   * Update a pending edit request
   */
  updateEditRequest: async (data: UpdateEditRequestData): Promise<{ success: boolean; message: string }> => {
    const response = await api.put('/staff/sessions/edit-request', data);
    return response.data;
  },

  /**
   * Cancel a pending edit request (staff can cancel their own)
   */
  cancelRequest: async (requestId: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/staff/sessions/edit-request/${requestId}/cancel`);
    return response.data;
  },

  /**
   * Get pending request for a specific session
   */
  getPendingRequestForSession: async (sessionId: number): Promise<SessionPendingRequest | null> => {
    const response = await api.get(`/staff/sessions/${sessionId}/pending-request`);
    return response.data || null;
  },

  /**
   * Submit a delete request for a session
   */
  submitDeleteRequest: async (data: SessionDeleteRequestData): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/staff/sessions/delete-request', data);
    return response.data;
  },

  /**
   * Get pending session edit requests (manager only)
   */
  getPendingRequests: async (): Promise<PendingSessionEditRequest[]> => {
    const response = await api.get('/staff/sessions/pending-requests');
    return response.data.data || response.data;
  },

  /**
   * Get pending request count (manager only)
   */
  getPendingCount: async (): Promise<number> => {
    const response = await api.get('/staff/sessions/pending-count');
    return response.data.data?.count || response.data.count || 0;
  },

  /**
   * Process a session edit request (manager only)
   */
  processRequest: async (data: ProcessRequestData): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/staff/sessions/process-request', data);
    return response.data;
  }
};
