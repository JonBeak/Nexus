/**
 * Feedback Service
 * Business logic layer for feedback system
 *
 * Created: 2026-01-16
 * Updated: 2026-01-16 - Screenshots now stored in Google Drive
 * Purpose: Handle feedback submission, viewing, and management
 */

import { feedbackRepository } from '../repositories/feedbackRepository';
import { ServiceResult } from '../types/serviceResults';
import {
  FeedbackFilters,
  FeedbackListResponse,
  FeedbackDetailResponse,
  CreateFeedbackData,
  FeedbackStatus,
  FeedbackPriority
} from '../types/feedback';
import * as driveService from './driveService';

// Maximum screenshot size (10MB base64)
const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024;

// Valid status values
const VALID_STATUSES: FeedbackStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

// Valid priority values
const VALID_PRIORITIES: FeedbackPriority[] = ['low', 'medium', 'high', 'critical'];

export class FeedbackService {
  // ==========================================================================
  // Create Feedback
  // ==========================================================================

  /**
   * Create a new feedback request
   * Screenshots are uploaded to Google Drive
   */
  async createFeedback(
    data: CreateFeedbackData,
    userId: number,
    userAgent?: string
  ): Promise<ServiceResult<number>> {
    try {
      // Validate required fields
      if (!data.title?.trim()) {
        return { success: false, error: 'Title is required', code: 'VALIDATION_ERROR' };
      }
      if (!data.description?.trim()) {
        return { success: false, error: 'Description is required', code: 'VALIDATION_ERROR' };
      }

      // Validate screenshot if provided
      if (data.screenshot_data) {
        if (data.screenshot_data.length > MAX_SCREENSHOT_SIZE) {
          return { success: false, error: 'Screenshot too large (max 10MB)', code: 'VALIDATION_ERROR' };
        }
      }

      // First create feedback record to get the ID
      const feedbackId = await feedbackRepository.createFeedback(
        {
          title: data.title.trim(),
          description: data.description.trim(),
          screenshot_filename: data.screenshot_filename,
          screenshot_mime_type: data.screenshot_mime_type,
          page_url: data.page_url
        },
        userId,
        userAgent
      );

      // Upload screenshot to Drive if provided
      if (data.screenshot_data && data.screenshot_filename && data.screenshot_mime_type) {
        try {
          const driveFileId = await driveService.uploadScreenshot(
            data.screenshot_data,
            data.screenshot_filename,
            data.screenshot_mime_type,
            feedbackId
          );

          // Update feedback with Drive file ID
          await feedbackRepository.updateScreenshotDriveId(feedbackId, driveFileId);
        } catch (driveError) {
          console.error('Failed to upload screenshot to Drive:', driveError);
          // Don't fail the feedback creation, just log the error
          // The feedback is still created without the screenshot
        }
      }

      return { success: true, data: feedbackId };
    } catch (error) {
      console.error('Error creating feedback:', error);
      return { success: false, error: 'Failed to create feedback', code: 'DATABASE_ERROR' };
    }
  }

  // ==========================================================================
  // Get Feedback List
  // ==========================================================================

  /**
   * Get paginated list of feedback requests
   * Non-managers only see their own submissions
   */
  async getFeedbackList(
    filters: FeedbackFilters,
    requestingUserId: number,
    isManager: boolean
  ): Promise<ServiceResult<FeedbackListResponse>> {
    try {
      // Non-managers can only see their own feedback
      if (!isManager) {
        filters.submittedBy = requestingUserId;
      }

      const { items, total } = await feedbackRepository.getFeedbackList(filters);
      return {
        success: true,
        data: {
          items,
          total,
          limit: filters.limit || 20,
          offset: filters.offset || 0
        }
      };
    } catch (error) {
      console.error('Error fetching feedback list:', error);
      return { success: false, error: 'Failed to fetch feedback', code: 'DATABASE_ERROR' };
    }
  }

  // ==========================================================================
  // Get Single Feedback
  // ==========================================================================

  /**
   * Get a single feedback request with its responses
   * Non-managers can only see their own submissions and public responses
   */
  async getFeedbackById(
    feedbackId: number,
    requestingUserId: number,
    isManager: boolean
  ): Promise<ServiceResult<FeedbackDetailResponse>> {
    try {
      const feedback = await feedbackRepository.getFeedbackById(feedbackId);
      if (!feedback) {
        return { success: false, error: 'Feedback not found', code: 'NOT_FOUND' };
      }

      // Permission check: non-managers can only see their own
      if (!isManager && feedback.submitted_by !== requestingUserId) {
        return { success: false, error: 'Access denied', code: 'FORBIDDEN' };
      }

      // Get responses (non-managers don't see internal responses)
      const responses = await feedbackRepository.getResponses(feedbackId, isManager);

      return { success: true, data: { feedback, responses } };
    } catch (error) {
      console.error('Error fetching feedback:', error);
      return { success: false, error: 'Failed to fetch feedback', code: 'DATABASE_ERROR' };
    }
  }

  // ==========================================================================
  // Update Status (Manager only)
  // ==========================================================================

