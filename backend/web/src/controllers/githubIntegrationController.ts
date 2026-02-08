/**
 * GitHub Integration Controller
 * HTTP request handling for GitHub/Claude Code integration
 *
 * Created: 2026-02-08
 * Purpose: Handle API requests for assigning feedback to Claude, posting comments, status checks
 */

import { Request, Response } from 'express';
import { githubIntegrationService } from '../services/githubIntegrationService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../utils/controllerHelpers';

interface AuthenticatedRequest extends Request {
  user?: {
    user_id: number;
    role: string;
  };
}

export class GitHubIntegrationController {
  // ==========================================================================
  // Assign to Claude
  // ==========================================================================

  /**
   * POST /api/github-integration/:feedbackId/assign
   * Create GitHub Issue from feedback and trigger Claude Code Action
   */
  async assignToClaude(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const feedbackId = parseIntParam(req.params.feedbackId, 'Feedback ID');
    if (feedbackId === null) {
      return sendErrorResponse(res, 'Invalid feedback ID', 'VALIDATION_ERROR');
    }

    const { additional_context } = req.body;
    const result = await githubIntegrationService.assignToClaude(feedbackId, userId, additional_context);
    handleServiceResult(res, result, { successStatus: 201 });
  }

  // ==========================================================================
  // Post Comment
  // ==========================================================================

  /**
   * POST /api/github-integration/:feedbackId/comment
   * Post a comment on the linked GitHub Issue
   */
  async postComment(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const feedbackId = parseIntParam(req.params.feedbackId, 'Feedback ID');
    if (feedbackId === null) {
      return sendErrorResponse(res, 'Invalid feedback ID', 'VALIDATION_ERROR');
    }

    const { comment, trigger_claude } = req.body;
    if (!comment?.trim()) {
      return sendErrorResponse(res, 'Comment is required', 'VALIDATION_ERROR');
    }

    const result = await githubIntegrationService.postComment(
      feedbackId,
      userId,
      comment.trim(),
      trigger_claude !== false // default true
    );
    handleServiceResult(res, result);
  }

  // ==========================================================================
  // Pipeline Status
  // ==========================================================================

  /**
   * GET /api/github-integration/:feedbackId/status
   * Get GitHub integration status for a feedback ticket
   */
  async getPipelineStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const feedbackId = parseIntParam(req.params.feedbackId, 'Feedback ID');
    if (feedbackId === null) {
      return sendErrorResponse(res, 'Invalid feedback ID', 'VALIDATION_ERROR');
    }

    const result = await githubIntegrationService.getPipelineStatus(feedbackId);
    handleServiceResult(res, result);
  }

  // ==========================================================================
  // Rate Limit Status
  // ==========================================================================

  /**
   * GET /api/github-integration/rate-limit
   * Get current rate limit usage for the authenticated user
   */
  async getRateLimitStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
    }

    const result = await githubIntegrationService.getRateLimitStatus(userId);
    handleServiceResult(res, result);
  }
}

export const githubIntegrationController = new GitHubIntegrationController();
