/**
 * Session Edit Request Controller
 * Handles HTTP requests for session edit request submission, processing, and retrieval
 *
 * Created: 2025-01-15
 * Pattern: Mirrors EditRequestController from time tracking
 */

import { Response } from 'express';
import { TaskSessionEditRequestService } from '../../services/taskSessionEditRequestService';
import { AuthRequest } from '../../types';
import { sendErrorResponse } from '../../utils/controllerHelpers';

/**
 * Submit session edit request
 * POST /api/staff/sessions/edit-request
 * Permission: jobs.read (staff can submit for their own sessions)
 */
export const submitEditRequest = async (req: AuthRequest, res: Response) => {
  try {
    const {
      session_id,
      requested_started_at,
      requested_ended_at,
      requested_notes,
      reason
    } = req.body;

    // Basic validation
    if (!session_id || !requested_started_at || !reason) {
      return sendErrorResponse(res, 'Missing required fields (session_id, requested_started_at, reason)', 'VALIDATION_ERROR');
    }

    const result = await TaskSessionEditRequestService.submitEditRequest(req.user!, {
      session_id,
      requested_started_at,
      requested_ended_at: requested_ended_at || null,
      requested_notes,
      reason
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error submitting session edit request:', error);

    if (error.message.includes('not found') || error.message.includes('does not belong')) {
      return sendErrorResponse(res, error.message, 'NOT_FOUND');
    }

    sendErrorResponse(res, 'Failed to submit edit request', 'INTERNAL_ERROR');
  }
};

/**
 * Submit session delete request
 * POST /api/staff/sessions/delete-request
 * Permission: jobs.read (staff can submit for their own sessions)
 */
export const submitDeleteRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { session_id, reason } = req.body;

    // Basic validation
    if (!session_id || !reason) {
      return sendErrorResponse(res, 'Session ID and reason are required', 'VALIDATION_ERROR');
    }

    const result = await TaskSessionEditRequestService.submitDeleteRequest(req.user!, {
      session_id,
      reason
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error submitting session delete request:', error);

    if (error.message.includes('not found') || error.message.includes('does not belong')) {
      return sendErrorResponse(res, error.message, 'NOT_FOUND');
    }

    sendErrorResponse(res, 'Failed to submit delete request', 'INTERNAL_ERROR');
  }
};

/**
 * Get pending session edit requests (managers only)
 * GET /api/staff/sessions/pending-requests
 * Permission: orders.update (manager/owner only)
 */
export const getPendingRequests = async (req: AuthRequest, res: Response) => {
  try {
    const requests = await TaskSessionEditRequestService.getPendingRequests();
    res.json({
      success: true,
      data: requests
    });
  } catch (error: any) {
    console.error('Error fetching pending session requests:', error);
    sendErrorResponse(res, 'Failed to fetch pending requests', 'INTERNAL_ERROR');
  }
};

/**
 * Get pending request count (for dashboard badge)
 * GET /api/staff/sessions/pending-count
 * Permission: orders.update (manager/owner only)
 */
export const getPendingCount = async (req: AuthRequest, res: Response) => {
  try {
    const count = await TaskSessionEditRequestService.getPendingCount();
    res.json({
      success: true,
      data: { count }
    });
  } catch (error: any) {
    console.error('Error fetching pending count:', error);
    sendErrorResponse(res, 'Failed to fetch pending count', 'INTERNAL_ERROR');
  }
};

/**
 * Get pending request for a session (staff view their own)
 * GET /api/staff/sessions/:sessionId/pending-request
 * Permission: jobs.read (staff can view their own)
 */
export const getPendingRequestForSession = async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) {
      return sendErrorResponse(res, 'Invalid session ID', 'VALIDATION_ERROR');
    }

    const request = await TaskSessionEditRequestService.getPendingRequestForSession(req.user!, sessionId);
    res.json({
      success: true,
      data: request
    });
  } catch (error: any) {
    console.error('Error fetching pending request:', error);

    if (error.message.includes('not found') || error.message.includes('does not belong')) {
      return sendErrorResponse(res, error.message, 'NOT_FOUND');
    }

    sendErrorResponse(res, 'Failed to fetch pending request', 'INTERNAL_ERROR');
  }
};

/**
 * Update a pending edit request (staff update their own)
 * PUT /api/staff/sessions/edit-request
 * Permission: jobs.read (staff can update their own)
 */
export const updateEditRequest = async (req: AuthRequest, res: Response) => {
  try {
    const {
      request_id,
      requested_started_at,
      requested_ended_at,
      requested_notes,
      reason
    } = req.body;

    // Basic validation
    if (!request_id || !requested_started_at || !reason) {
      return sendErrorResponse(res, 'Missing required fields (request_id, requested_started_at, reason)', 'VALIDATION_ERROR');
    }

    const result = await TaskSessionEditRequestService.updatePendingRequest(req.user!, {
      request_id,
      requested_started_at,
      requested_ended_at: requested_ended_at || null,
      requested_notes,
      reason
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error updating edit request:', error);

    if (error.message.includes('not found') || error.message.includes('does not belong') || error.message.includes('only update your own')) {
      return sendErrorResponse(res, error.message, 'NOT_FOUND');
    }

    sendErrorResponse(res, 'Failed to update edit request', 'INTERNAL_ERROR');
  }
};

/**
 * Cancel a pending edit request (staff cancel their own)
 * POST /api/staff/sessions/edit-request/:requestId/cancel
 * Permission: jobs.read (staff can cancel their own)
 */
export const cancelEditRequest = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId);
    if (isNaN(requestId)) {
      return sendErrorResponse(res, 'Invalid request ID', 'VALIDATION_ERROR');
    }

    const result = await TaskSessionEditRequestService.cancelRequest(req.user!, requestId);
    res.json(result);
  } catch (error: any) {
    console.error('Error cancelling edit request:', error);

    if (error.message.includes('not found') || error.message.includes('does not belong')) {
      return sendErrorResponse(res, error.message, 'NOT_FOUND');
    }

    sendErrorResponse(res, 'Failed to cancel edit request', 'INTERNAL_ERROR');
  }
};

/**
 * Process session edit request (approve/reject/modify) - managers only
 * POST /api/staff/sessions/process-request
 * Permission: orders.update (manager/owner only)
 */
export const processRequest = async (req: AuthRequest, res: Response) => {
  try {
    const {
      request_id,
      action,
      modified_started_at,
      modified_ended_at,
      modified_notes,
      reviewer_notes
    } = req.body;

    // Basic validation
    if (!request_id || !action || !['approve', 'reject', 'modify'].includes(action)) {
      return sendErrorResponse(res, 'Invalid request: request_id and valid action required', 'VALIDATION_ERROR');
    }

    const result = await TaskSessionEditRequestService.processRequest(req.user!, {
      request_id,
      action,
      modified_started_at,
      modified_ended_at,
      modified_notes,
      reviewer_notes
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error processing session request:', error);

    if (error.message.includes('not found')) {
      return sendErrorResponse(res, error.message, 'NOT_FOUND');
    }

    sendErrorResponse(res, 'Failed to process request', 'INTERNAL_ERROR');
  }
};
