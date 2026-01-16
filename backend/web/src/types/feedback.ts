/**
 * Feedback System Type Definitions
 * Created: 2026-01-16
 * Purpose: Types for feedback/error reporting/feature request system
 */

// =============================================
// STATUS AND PRIORITY ENUMS
// =============================================

export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

// =============================================
// FEEDBACK REQUEST TYPES
// =============================================

export interface FeedbackRequest {
  feedback_id: number;
  submitted_by: number;
  title: string;
  description: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  screenshot_drive_id: string | null;  // Google Drive file ID
  screenshot_filename: string | null;
  screenshot_mime_type: string | null;
  page_url: string | null;
  user_agent: string | null;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  closed_at: Date | null;
  // Joined fields
  submitter_first_name?: string;
  submitter_last_name?: string;
}

export interface CreateFeedbackData {
  title: string;
  description: string;
  screenshot_data?: string;
  screenshot_filename?: string;
  screenshot_mime_type?: string;
  page_url?: string;
}

export interface UpdateFeedbackData {
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
}

// =============================================
// FEEDBACK RESPONSE TYPES
// =============================================

export interface FeedbackResponse {
  response_id: number;
  feedback_id: number;
  responded_by: number;
  message: string;
  is_internal: boolean;
  created_at: Date;
  // Joined fields
  responder_first_name?: string;
  responder_last_name?: string;
}

export interface CreateResponseData {
  message: string;
  is_internal?: boolean;
}

// =============================================
// FILTER AND PAGINATION TYPES
// =============================================

export interface FeedbackFilters {
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  submittedBy?: number;
  limit?: number;
  offset?: number;
}

export interface FeedbackListResponse {
  items: FeedbackRequest[];
  total: number;
  limit: number;
  offset: number;
}

// =============================================
// DETAIL RESPONSE TYPE
// =============================================

export interface FeedbackDetailResponse {
  feedback: FeedbackRequest;
  responses: FeedbackResponse[];
}