  /**
   * Update feedback status
   * Should be called only by managers (enforced at route level)
   * When marking as 'closed', deletes associated Drive screenshot
   */
  async updateStatus(
    feedbackId: number,
    status: FeedbackStatus
  ): Promise<ServiceResult<void>> {
    try {
      if (!VALID_STATUSES.includes(status)) {
        return { success: false, error: 'Invalid status', code: 'VALIDATION_ERROR' };
      }

      const feedback = await feedbackRepository.getFeedbackById(feedbackId);
      if (!feedback) {
        return { success: false, error: 'Feedback not found', code: 'NOT_FOUND' };
      }

      await feedbackRepository.updateStatus(feedbackId, status);

      // Clean up Drive screenshot when feedback is closed
      if (status === 'closed' && feedback.screenshot_drive_id) {
        try {
          await driveService.deleteScreenshot(feedback.screenshot_drive_id);
          console.log(`[Feedback] Deleted Drive screenshot for feedback #${feedbackId}`);
        } catch (driveError) {
          // Log but don't fail - screenshot cleanup is best-effort
          console.error('Failed to delete Drive screenshot:', driveError);
        }
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error updating feedback status:', error);
      return { success: false, error: 'Failed to update status', code: 'DATABASE_ERROR' };
    }
  }

  // ==========================================================================
  // Update Priority (Manager only)
  // ==========================================================================

  /**
   * Update feedback priority
   * Should be called only by managers (enforced at route level)
   */
  async updatePriority(
    feedbackId: number,
    priority: FeedbackPriority
  ): Promise<ServiceResult<void>> {
    try {
      if (!VALID_PRIORITIES.includes(priority)) {
        return { success: false, error: 'Invalid priority', code: 'VALIDATION_ERROR' };
      }

      const feedback = await feedbackRepository.getFeedbackById(feedbackId);
      if (!feedback) {
        return { success: false, error: 'Feedback not found', code: 'NOT_FOUND' };
      }

      await feedbackRepository.updatePriority(feedbackId, priority);
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error updating feedback priority:', error);
      return { success: false, error: 'Failed to update priority', code: 'DATABASE_ERROR' };
    }
  }

  // ==========================================================================
  // Add Response
  // ==========================================================================

  /**
   * Add a response to a feedback request
   * Internal notes can only be added by managers
   * Non-managers can only respond to their own feedback
   */
  async addResponse(
    feedbackId: number,
    userId: number,
    message: string,
    isInternal: boolean,
    isManager: boolean
  ): Promise<ServiceResult<number>> {
    try {
      if (!message?.trim()) {
        return { success: false, error: 'Message is required', code: 'VALIDATION_ERROR' };
      }

      const feedback = await feedbackRepository.getFeedbackById(feedbackId);
      if (!feedback) {
        return { success: false, error: 'Feedback not found', code: 'NOT_FOUND' };
      }

      // Only managers can add internal responses
      if (isInternal && !isManager) {
        return { success: false, error: 'Only managers can add internal notes', code: 'FORBIDDEN' };
      }

      // Non-managers can only respond to their own feedback
      if (!isManager && feedback.submitted_by !== userId) {
        return { success: false, error: 'Access denied', code: 'FORBIDDEN' };
      }

      const responseId = await feedbackRepository.addResponse(
        feedbackId,
        userId,
        message.trim(),
        isInternal
      );

      return { success: true, data: responseId };
    } catch (error) {
      console.error('Error adding response:', error);
      return { success: false, error: 'Failed to add response', code: 'DATABASE_ERROR' };
    }
  }

  // ==========================================================================
  // Screenshot Retrieval
  // ==========================================================================

  /**
   * Get screenshot from Google Drive
   * Verifies user has permission to view the feedback first
   */
  async getScreenshot(
    feedbackId: number,
    requestingUserId: number,
    isManager: boolean
  ): Promise<ServiceResult<{ data: string; mimeType: string }>> {
    try {
      const feedback = await feedbackRepository.getFeedbackById(feedbackId);
      if (!feedback) {
        return { success: false, error: 'Feedback not found', code: 'NOT_FOUND' };
      }

      // Permission check: non-managers can only see their own
      if (!isManager && feedback.submitted_by !== requestingUserId) {
        return { success: false, error: 'Access denied', code: 'FORBIDDEN' };
      }

      if (!feedback.screenshot_drive_id) {
        return { success: false, error: 'No screenshot attached', code: 'NOT_FOUND' };
      }

      const screenshot = await driveService.getScreenshot(feedback.screenshot_drive_id);
      if (!screenshot) {
        return { success: false, error: 'Screenshot not found in Drive', code: 'NOT_FOUND' };
      }

      return { success: true, data: screenshot };
    } catch (error) {
      console.error('Error fetching screenshot:', error);
      return { success: false, error: 'Failed to fetch screenshot', code: 'INTERNAL_ERROR' };
    }
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get count of open/in_progress feedback requests
   * For managers: all open feedback
   * For non-managers: only their own
   */
  async getOpenCount(userId: number, isManager: boolean): Promise<ServiceResult<number>> {
    try {
      const count = isManager
        ? await feedbackRepository.getOpenCount()
        : await feedbackRepository.getOpenCountForUser(userId);
      return { success: true, data: count };
    } catch (error) {
      console.error('Error getting open count:', error);
      return { success: false, error: 'Failed to get count', code: 'DATABASE_ERROR' };
    }
  }
}

export const feedbackService = new FeedbackService();
