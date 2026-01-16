/**
 * Feedback API Module
 * Client for feedback/error reporting/feature request system
 *
 * Created: 2026-01-16
 */

import { api } from '../apiClient';

// =============================================================================
// Types
// =============================================================================

export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

export interface FeedbackRequest {
  feedback_id: number;
  submitted_by: number;
  title: string;
  description: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  screenshot_drive_id?: string;  // Google Drive file ID
  screenshot_filename?: string;
  screenshot_mime_type?: string;
  page_url?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  closed_at?: string;
  submitter_first_name?: string;
  submitter_last_name?: string;
}

export interface FeedbackResponse {
  response_id: number;
  feedback_id: number;
  responded_by: number;
  message: string;
  is_internal: boolean;
  created_at: string;
  responder_first_name?: string;
  responder_last_name?: string;
}

export interface CreateFeedbackData {
  title: string;
  description: string;
  screenshot_data?: string;
  screenshot_filename?: string;
  screenshot_mime_type?: string;
  page_url?: string;
}

export interface FeedbackFilters {
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  limit?: number;
  offset?: number;
}

export interface FeedbackListResponse {
  items: FeedbackRequest[];
  total: number;
  limit: number;
  offset: number;
}

export interface FeedbackDetailResponse {
  feedback: FeedbackRequest;
  responses: FeedbackResponse[];
}

// =============================================================================
// API Functions
// =============================================================================

export const feedbackApi = {
  /**
   * Create new feedback request
   */
  create: async (data: CreateFeedbackData): Promise<number> => {
    const response = await api.post('/feedback', data);
    return response.data;
  },

  /**
   * Get list of feedback requests
   * Non-managers see only their own, managers see all
   */
  getList: async (filters: FeedbackFilters = {}): Promise<FeedbackListResponse> => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.limit) params.set('limit', filters.limit.toString());
    if (filters.offset) params.set('offset', filters.offset.toString());

    const response = await api.get(`/feedback?${params.toString()}`);
    return response.data;
  },

  /**
   * Get single feedback with responses
   */
  getById: async (feedbackId: number): Promise<FeedbackDetailResponse> => {
    const response = await api.get(`/feedback/${feedbackId}`);
    return response.data;
  },

  /**
   * Update feedback status (Manager+)
   */
  updateStatus: async (feedbackId: number, status: FeedbackStatus): Promise<void> => {
    await api.patch(`/feedback/${feedbackId}/status`, { status });
  },

  /**
   * Update feedback priority (Manager+)
   */
  updatePriority: async (feedbackId: number, priority: FeedbackPriority): Promise<void> => {
    await api.patch(`/feedback/${feedbackId}/priority`, { priority });
  },

  /**
   * Add response to feedback
   */
  addResponse: async (
    feedbackId: number,
    message: string,
    isInternal: boolean = false
  ): Promise<number> => {
    const response = await api.post(`/feedback/${feedbackId}/responses`, {
      message,
      is_internal: isInternal
    });
    return response.data;
  },

  /**
   * Get open feedback count
   */
  getOpenCount: async (): Promise<number> => {
    const response = await api.get('/feedback/stats/open-count');
    return response.data;
  },

  /**
   * Get screenshot from Google Drive
   */
  getScreenshot: async (feedbackId: number): Promise<{ data: string; mimeType: string }> => {
    const response = await api.get(`/feedback/${feedbackId}/screenshot`);
    return response.data;
  }
};
