// File Clean up Finished: Nov 14, 2025
// Changes:
// - Removed 4 redundant auth checks (middleware guarantees user exists)
// - Replaced error handling with sendErrorResponse() helper
// - Changed Request param to AuthRequest for type safety
// - Added non-null assertions (req.user!) since auth middleware guarantees user
// - Reduced from 192 → 132 lines (31% reduction)

import { Response } from 'express';
import { EditRequestService } from '../../services/timeTracking/EditRequestService';
import { AuthRequest } from '../../types';
import { sendErrorResponse } from '../../utils/controllerHelpers';

/**
 * Edit Request Controller
 * Handles HTTP requests for edit request submission, processing, and retrieval
 */

/**
 * Submit time edit request
 * POST /api/time/edit-request
 */
export const submitEditRequest = async (req: AuthRequest, res: Response) => {
  try {
    const {
      entry_id,
      requested_clock_in,
      requested_clock_out,
      requested_break_minutes,
      reason
    } = req.body;

    // Basic validation
    if (!entry_id || !requested_clock_in || !requested_clock_out || requested_break_minutes === undefined || !reason) {
      return sendErrorResponse(res, 'Missing required fields', 'VALIDATION_ERROR');
    }

    const result = await EditRequestService.submitEditRequest(req.user!, {
      entry_id,
      requested_clock_in,
      requested_clock_out,
      requested_break_minutes,
      reason
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error submitting edit request:', error);

    if (error.message === 'Time entry not found') {
      return sendErrorResponse(res, error.message, 'NOT_FOUND');
    }

    sendErrorResponse(res, 'Failed to submit edit request', 'INTERNAL_ERROR');
  }
};

/**
 * Submit time delete request
 * POST /api/time/delete-request
 */
export const submitDeleteRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { entry_id, reason } = req.body;

    // Basic validation
    if (!entry_id || !reason) {
      return sendErrorResponse(res, 'Entry ID and reason are required', 'VALIDATION_ERROR');
    }

    const result = await EditRequestService.submitDeleteRequest(req.user!, {
      entry_id,
      reason
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error submitting delete request:', error);

    if (error.message === 'Time entry not found') {
      return sendErrorResponse(res, error.message, 'NOT_FOUND');
    }

    sendErrorResponse(res, 'Failed to submit delete request', 'INTERNAL_ERROR');
  }
};

/**
 * Get pending edit requests (managers only)
 * GET /api/time/pending-requests
 */
export const getPendingRequests = async (req: AuthRequest, res: Response) => {
  try {
    const requests = await EditRequestService.getPendingRequests(req.user!);
    res.json(requests);
  } catch (error: any) {
    console.error('Error fetching pending requests:', error);

    if (error.message.includes('Insufficient permissions')) {
      return sendErrorResponse(res, error.message, 'PERMISSION_DENIED');
    }

    sendErrorResponse(res, 'Failed to fetch pending requests', 'INTERNAL_ERROR');
  }
};

/**
 * Process edit request (approve/reject/modify) - managers only
 * POST /api/time/process-request
 */
export const processRequest = async (req: AuthRequest, res: Response) => {
  try {
    const {
      request_id,
      action,
      modified_clock_in,
      modified_clock_out,
      modified_break_minutes,
      reviewer_notes
    } = req.body;

    // Basic validation
    if (!request_id || !action || !['approve', 'reject', 'modify'].includes(action)) {
      return sendErrorResponse(res, 'Invalid request: request_id and valid action required', 'VALIDATION_ERROR');
    }

    const result = await EditRequestService.processRequest(req.user!, {
      request_id,
      action,
      modified_clock_in,
      modified_clock_out,
      modified_break_minutes,
      reviewer_notes
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error processing request:', error);

    if (error.message.includes('Insufficient permissions')) {
      return sendErrorResponse(res, error.message, 'PERMISSION_DENIED');
    }

    if (error.message.includes('not found')) {
      return sendErrorResponse(res, error.message, 'NOT_FOUND');
    }

    sendErrorResponse(res, 'Failed to process request', 'INTERNAL_ERROR');
  }
};
