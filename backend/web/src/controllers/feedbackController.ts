/**
 * Feedback Controller
 * HTTP request handling for feedback system
 *
 * Created: 2026-01-16
 * Purpose: Handle API requests for feedback/error reporting/feature requests
 */

import { Request, Response } from 'express';
import { feedbackService } from '../services/feedbackService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../utils/controllerHelpers';
import { FeedbackStatus, FeedbackPriority } from '../types/feedback';

// Extended request type with user
interface AuthenticatedRequest extends Request {
  user?: {
    user_id: number;
    role: string;
  };
}

/**
 * Helper to check if user is a manager or owner
 */
function isManager(role: string): boolean {
  return role === 'manager' || role === 'owner';
}

export class FeedbackController {
  // ==========================================================================
  // Create Feedback
  // ==========================================================================

  /**
   * POST /api/feedback
   * Create a new feedback request (all authenticated users)
   */
  async createFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const userAgent = req.headers['user-agent'];
    const result = await feedbackService.createFeedback(req.body, userId, userAgent);
    handleServiceResult(res, result, { successStatus: 201 });
  }

  // ==========================================================================
  // List Feedback
  // ==========================================================================

  /**
   * GET /api/feedback
   * List feedback requests (filtered by role on backend)
   */
  async getFeedbackList(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const filters = {
      status: req.query.status as FeedbackStatus | undefined,
      priority: req.query.priority as FeedbackPriority | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    const result = await feedbackService.getFeedbackList(filters, userId, isManager(userRole));
    handleServiceResult(res, result);
  }

  // ==========================================================================
  // Get Single Feedback
  // ==========================================================================

  /**
   * GET /api/feedback/:feedbackId
   * Get single feedback with responses
   */
  async getFeedbackById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const feedbackId = parseIntParam(req.params.feedbackId, 'Feedback ID');
    if (feedbackId === null) {
      return sendErrorResponse(res, 'Invalid feedback ID', 'VALIDATION_ERROR');
    }

    const result = await feedbackService.getFeedbackById(feedbackId, userId, isManager(userRole));
    handleServiceResult(res, result);
  }

  // ==========================================================================
  // Update Status (Manager+)
  // ==========================================================================

  /**
   * PATCH /api/feedback/:feedbackId/status
   * Update feedback status (manager+ only, enforced at route level)
   */
  async updateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const feedbackId = parseIntParam(req.params.feedbackId, 'Feedback ID');
    if (feedbackId === null) {
      return sendErrorResponse(res, 'Invalid feedback ID', 'VALIDATION_ERROR');
    }

    const { status } = req.body;
    if (!status) {
      return sendErrorResponse(res, 'Status is required', 'VALIDATION_ERROR');
    }

    const result = await feedbackService.updateStatus(feedbackId, status);
    handleServiceResult(res, result);
  }

  // ==========================================================================
  // Update Priority (Manager+)
  // ==========================================================================

  /**
   * PATCH /api/feedback/:feedbackId/priority
   * Update feedback priority (manager+ only, enforced at route level)
   */
  async updatePriority(req: AuthenticatedRequest, res: Response): Promise<void> {
    const feedbackId = parseIntParam(req.params.feedbackId, 'Feedback ID');
    if (feedbackId === null) {
      return sendErrorResponse(res, 'Invalid feedback ID', 'VALIDATION_ERROR');
    }

    const { priority } = req.body;
    if (!priority) {
      return sendErrorResponse(res, 'Priority is required', 'VALIDATION_ERROR');
    }

    const result = await feedbackService.updatePriority(feedbackId, priority);
    handleServiceResult(res, result);
  }

  // ==========================================================================
  // Add Response
  // ==========================================================================

  /**
   * POST /api/feedback/:feedbackId/responses
   * Add a response to feedback
   */
  async addResponse(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const feedbackId = parseIntParam(req.params.feedbackId, 'Feedback ID');
    if (feedbackId === null) {
      return sendErrorResponse(res, 'Invalid feedback ID', 'VALIDATION_ERROR');
    }

    const { message, is_internal, is_claude_message } = req.body;
    if (!message) {
      return sendErrorResponse(res, 'Message is required', 'VALIDATION_ERROR');
    }

    const result = await feedbackService.addResponse(
      feedbackId,
      userId,
      message,
      is_internal || false,
      isManager(userRole),
      is_claude_message || false
    );
    handleServiceResult(res, result, { successStatus: 201 });
  }

  // ==========================================================================
  // Screenshot
  // ==========================================================================

  /**
   * GET /api/feedback/:feedbackId/screenshot
   * Get screenshot from Google Drive
   */
  async getScreenshot(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const feedbackId = parseIntParam(req.params.feedbackId, 'Feedback ID');
    if (feedbackId === null) {
      return sendErrorResponse(res, 'Invalid feedback ID', 'VALIDATION_ERROR');
    }

    const result = await feedbackService.getScreenshot(feedbackId, userId, isManager(userRole));

    if (!result.success) {
      return sendErrorResponse(res, result.error || 'Screenshot not found', result.code || 'NOT_FOUND');
    }

    // Return screenshot as JSON with base64 data
    res.json({
      success: true,
      data: {
        data: result.data.data,
        mimeType: result.data.mimeType
      }
    });
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * GET /api/feedback/stats/open-count
   * Get count of open feedback
   */
  async getOpenCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const result = await feedbackService.getOpenCount(userId, isManager(userRole));
    handleServiceResult(res, result);
  }
}

export const feedbackController = new FeedbackController();
